import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { handleLlmProxy } from './server/llmProxy.mjs';

const llmProxyPlugin = () => ({
  name: 'qed-llm-proxy',
  configureServer(server: any) {
    server.middlewares.use((req: any, res: any, next: any) => {
      handleLlmProxy(req, res, next);
    });
  },
  configurePreviewServer(server: any) {
    server.middlewares.use((req: any, res: any, next: any) => {
      handleLlmProxy(req, res, next);
    });
  }
});

export default defineConfig(() => {
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react(), tailwindcss(), llmProxyPlugin()],
      define: {
        '__BUILD_DATE__': JSON.stringify(new Date().toLocaleString())
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
