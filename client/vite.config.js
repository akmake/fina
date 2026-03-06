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
          if (!id.includes('node_modules')) return;
          // normalize Windows backslashes
          const m = id.replace(/\\/g, '/');
          if (
            m.includes('/react/') ||
            m.includes('/react-dom/') ||
            m.includes('/react-is/') ||
            m.includes('/scheduler/') ||
            m.includes('/react-router') ||
            m.includes('/react-icons/') ||
            m.includes('/@react-oauth/') ||
            m.includes('/@tanstack/react') ||
            m.includes('/react-helmet') ||
            m.includes('/react-hot-toast/') ||
            m.includes('/react-window/') ||
            m.includes('/sonner/') ||
            m.includes('/@headlessui/')
          ) {
            return 'vendor-react';
          }
          if (m.includes('@radix-ui') || m.includes('lucide-react') || m.includes('framer-motion')) {
            return 'vendor-ui';
          }
          if (m.includes('recharts') || m.includes('chart.js')) {
            return 'vendor-charts';
          }
          if (m.includes('date-fns') || m.includes('axios') || m.includes('zustand')) {
            return 'vendor-utils';
          }
          return 'vendor-other';
        }
      }
    }
  }
});
