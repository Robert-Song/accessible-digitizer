import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { handlePdfExtract } from './pdfExtract.mjs';

const DEFAULT_BASE_URL = 'http://localhost:11434/v1';
const lastRequestAt = {
  text: 0,
  vision: 0
};

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

const errorDetails = (error) => {
  if (!(error instanceof Error)) return { message: 'Unknown error' };

  const cause = error.cause instanceof Error
    ? {
        name: error.cause.name,
        message: error.cause.message,
        code: error.cause.code
      }
    : undefined;

  return {
    name: error.name,
    message: error.message,
    code: error.code,
    cause
  };
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

const postJson = (url, headers, body, timeoutMs) => new Promise((resolve, reject) => {
  const parsedUrl = new URL(url);
  const client = parsedUrl.protocol === 'https:' ? https : http;
  const requestBody = JSON.stringify(body).replace(/[\u007f-\uffff]/g, (char) =>
    `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`
  );

  const req = client.request({
    protocol: parsedUrl.protocol,
    hostname: parsedUrl.hostname,
    port: parsedUrl.port,
    path: `${parsedUrl.pathname}${parsedUrl.search}`,
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(requestBody)
    }
  }, (res) => {
    const chunks = [];

    res.on('data', chunk => chunks.push(chunk));
    res.on('error', reject);
    res.on('end', () => {
      resolve({
        status: res.statusCode || 0,
        statusText: res.statusMessage || '',
        ok: Boolean(res.statusCode && res.statusCode >= 200 && res.statusCode < 300),
        headers: res.headers,
        body: Buffer.concat(chunks).toString('utf8')
      });
    });
  });

  req.setTimeout(timeoutMs, () => {
    const error = new Error(`Upstream LLM request timed out after ${timeoutMs} ms`);
    error.code = 'LLM_PROXY_TIMEOUT';
    req.destroy(error);
  });

  req.on('error', reject);
  req.write(requestBody);
  req.end();
});

