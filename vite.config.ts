import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: 'dist',
    // Code splitting for better caching
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunk - rarely changes
          vendor: ['react', 'react-dom', 'react-router-dom'],
          // Firebase chunk - large, separate caching
          firebase: ['firebase/app', 'firebase/firestore', 'firebase/auth'],
          // Charts - only loaded on analytics page
          charts: ['recharts'],
          // State management
          state: ['zustand'],
        },
      },
    },
    // Reduce chunk size warnings threshold
    chunkSizeWarningLimit: 600,
    // Enable minification
    minify: 'esbuild',
    // Source maps only in development
    sourcemap: false,
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'zustand'],
  },
});