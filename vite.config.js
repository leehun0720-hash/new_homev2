import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  build: {
    rollupOptions: {
      input: {
        main:       resolve(__dirname, 'index.html'),
        about:      resolve(__dirname, 'about.html'),
        business:   resolve(__dirname, 'business.html'),
        education:  resolve(__dirname, 'education.html'),
        apps:       resolve(__dirname, 'apps.html'),
        news:       resolve(__dirname, 'news.html'),
        membership: resolve(__dirname, 'membership.html'),
        privacy:    resolve(__dirname, 'privacy.html'),
        terms:      resolve(__dirname, 'terms.html'),
        admin:      resolve(__dirname, 'admin.html'),
        tenai:      resolve(__dirname, 'tenai-website.html')
      }
    }
  }
});
