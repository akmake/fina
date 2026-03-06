import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

// This is the robust way to get the directory name in an ES module environment
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    dedupe: ['react', 'react-dom'],
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (
              id.includes('/react/') ||
              id.includes('/react-dom/') ||
              id.includes('/react-router') ||
              id.includes('/react-router-dom/') ||
              id.includes('/@react-oauth/') ||
              id.includes('/@tanstack/react') ||
              id.includes('/react-helmet') ||
              id.includes('/react-hot-toast/') ||
              id.includes('/react-window/') ||
              id.includes('/sonner/')
            ) {
              return 'vendor-react';
            }
            if (id.includes('@radix-ui') || id.includes('lucide-react') || id.includes('framer-motion')) {
              return 'vendor-ui';
            }
            if (id.includes('recharts') || id.includes('chart.js')) {
              return 'vendor-charts';
            }
            if (id.includes('date-fns') || id.includes('axios') || id.includes('zustand')) {
              return 'vendor-utils';
            }
            return 'vendor-other'; // שאר חבילות של צד שלישי
          }
        }
      }
    }
  }
});
