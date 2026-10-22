import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

// O build vai para backend/public/build e é servido pelo Laravel/Nginx em produção.
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    base: command === 'build' ? '/build/' : '/',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@pages': path.resolve(__dirname, 'pages'),
        '@components': path.resolve(__dirname, 'components'),
        '@services': path.resolve(__dirname, 'services'),
        '@hooks': path.resolve(__dirname, 'hooks'),
        '@utils': path.resolve(__dirname, 'utils'),
      },
    },
    // Só valores públicos chegam ao navegador.
    define: {
      __SENTRY_DSN__: JSON.stringify(env.SENTRY_DSN?.startsWith('https://') ? env.SENTRY_DSN : ''),
      __SENTRY_ENVIRONMENT__: JSON.stringify(env.SENTRY_ENVIRONMENT ?? 'development'),
      __SENTRY_TRACES_SAMPLE_RATE__: JSON.stringify(Number(env.SENTRY_TRACES_SAMPLE_RATE ?? 0)),
    },
    server: {
      host: true,
      port: 5173,
      strictPort: true,
      hmr: { clientPort: Number(process.env.VITE_HMR_CLIENT_PORT ?? 5173) },
      watch: { ignored: ['**/backend/**', '**/storage/**'] },
    },
    build: {
      outDir: 'backend/public/build',
      emptyOutDir: true,
      sourcemap: false,
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            charts: ['recharts'],
          },
        },
      },
    },
  };
});
