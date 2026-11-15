import prototypeGraph from '../mockdata/prototypeGraph.json';
import { defineConfig, loadEnv, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';

const prototypeGraphPayload = JSON.stringify(prototypeGraph);

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_');
  const plugins: PluginOption[] = [react()];
  if (env.VITE_USE_MOCK_API !== 'false') {
    plugins.push({
      name: 'prototype-graph-fixture',
      configureServer(server) {
        server.middlewares.use('/mockdata/prototypeGraph.json', (_request, response) => {
          response.setHeader('Content-Type', 'application/json; charset=utf-8');
          response.end(prototypeGraphPayload);
        });
      },
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'mockdata/prototypeGraph.json',
          source: prototypeGraphPayload,
        });
      },
    });
  }
  return {
    plugins,
    server: { port: 5173, fs: { allow: ['..'] } },
  };
});
