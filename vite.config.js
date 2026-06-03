import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three';
          if (id.includes('@react-three/fiber')) return 'r3f';
          if (id.includes('@react-three/drei')) return 'drei';
          if (id.includes('/src/export/')) return 'exporters';
        },
      },
    },
  },
  test: {
    environment: 'node',
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.test.js'],
  },
});
