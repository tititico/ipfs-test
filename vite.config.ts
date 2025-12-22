import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

function stripTrailers(proxy: any) {
  proxy.on('proxyRes', (proxyRes: any) => {
    // IPFS Cluster / ipfsproxy 会加这个，204 时会让 Node 18 报错
    delete proxyRes.headers['trailer'];
    delete proxyRes.headers['Trailer'];
    delete proxyRes.headers['te'];
    delete proxyRes.headers['TE'];
  });
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: {
        '/ipfs': {
          target: 'http://127.0.0.1:9095',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/ipfs/, ''),
          configure: stripTrailers,
        },
        '/cluster': {
          target: 'http://127.0.0.1:9094',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/cluster/, ''),
          configure: stripTrailers,
        },
	'/pinning': {
          target: 'http://127.0.0.1:9097',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/pinning/, ''),
          configure: stripTrailers,
        },
      },
      allowedHosts: ['ipfs-api.aio-lv.com'],
    },
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});

