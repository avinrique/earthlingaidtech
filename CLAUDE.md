# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

EarthlingAidTech is a static marketing website for an engineering intelligence company. It showcases products (Prepzer0, Newsletter Creator, AI Info Robot) and services (EdTech, Agentic AI, Robotics, Enterprise Software). Hosted at earthlingaidtech.com via GitHub Pages.

## Tech Stack

- **No build system or package manager** — pure HTML, CSS, and vanilla JavaScript
- **External libraries (CDN-loaded):** Three.js (3D hero scene), GSAP 3.12.2 (animations)
- **Fonts:** Inter (body) + Space Grotesk (display) via Google Fonts
- **Deployment:** GitHub Actions → GitHub Pages (auto-deploys on push to `main`)

## Development

No build, install, or test commands. Open HTML files directly in a browser or use any local server:

```bash
python3 -m http.server 8000
```

Deployment is automatic — pushing to `main` triggers `.github/workflows/static.yml`.

## Architecture

### 3D Cube Navigation (core interaction)

The main page (`index.html`) uses a **hexagonal 3D cube** with 6 rotatable faces as the primary navigation. This is the most complex part of the codebase.

- **`css/cube.css`** — CSS 3D transforms (`perspective`, `transform-style: preserve-3d`), each face rotated 60deg around Y-axis
- **`js/cube.js`** — `Cube3D` class handling rotation via scroll (accumulator-based, 50px threshold), touch/swipe, keyboard arrows, and dot navigation. Has a 1200ms animation lock and edge-brake logic (500ms cooldown)
- Face content is defined inline in `index.html` sections (`.cube__face--1` through `.cube__face--6`)

### CSS Design System

`css/variables.css` defines the full design token system — colors, typography scale, 8px spacing grid, transitions, shadows, z-index scale. All other CSS files reference these variables. Dark mode only (primary bg: `#0B0D10`, accent: `#4A9EFF`).

CSS is split into: `variables.css` → `base.css` → `components.css` → `sections.css` → `cube.css`, plus `product-template.css` for product pages.

### JavaScript Modules

- **`js/three-hero.js`** — Three.js scene: central sphere + 10 orbiting nodes with line connections, floating sine/cosine motion, mouse-based parallax. Respects `prefers-reduced-motion`.
- **`js/main.js`** — GSAP entrance animations, magnetic button hover effects, card glow effects tracking mouse position, parallax depth.

### Product Pages

`prepzer0.html`, `newsletter.html`, `ai-robot.html` — standalone product showcases sharing `css/product-template.css`. Each has a fixed nav with backdrop blur, hero section, feature grid (3-col on desktop, responsive at 768px), and CTA section.

### SEO

Comprehensive: Open Graph, Twitter Cards, JSON-LD structured data (Organization + Product schemas), canonical URLs, `robots.txt`, `sitemap.xml`.

## Key Conventions

- All styling uses CSS custom properties from `variables.css` — do not use hardcoded color/spacing values
- Responsive breakpoint is 768px
- BEM-style CSS class naming (e.g., `.cube-nav__dot`, `.cube-arrow--prev`)
- No inline styles except for dynamic JavaScript-driven values
- Content reference document: `app.txt` contains raw copy/text for the site
