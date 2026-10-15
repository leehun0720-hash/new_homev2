import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readFileSync } from 'fs';

// 웹 회사소개서(public/profile/)는 번들을 거치지 않는 정적 문서라
// 로티 라이브러리를 <script> 로 직접 부른다. 외부 CDN 대신 node_modules 의
// 같은 판(lottie-web, package.json 고정)을 /profile/lottie_light.min.js 로 내보낸다.
const LOTTIE_LIGHT = resolve(__dirname, 'node_modules/lottie-web/build/player/lottie_light.min.js');
const profileLottie = () => ({
  name: 'profile-lottie',
  configureServer(server) {
    server.middlewares.use('/profile/lottie_light.min.js', (req, res) => {
      res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
      res.end(readFileSync(LOTTIE_LIGHT));
    });
  },
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'profile/lottie_light.min.js', source: readFileSync(LOTTIE_LIGHT) });
  }
});

export default defineConfig({
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  plugins: [profileLottie()],
  build: {
    rollupOptions: {
      input: {
        main:       resolve(__dirname, 'index.html'),
        biz:        resolve(__dirname, 'biz.html'),
        learn:      resolve(__dirname, 'learn.html'),
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
