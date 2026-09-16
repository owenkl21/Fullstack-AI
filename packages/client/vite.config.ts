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
         },
      },
   },
});
