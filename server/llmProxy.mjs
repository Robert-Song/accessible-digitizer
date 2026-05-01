import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_BASE_URL = 'http://localhost:11434/v1';

const loadLocalEnv = () => {
  for (const fileName of ['.env.local', '.env']) {
    const filePath = path.resolve(process.cwd(), fileName);
    if (!fs.existsSync(filePath)) continue;

    const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const separator = trimmed.indexOf('=');
      if (separator === -1) continue;

      const key = trimmed.slice(0, separator).trim();
      const rawValue = trimmed.slice(separator + 1).trim();
      const value = rawValue.replace(/^["']|["']$/g, '');
      if (key && process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
};

loadLocalEnv();

const readBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : {};
};

const sendJson = (res, status, body) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
};

const sendCors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

const joinUrl = (baseUrl, path) => {
  const normalizedBase = baseUrl.replace(/\/+$/, '');
  return `${normalizedBase}${path}`;
};

const getConfig = () => {
  const baseUrl = process.env.LLM_BASE_URL || DEFAULT_BASE_URL;
  const textModel = process.env.LLM_TEXT_MODEL || process.env.LLM_MODEL || '';
  const visionModel = process.env.LLM_VISION_MODEL || textModel;
  const imageBaseUrl = process.env.IMAGE_API_BASE_URL || '';

  return {
    baseUrl,
    apiKey: process.env.LLM_API_KEY || '',
    textModel,
    visionModel,
    imageBaseUrl,
    imageApiKey: process.env.IMAGE_API_KEY || ''
  };
};

const extractPath = (reqUrl = '') => {
  const url = new URL(reqUrl, 'http://localhost');
  return url.pathname;
};

const forwardChat = async (req, res) => {
  const config = getConfig();
  const body = await readBody(req);
  const model = body.model || (body.vision ? config.visionModel : config.textModel);

  if (!config.baseUrl) {
    sendJson(res, 500, { error: 'LLM_BASE_URL is not configured.' });
    return;
  }

  if (!model) {
    sendJson(res, 500, {
      error: 'No model configured. Set LLM_TEXT_MODEL and LLM_VISION_MODEL in your environment.'
    });
    return;
  }

  const headers = { 'Content-Type': 'application/json' };
  if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;

  const upstream = await fetch(joinUrl(config.baseUrl, '/chat/completions'), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages: body.messages,
      temperature: body.temperature ?? 0.1,
      max_tokens: body.max_tokens,
      response_format: body.response_format,
      stream: false
    })
  });

  const text = await upstream.text();
  res.statusCode = upstream.status;
  res.setHeader('Content-Type', upstream.headers.get('Content-Type') || 'application/json');
  res.end(text);
};

const forwardImage = async (_req, res) => {
  const config = getConfig();
  if (!config.imageBaseUrl) {
    sendJson(res, 501, {
      error: 'AI image generation/editing is not configured. Set IMAGE_API_BASE_URL to enable these optional tools.'
    });
    return;
  }

  sendJson(res, 501, {
    error: 'IMAGE_API_BASE_URL is configured, but no image backend adapter has been implemented for this server yet.'
  });
};

export const handleLlmProxy = async (req, res, next) => {
  const path = extractPath(req.url);
  if (!path.startsWith('/api/llm')) {
    next?.();
    return;
  }

  sendCors(res);
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  try {
    if (req.method === 'GET' && path === '/api/llm/capabilities') {
      const config = getConfig();
      sendJson(res, 200, {
        chat: Boolean(config.baseUrl),
        image: Boolean(config.imageBaseUrl),
        textModel: config.textModel,
        visionModel: config.visionModel,
        baseUrl: config.baseUrl
      });
      return;
    }

    if (req.method === 'POST' && path === '/api/llm/chat') {
      await forwardChat(req, res);
      return;
    }

    if (req.method === 'POST' && path === '/api/llm/image') {
      await forwardImage(req, res);
      return;
    }

    sendJson(res, 404, { error: `Unknown LLM proxy route: ${path}` });
  } catch (error) {
    sendJson(res, 500, {
      error: error instanceof Error ? error.message : 'Unknown proxy error'
    });
  }
};
