import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const readBuffer = async (req) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
};

const sendJson = (res, status, body) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
};

const runPdfPlumber = (pdfPath) => new Promise((resolve, reject) => {
  const scriptPath = path.resolve(process.cwd(), 'server', 'scripts', 'extract_pdf_text.py');
  const python = process.env.PDFPLUMBER_PYTHON || process.env.PYTHON || 'python';
  const child = spawn(python, [scriptPath, pdfPath], {
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let stdout = '';
  let stderr = '';

  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', chunk => { stdout += chunk; });
  child.stderr.on('data', chunk => { stderr += chunk; });
  child.on('error', reject);
  child.on('close', code => {
    if (code !== 0) {
      const error = new Error(stderr.trim() || `pdfplumber exited with code ${code}`);
      error.code = code;
      reject(error);
      return;
    }

    try {
      resolve(JSON.parse(stdout));
    } catch (error) {
      reject(new Error(`Could not parse pdfplumber output: ${error.message}`));
    }
  });
});

export const handlePdfExtract = async (req, res) => {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Use POST with a PDF body.' });
    return;
  }

  const buffer = await readBuffer(req);
  if (!buffer.length) {
    sendJson(res, 400, { error: 'No PDF body received.' });
    return;
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'accessdocs-pdf-'));
  const pdfPath = path.join(tempDir, 'input.pdf');

  try {
    await fs.writeFile(pdfPath, buffer);
    const extracted = await runPdfPlumber(pdfPath);
    sendJson(res, 200, extracted);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown pdfplumber error';
    const missingPdfPlumber = /No module named ['"]pdfplumber['"]|ModuleNotFoundError/.test(message);
    console.error('PDF text extraction failed:', {
      message,
      missingPdfPlumber
    });
    sendJson(res, missingPdfPlumber ? 501 : 500, {
      error: missingPdfPlumber
        ? 'pdfplumber is not installed for the server Python environment.'
        : 'Failed to extract PDF text with pdfplumber.',
      message,
      hint: missingPdfPlumber
        ? 'Install pdfplumber, or set PDFPLUMBER_PYTHON to a Python executable where pdfplumber is installed.'
        : 'Check whether the uploaded PDF is valid and readable.'
    });
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
};
