import { defineConfig } from 'vite';

export default defineConfig({
  define: {
    __BUILD_VERSION__: JSON.stringify(Date.now().toString()),
  },
  build: {
    chunkSizeWarningLimit: 2000,
    rolldownOptions: {
      checks: {
        pluginTimings: false,
      },
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules/eolib')) return 'eolib';
        },
      },
    },
  },
  server: {
    port: 3000,
  },
});
