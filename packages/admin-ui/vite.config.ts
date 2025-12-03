import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  server: {
    port: 5173,
    proxy: {
      '/admin/api': {
        target: 'http://localhost:5508',
        changeOrigin: true
      },
      '/api/auth': {
        target: 'http://localhost:5508',
        changeOrigin: true,
        cookieDomainRewrite: '' // Strip domain so cookie works on any localhost port
      },
      '/storage': {
        target: 'http://localhost:5508',
        changeOrigin: true
      }
    }
  }
});
