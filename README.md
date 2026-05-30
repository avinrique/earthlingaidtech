# Earthling Aidtech — earthlingaidtech.com

Marketing website for **Earthling Aidtech Private Limited** — a multidisciplinary
technology company building intelligent systems across EdTech, agentic AI, robotics,
embedded systems, and software.

> _Engineering Intelligence. Empowering Humans._

Built from scratch with **Astro + Tailwind CSS v4**, deployed to **GitHub Pages**.

## Tech stack

- **[Astro 5](https://astro.build)** — static site generator (zero JS by default)
- **[Tailwind CSS v4](https://tailwindcss.com)** via `@tailwindcss/vite` — design tokens live in `src/styles/global.css` (`@theme`)
- **Variable fonts** self-hosted via Fontsource — Space Grotesk (display), Inter (body), JetBrains Mono
- **[astro-icon](https://github.com/natemoo-re/astro-icon)** + Lucide icons
- **`@astrojs/sitemap`** — auto-generated sitemap
- Hosting: **GitHub Pages** (custom domain `earthlingaidtech.com` via `public/CNAME`)

## Project structure

```
src/
  data/site.ts            # single source of truth for all content
  styles/global.css       # Tailwind v4 @theme tokens + base + utilities
  layouts/Base.astro      # <head>/SEO, JSON-LD, header + footer shell
  components/              # CubeLogo, Button, Header (w/ mobile menu), Footer, …
  components/sections/     # Hero, ServicesGrid, ProductsShowcase, Approach, …
  pages/                  # index, about, services, workshops, contact, 404
  pages/products/         # index + [slug] (prepzer0, newsletter, ai-robot)
public/                   # CNAME, robots.txt, favicon.svg, og.png, logos
scripts/gen-images.mjs    # regenerates og.png + apple icon from brand SVGs
```

## Develop

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # → dist/
npm run preview    # serve the production build
```

## Editing content

All copy and structured data (services, products, stats, clients, workshops) live in
**`src/data/site.ts`**. Edit there — pages and components read from it.

Regenerate social/OG images after brand tweaks:

```bash
node scripts/gen-images.mjs
```

## Deploy

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds with
`withastro/action` and publishes to GitHub Pages. Ensure the repo's
**Settings → Pages → Source** is set to **GitHub Actions**.

## Brand

Dark "AI-lab" palette — canvas `#0B0D10`, electric-blue accent `#4A9EFF`, with teal
`#2DD4BF` and violet `#A78BFA` as secondary accents. Logo: three nested isometric cubes.
