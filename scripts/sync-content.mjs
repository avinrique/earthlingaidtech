/**
 * Build-time content sync — pulls the operator-editable content out of the admin API and
 * bakes it into the repo before Astro runs.
 *
 * WHY THIS EXISTS
 * This site is static HTML on GitHub Pages: there is no server at request time, so content
 * cannot be read from the database when a visitor arrives. It has to be resolved *at build
 * time* instead. That is what this script is — the bridge between the CMS (Neon, edited in the
 * admin console) and `src/data/content.json`, which `src/data/site.ts` imports like any other
 * source file. "Publishing" in the console is therefore just "trigger a rebuild".
 *
 * WHY IT NEVER FAILS THE BUILD
 * `src/data/content.json` is committed. It is not a cache — it is the source of truth as far as
 * the build is concerned, and this script only ever *updates* it. Every failure path here logs a
 * warning and exits 0, leaving the committed snapshot exactly as it was. A marketing site that
 * stops deploying because an API was cold, rate-limited, redeployed, or DNS-pending is a far
 * worse outcome than a site that ships yesterday's client list. That trade is deliberate, and it
 * is the single rule this file must never break.
 *
 * WHY LOGOS ARE DOWNLOADED, NOT HOT-LINKED
 * The API serves logo bytes from `/api/media/client/<id>`. If the built pages pointed at that
 * URL, every visitor's page load would depend on the API being up, and the logos would vanish
 * the day the API is retired. So the bytes are copied into `public/images/clients/` and the
 * `logo` field is rewritten to the local path. The images get committed alongside the snapshot,
 * which means an offline build (or a build where the API is unreachable) still renders them.
 *
 * Usage:
 *   node scripts/sync-content.mjs          # fetch + update the snapshot
 *   SKIP_CONTENT_SYNC=1 node ...           # no network at all (offline / CI / air-gapped)
 *   PUBLIC_API_BASE=http://localhost:3000 node ...   # point at a local `vercel dev`
 */

import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/* ---------------------------------------------------------------------------
 * Configuration
 * ------------------------------------------------------------------------- */

/** Same variable the enquiry form uses, so local dev points both at one API. */
const API_BASE = (process.env.PUBLIC_API_BASE || 'https://api.earthlingaidtech.com').replace(/\/+$/, '');

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SNAPSHOT = path.join(ROOT, 'src', 'data', 'content.json');
const LOGO_DIR = path.join(ROOT, 'public', 'images', 'clients');
/** Public path prefix that `logo` fields are rewritten to; mirrors LOGO_DIR under `public/`. */
const LOGO_URL_PREFIX = '/images/clients';

/** Short, because this sits in front of every build. A cold Vercel function answers well inside it. */
const TIMEOUT_MS = 10_000;
/** Three attempts total — enough to ride out one cold start plus one blip, not enough to stall CI. */
const ATTEMPTS = 3;
const RETRY_DELAY_MS = [600, 1800];

/** A client logo is a wordmark, not a hero image. Anything larger is a mistake or an attack. */
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

/** Extensions we are willing to write, keyed by the content-type the API reports. */
const IMAGE_EXTENSIONS = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
};

const TAG = '[sync-content]';
const warn = (...args) => console.warn(TAG, ...args);
const info = (...args) => console.log(TAG, ...args);

/* ---------------------------------------------------------------------------
 * Snapshot serialisation
 * ------------------------------------------------------------------------- */

/**
 * Serialise with a fixed key order and a trailing newline.
 *
 * This file is committed, so its diff is read by a human every time content changes. Stable
 * ordering means a git diff shows "the note on client 7 changed", not a reshuffled 200-line
 * blob because Postgres returned the rows in a different physical order.
 */
function serialize(content) {
  const clients = [...content.clients].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
  const settings = {};
  for (const key of Object.keys(content.settings).sort()) settings[key] = content.settings[key];

  const ordered = {
    clients: clients.map((c) => ({
      id: c.id,
      name: c.name,
      note: c.note,
      url: c.url,
      logo: c.logo,
      sort_order: c.sort_order,
      active: c.active,
    })),
    settings,
  };

  return `${JSON.stringify(ordered, null, 2)}\n`;
}

