# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project overview

Marketing website for **Earthling Aidtech Private Limited** (earthlingaidtech.com) — a
multidisciplinary tech company (EdTech, agentic AI, robotics/embedded, software, workshops, R&D).
Rebuilt from scratch (2026) with **Astro + Tailwind v4**, deployed to **GitHub Pages**.
Tagline: _Engineering Intelligence. Empowering Humans._

> History: the previous version was a hand-written static HTML/CSS/vanilla-JS site (Three.js +
> GSAP, a 3D cube nav). That code is preserved in git history; this tree is the Astro rebuild.

## Tech stack

- **Astro 5** (static output) · **Tailwind CSS v4** via `@tailwindcss/vite` (no `tailwind.config`)
- Design tokens are CSS-first in `src/styles/global.css` under `@theme` → become utilities
  (`bg-canvas`, `text-ink`, `text-accent`, `font-display`, `border-line`, …)
- Self-hosted variable fonts (Fontsource): Space Grotesk (display), Inter (body), JetBrains Mono
- `astro-icon` + `@iconify-json/lucide` for icons (`<Icon name="lucide:..." />`)
- `@astrojs/sitemap` for sitemap; `@` path alias → `src/` (set in `astro.config.mjs` + `tsconfig`)

## Commands

```bash
npm run dev        # dev server at :4321
npm run build      # static build → dist/
npm run preview    # preview the built site
node scripts/gen-images.mjs   # regenerate public/og.png + icon-apple.png
```

## Conventions

- **All content lives in `src/data/site.ts`** — services, products, stats, clients, workshops,
  nav, contact. Never hardcode copy in markup; import from `@/data/site`.
- Use **design tokens / utilities**, not raw hex. Reusable utilities (`container-app`, `eyebrow`,
  `glass`, `bg-grid`, `glow-accent`, `text-gradient`, `.reveal`) are defined in `global.css`.
- Scroll-in animation: add class `reveal` (and optional `data-delay="1..5"`); an
  IntersectionObserver in `Base.astro` reveals it. Always degrade under `prefers-reduced-motion`.
- Accent colors per domain: blue (`accent`) default, plus `teal`, `violet`, `amber` for variety.
- Brand mark: `src/components/CubeLogo.astro` (three nested isometric cubes; inner cube blue).
- Header (`components/Header.astro`) has a working mobile menu + scroll-aware chrome.

## Deploy

Push to `main` → `.github/workflows/deploy.yml` (withastro/action → GitHub Pages).
Custom domain via `public/CNAME`. Repo Pages source must be **GitHub Actions**.
