/**
 * Bridges the plain string paths in `src/data/site.ts` to real `ImageMetadata`,
 * so galleries stay data-driven while still going through Astro's image
 * pipeline (AVIF/WebP + responsive srcset + intrinsic width/height).
 *
 * Content keeps writing public-style paths — `/images/workshops/ws-1.jpg` —
 * and this module resolves them against `src/assets`. Adding a photo is still
 * "drop the file in, add one line to site.ts".
 */
import type { ImageMetadata } from 'astro';

const modules = import.meta.glob<{ default: ImageMetadata }>(
  '/src/assets/**/*.{jpg,jpeg,png,webp,avif}',
  { eager: true },
);

const byPath = new Map<string, ImageMetadata>(
  Object.entries(modules).map(([path, mod]) => [path.replace('/src/assets', ''), mod.default]),
);

/**
 * Resolve a content path to its build-time image asset.
 * Throws at build time rather than shipping a silently-broken <img>.
 */
export function asset(src: string): ImageMetadata {
  const found = byPath.get(src);
  if (!found) {
    throw new Error(
      `[images] No asset for "${src}". Expected a file at src/assets${src}. ` +
        `Known: ${[...byPath.keys()].join(', ')}`,
    );
  }
  return found;
}
