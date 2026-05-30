// @ts-check
import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'node:url';
import sitemap from '@astrojs/sitemap';
import icon from 'astro-icon';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  // Custom domain on GitHub Pages → site is the apex, base stays "/".
  site: 'https://earthlingaidtech.com',
  trailingSlash: 'ignore',
  integrations: [
    icon({
      iconDir: 'src/icons',
    }),
    sitemap(),
  ],
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
  },
  build: {
    inlineStylesheets: 'auto',
  },
});
