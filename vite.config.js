import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html'),
        tenai: resolve(__dirname, 'tenai-website.html')
      }
    }
  }
});
