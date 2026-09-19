import { defineConfig } from 'vite';
import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
   plugins: [react(), tailwindcss()],
   resolve: {
      alias: {
         '@': path.resolve(__dirname, './src'),
      },
   },
   server: {
      proxy: {
         /*
          * Point at a deployed API with VITE_API_TARGET when there is no server
          * running locally. cookieDomainRewrite matters: the session cookie
          * comes back stamped with the API's domain, and a browser would
          * discard it for localhost without this.
          */
         '/api': {
            target: process.env.VITE_API_TARGET || 'http://localhost:3000',
            changeOrigin: true,
            cookieDomainRewrite: '',
            secure: true,
            /*
             * A deployed API only trusts the app's own origin, so a request
             * proxied from localhost arrives wearing it. Dev only: this
             * block is what lets the audit scripts run against a local
             * build with live data.
             */
            configure: (proxy) => {
               if (!process.env.VITE_API_TARGET) return;
               const origin =
                  process.env.VITE_APP_ORIGIN || 'https://fisherfeed.com';
               proxy.on('proxyReq', (req) => {
                  if (req.getHeader('origin')) req.setHeader('origin', origin);
                  req.setHeader('referer', `${origin}/`);
               });
            },
         },
      },
   },
});
