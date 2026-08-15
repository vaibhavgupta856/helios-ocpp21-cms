import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/api': 'http://localhost:9090',
      '/ocpp': {
        target: 'ws://localhost:9090',
        ws: true,
      },
      '/socket.io': {
        target: 'http://localhost:9090',
        ws: true,
      },
    },
  },
});
