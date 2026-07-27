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
  // Astro builds directory-style (`/workshops/index.html`) and GitHub Pages 301s
  // `/workshops` → `/workshops/`. Canonicals, sitemap and internal links must all
  // carry the slash, otherwise every page is reported as "Page with redirect".
  trailingSlash: 'always',
  // Legacy URLs from the pre-Astro static site are redirected by hand-written
  // meta-refresh stubs in `public/` — Astro's `redirects` option would turn
  // `/ai-robot.html` into a directory under `trailingSlash: 'always'`.
  // Warm the next page on intent, not on sight. `viewport` would speculatively
  // pull every linked page in view — from the homepage that is ~136 kB gzip of
  // HTML competing with the images and fonts of the page being read. `hover`
  // (which also covers keyboard focus) costs nothing until someone aims at a
  // link, and pages are now 17-25 kB gzip anyway.
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'hover',
  },
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