/** Read the committed snapshot. Its contents are the fallback for everything below. */
async function readSnapshot() {
  try {
    const parsed = JSON.parse(await readFile(SNAPSHOT, 'utf8'));
    return {
      clients: Array.isArray(parsed.clients) ? parsed.clients : [],
      settings: parsed.settings && typeof parsed.settings === 'object' ? parsed.settings : {},
    };
  } catch (err) {
    // Not fatal: a missing/corrupt snapshot means we have no baseline to merge against, but the
    // fetch below can still produce a complete one. Astro is what fails if the file is unusable,
    // and it should — that is a repo problem, not a network problem.
    warn(`could not read ${path.relative(ROOT, SNAPSHOT)}:`, err.message);
    return { clients: [], settings: {} };
  }
}

/* ---------------------------------------------------------------------------
 * Fetching
 * ------------------------------------------------------------------------- */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** `fetch` with a hard deadline — an API that never answers must not hang the build forever. */
async function fetchWithTimeout(url, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal, redirect: 'follow' });
  } finally {
    clearTimeout(timer);
  }
}

/** Retry a few times with a short backoff. Cold starts and transient 5xx are the expected cases. */
async function fetchWithRetry(url, init) {
  let lastError;
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    if (attempt > 0) await sleep(RETRY_DELAY_MS[attempt - 1] ?? 1800);
    try {
      const res = await fetchWithTimeout(url, init);
      // 4xx is a contract problem, not a blip — retrying just wastes build time.
      if (!res.ok && res.status < 500) throw new Error(`HTTP ${res.status} (not retrying)`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (err) {
      lastError = err;
      if (/not retrying/.test(err.message)) break;
      warn(`attempt ${attempt + 1}/${ATTEMPTS} failed for ${url}: ${err.message}`);
    }
  }
  throw lastError ?? new Error('request failed');
}

/* ---------------------------------------------------------------------------
 * Validation
 *
 * The API is ours, but the snapshot it overwrites is committed to the repo and shipped to
 * production. Anything malformed is dropped here rather than being written to disk and
 * discovered later as `undefined` in the rendered marquee.
 * ------------------------------------------------------------------------- */

const isPlainObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Trim to a string, or null. Empty strings become null so `note && ...` checks behave. */
function cleanText(value, maxLength) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) return null;
  return trimmed;
}