const getConfig = () => {
  const baseUrl = process.env.LLM_BASE_URL || DEFAULT_BASE_URL;
  const textBaseUrl = process.env.LLM_TEXT_BASE_URL || baseUrl;
  const visionBaseUrl = process.env.LLM_VISION_BASE_URL || baseUrl;
  const textModel = process.env.LLM_TEXT_MODEL || process.env.LLM_MODEL || '';
  const visionModel = process.env.LLM_VISION_MODEL || textModel;
  const imageBaseUrl = process.env.IMAGE_API_BASE_URL || '';
  const textReasoningEffort = process.env.LLM_TEXT_REASONING_EFFORT || process.env.LLM_REASONING_EFFORT || '';
  const visionReasoningEffort = process.env.LLM_VISION_REASONING_EFFORT || process.env.LLM_REASONING_EFFORT || '';
  const textRequestDelayMs = Number(process.env.LLM_TEXT_REQUEST_DELAY_MS || process.env.LLM_REQUEST_DELAY_MS || 0);
  const visionRequestDelayMs = Number(process.env.LLM_VISION_REQUEST_DELAY_MS || process.env.LLM_REQUEST_DELAY_MS || 0);
  const requestTimeoutMs = Number(process.env.LLM_PROXY_TIMEOUT_MS || 20 * 60 * 1000);
  const concurrencyLimit = Number(process.env.LLM_CONCURRENCY_LIMIT || process.env.LLM_CONCURRENCY || process.env.CONCURRENCY_LIMIT || 2);

  return {
    baseUrl,
    textBaseUrl,
    visionBaseUrl,
    apiKey: process.env.LLM_API_KEY || '',
    textApiKey: process.env.LLM_TEXT_API_KEY || process.env.LLM_API_KEY || '',
    visionApiKey: process.env.LLM_VISION_API_KEY || process.env.LLM_API_KEY || '',
    textModel,
    visionModel,
    textReasoningEffort,
    visionReasoningEffort,
    textRequestDelayMs: Number.isFinite(textRequestDelayMs) && textRequestDelayMs > 0 ? textRequestDelayMs : 0,
    visionRequestDelayMs: Number.isFinite(visionRequestDelayMs) && visionRequestDelayMs > 0 ? visionRequestDelayMs : 0,
    requestTimeoutMs: Number.isFinite(requestTimeoutMs) && requestTimeoutMs > 0 ? requestTimeoutMs : 20 * 60 * 1000,
    concurrencyLimit: Number.isFinite(concurrencyLimit) && concurrencyLimit > 0 ? concurrencyLimit : 2,
    imageBaseUrl,
    imageApiKey: process.env.IMAGE_API_KEY || ''
  };
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const throttleProvider = async (kind, delayMs) => {
  if (!delayMs) return;

  const now = Date.now();
  const elapsed = now - lastRequestAt[kind];
  const waitMs = Math.max(0, delayMs - elapsed);

  if (waitMs > 0) await sleep(waitMs);
  lastRequestAt[kind] = Date.now();
};

const extractPath = (reqUrl = '') => {
  const url = new URL(reqUrl, 'http://localhost');
  return url.pathname;
};

const forwardChat = async (req, res) => {
  const config = getConfig();
  const body = await readBody(req);
  const isVisionRequest = Boolean(body.vision);
  const model = body.model || (isVisionRequest ? config.visionModel : config.textModel);
  const baseUrl = isVisionRequest ? config.visionBaseUrl : config.textBaseUrl;
  const apiKey = isVisionRequest ? config.visionApiKey : config.textApiKey;
  const reasoningEffort = isVisionRequest ? config.visionReasoningEffort : config.textReasoningEffort;
  const requestKind = isVisionRequest ? 'vision' : 'text';
  const requestDelayMs = isVisionRequest ? config.visionRequestDelayMs : config.textRequestDelayMs;

  if (!baseUrl) {
    sendJson(res, 500, {
      error: isVisionRequest
        ? 'LLM_VISION_BASE_URL or LLM_BASE_URL is not configured.'
        : 'LLM_TEXT_BASE_URL or LLM_BASE_URL is not configured.'
    });
    return;
  }

  if (!model) {
    sendJson(res, 500, {
      error: 'No model configured. Set LLM_TEXT_MODEL and LLM_VISION_MODEL in your environment.'
    });
    return;
  }

  const headers = { 'Content-Type': 'application/json; charset=utf-8' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const requestBody = {
    model,
    messages: body.messages,
    temperature: body.temperature ?? 0.1,
    max_tokens: body.max_tokens,
    response_format: body.response_format,
    stream: false
  };

  if (reasoningEffort) {
    requestBody.reasoning = {
      effort: reasoningEffort,
      exclude: true
    };
  }

  await throttleProvider(requestKind, requestDelayMs);

  const upstreamUrl = joinUrl(baseUrl, '/chat/completions');
  let upstream;
  try {
    upstream = await postJson(upstreamUrl, headers, requestBody, config.requestTimeoutMs);
  } catch (error) {
    const details = errorDetails(error);
    console.error('LLM upstream fetch failed:', {
      requestKind,
      model,
      baseUrl,
      details
    });
    sendJson(res, 502, {
      error: 'Could not complete request to the upstream LLM server.',
      message: details.message,
      cause: details.cause,
      model,
      baseUrl,
      hint: `The LLM server may have closed the connection, timed out, or returned a response the proxy could not read. Proxy timeout is ${config.requestTimeoutMs} ms; set LLM_PROXY_TIMEOUT_MS to change it. Check the LLM server logs around this page request.`
    });
    return;
  }

  const text = upstream.body;
  if (!upstream.ok) {
    sendJson(res, upstream.status, {
      error: `Upstream LLM server returned ${upstream.status}${upstream.statusText ? ` ${upstream.statusText}` : ''}.`,
      upstreamStatus: upstream.status,
      upstreamBody: text,
      model,
      baseUrl,
      hint: isVisionRequest
        ? 'This request included image input. Text chat works, but the upstream server appears not to support OpenAI-compatible vision requests for this model or deployment.'
        : 'Check the upstream LLM server logs, model name, and API key.'
    });
    return;
  }

  res.statusCode = upstream.status;
  res.setHeader('Content-Type', upstream.headers['content-type'] || 'application/json');
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
  if (!path.startsWith('/api/llm') && !path.startsWith('/api/pdf')) {
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
        baseUrl: config.baseUrl,
        textBaseUrl: config.textBaseUrl,
        visionBaseUrl: config.visionBaseUrl,
        splitProviders: config.textBaseUrl !== config.visionBaseUrl || config.textApiKey !== config.visionApiKey,
        textRequestDelayMs: config.textRequestDelayMs,
        visionRequestDelayMs: config.visionRequestDelayMs,
        requestTimeoutMs: config.requestTimeoutMs,
        concurrencyLimit: config.concurrencyLimit
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

    if (path === '/api/pdf/extract') {
      await handlePdfExtract(req, res);
      return;
    }

    sendJson(res, 404, { error: `Unknown API route: ${path}` });
  } catch (error) {
    console.error('API proxy error:', errorDetails(error));
    sendJson(res, 500, {
      error: error instanceof Error ? error.message : 'Unknown proxy error',
      details: errorDetails(error)
    });
  }
};
