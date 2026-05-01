import http from 'node:http';
import { handleLlmProxy } from './llmProxy.mjs';

const port = Number(process.env.PROXY_PORT || 8787);

const server = http.createServer((req, res) => {
  handleLlmProxy(req, res, () => {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Not found' }));
  });
});

server.listen(port, () => {
  console.log(`LLM proxy listening on http://localhost:${port}/api/llm`);
});