/** Only http(s) links get rendered — `javascript:` and friends never reach the markup. */
function cleanUrl(value) {
  const text = cleanText(value, 500);
  if (!text) return null;
  try {
    const url = new URL(text);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function normalizeClient(raw) {
  if (!isPlainObject(raw)) return null;
  if (!Number.isInteger(raw.id) || raw.id <= 0) return null;
  const name = cleanText(raw.name, 200);
  if (!name) return null;

  return {
    id: raw.id,
    name,
    note: cleanText(raw.note, 200),
    url: cleanUrl(raw.url),
    // Presence, not path: the real path is decided by the download step below.
    logo: typeof raw.logo === 'string' && raw.logo.trim() ? raw.logo.trim() : null,
    sort_order: Number.isInteger(raw.sort_order) ? raw.sort_order : 0,
    active: raw.active !== false,
  };
}

/** Settings are short display strings (stat tiles, inline numbers). Numbers are coerced. */
function normalizeSettings(raw) {
  const out = {};
  if (!isPlainObject(raw)) return out;
  for (const [key, value] of Object.entries(raw)) {
    if (!/^[a-z0-9_]{1,64}$/.test(key)) continue;
    const text = typeof value === 'number' ? String(value) : cleanText(value, 120);
    if (text) out[key] = text;
  }
  return out;
}

/* ---------------------------------------------------------------------------
 * Logos
 * ------------------------------------------------------------------------- */

/** `EverChiq` -> `everchiq`, `Curota.ai` -> `curota-ai`. Stable filenames keep git diffs small. */
function slugify(name, id) {
  const slug = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || `client-${id}`;
}

const fileExists = (p) => stat(p).then(() => true, () => false);

/**
 * Fetch one client's logo into `public/images/clients/` and return its site-relative path.
 *
 * Returns the *previous* path when the download fails but the file is still on disk, and null
 * when there is nothing usable. A single unreachable logo must not abort the sync: dropping to
 * the styled wordmark is a perfectly good rendering, and the marquee is built to mix the two.
 */
async function syncLogo(client, previousLogo) {
  const url = `${API_BASE}/api/media/client/${client.id}`;
  try {
    const res = await fetchWithRetry(url);
    const contentType = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    const ext = IMAGE_EXTENSIONS[contentType];
    if (!ext) throw new Error(`unsupported content-type "${contentType || 'none'}"`);

    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length === 0) throw new Error('empty response');
    if (bytes.length > MAX_LOGO_BYTES) throw new Error(`logo is ${bytes.length} bytes (max ${MAX_LOGO_BYTES})`);

    const filename = `${slugify(client.name, client.id)}.${ext}`;
    const dest = path.join(LOGO_DIR, filename);
    // Write-then-rename: a build killed mid-download must not leave a truncated PNG behind that
    // then gets committed as if it were the real logo.
    const tmp = `${dest}.tmp`;
    await writeFile(tmp, bytes);
    await rename(tmp, dest);
    return `${LOGO_URL_PREFIX}/${filename}`;
  } catch (err) {
    // Fall back to whatever is already committed for this client.
    if (previousLogo && previousLogo.startsWith(`${LOGO_URL_PREFIX}/`)) {
      const existing = path.join(LOGO_DIR, path.basename(previousLogo));
      if (await fileExists(existing)) {
        warn(`logo for "${client.name}" (#${client.id}) failed: ${err.message} — keeping ${previousLogo}`);
        return previousLogo;
      }
    }
    warn(`logo for "${client.name}" (#${client.id}) failed: ${err.message} — falling back to the wordmark`);
    return null;
  }
}

/* ---------------------------------------------------------------------------
 * Main
 * ------------------------------------------------------------------------- */

async function main() {
  if (process.env.SKIP_CONTENT_SYNC === '1') {
    info('SKIP_CONTENT_SYNC=1 — using the committed snapshot.');
    return;
  }

  const snapshot = await readSnapshot();

  /*
   * Bypass the edge cache, deliberately.
   *
   * /api/content is public and CDN-cached, which is right for a public endpoint and wrong for this
   * one caller. A build is triggered *because* someone just edited something, so it is the one
   * request that must never be served a stale copy — otherwise Publish rebuilds the site with
   * pre-edit content and there is nothing on screen to explain why the change did not appear.
   * A unique query parameter gives this request its own cache key; the no-cache headers cover any
   * intermediary that ignores it. Everyone else still gets the cached response.
   */
  const endpoint = `${API_BASE}/api/content?build=${Date.now()}`;
  info(`fetching ${endpoint}`);

  const res = await fetchWithRetry(endpoint, {
    cache: 'no-store',
    headers: {
      accept: 'application/json',
      'cache-control': 'no-cache',
      pragma: 'no-cache',
    },
  });
  const payload = await res.json();
  if (!isPlainObject(payload) || payload.ok !== true) throw new Error('response was not { ok: true, ... }');

  const clients = (Array.isArray(payload.clients) ? payload.clients : [])
    .map(normalizeClient)
    .filter((c) => c !== null && c.active);

  // An empty list is almost certainly a pointed-at-the-wrong-database mistake rather than a real
  // editorial decision to have zero clients, and silently wiping the marquee is not recoverable
  // from a page view. Keep the snapshot and make the operator say it twice.
  if (clients.length === 0) throw new Error('API returned no active clients — refusing to blank the client list');

  // Merge rather than replace: a settings key that the API stops returning (renamed, mid-migration,
  // partially seeded) would otherwise disappear from the snapshot and take a rendered number with
  // it. Adding and changing keys works; removing one is a deliberate edit to this file.
  const settings = { ...snapshot.settings, ...normalizeSettings(payload.settings) };

  await mkdir(LOGO_DIR, { recursive: true });
  const previousLogos = new Map(snapshot.clients.map((c) => [c.id, c.logo]));
  for (const client of clients) {
    client.logo = client.logo ? await syncLogo(client, previousLogos.get(client.id) ?? null) : null;
  }

  const next = serialize({ clients, settings });
  const current = await readFile(SNAPSHOT, 'utf8').catch(() => null);
  if (next === current) {
    info(`content unchanged (${clients.length} clients).`);
    return;
  }

  await writeFile(SNAPSHOT, next);
  info(`wrote ${path.relative(ROOT, SNAPSHOT)} — ${clients.length} clients, ${Object.keys(settings).length} settings.`);
}

main().catch((err) => {
  warn(`sync failed: ${err.message}`);
  warn('building from the committed src/data/content.json instead. The build continues.');
  // Exit 0, always. See the header comment: the build is never allowed to fail here.
  process.exit(0);
});
