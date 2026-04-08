import { rmSync } from 'fs';
import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  define: {
    __BUILD_VERSION__: JSON.stringify(Date.now().toString()),
  },
  plugins: [
    {
      name: 'exclude-local-config',
      closeBundle() {
        try {
          rmSync(resolve(__dirname, 'dist', 'config.local.json'));
        } catch {
          // File doesn't exist in build, nothing to do
        }
      },
    },
  ],
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
