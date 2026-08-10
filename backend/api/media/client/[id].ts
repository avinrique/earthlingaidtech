/**
 * GET /api/media/client/<id>?v=<version> — public. Serves a client logo's bytes.
 *
 * The counterpart to POST /api/content/clients/<id>/logo. Bytes live in Postgres (see
 * lib/schema.sql for why), and this is the only route that reads them out.
 *
 * CACHING. The aggregate at /api/content stamps every logo URL with `?v=<logo_updated_at>`, so a
 * given URL's bytes can never change: replacing a logo mints a new URL. That makes it safe to serve
 * `immutable` with a long max-age, which matters because the site build fetches every logo on every
 * deploy.
 *
 * SAFETY. The upload route rejects SVG and stores the mime it sniffed from the bytes rather than
 * the one the client declared, so nothing reachable here is executable content. `nosniff` is set
 * anyway: this origin also serves the admin console, and a browser talked into interpreting an
 * image as HTML here would be stored XSS against the operator.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

import { sql } from '../../../lib/db.js';
import { applyCors, json, methodNotAllowed } from '../../../lib/http.js';
import { logoVersion } from '../../content/index.js';

/** Exactly what the upload route is allowed to store. Anything else is treated as absent. */
const SERVEABLE = new Set(['image/png', 'image/jpeg', 'image/webp']);

interface LogoRow {
  logo_bytes: unknown;
  logo_mime: string | null;
  logo_updated_at: unknown;
}

/**
 * Normalise whatever the driver hands back for a bytea column.
 *
 * Depending on the transport this arrives as a Buffer or as Postgres' hex text format
 * (`\x89504e47...`). Handling only the first shape produces an empty image on the other, which is
 * the kind of bug that shows up as a broken logo in production and nowhere else.
 */
function toBuffer(value: unknown): Buffer | null {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === 'string' && value.startsWith('\\x')) {
    return Buffer.from(value.slice(2), 'hex');
  }
  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return methodNotAllowed(res, ['GET', 'HEAD', 'OPTIONS']);
  }

  // Strict integer only. The id is the whole of the addressable surface here, so anything that is
  // not plainly a positive integer is rejected rather than coerced.
  const raw = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    return json(res, 400, { ok: false, error: 'bad_id' });
  }

  let row: LogoRow | undefined;
  try {
    const rows = (await sql`
      select logo_bytes, logo_mime, logo_updated_at
      from content_clients
      where id = ${id}
    `) as unknown as LogoRow[];
    row = rows[0];
  } catch (error) {
    console.error(`[media] client ${id} lookup failed`, error);
    return json(res, 500, { ok: false, error: 'server' });
  }

  const bytes = row ? toBuffer(row.logo_bytes) : null;
  const mime = row?.logo_mime ?? '';
  if (!row || !bytes || bytes.length === 0 || !SERVEABLE.has(mime)) {
    return json(res, 404, { ok: false, error: 'not_found' });
  }

  const etag = `"${id}-${logoVersion(row.logo_updated_at)}"`;

  res.setHeader('ETag', etag);
  res.setHeader('Content-Type', mime);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Not user-generated in the public sense — only the authenticated operator can upload — but it is
  // still binary served from the API origin, so keep it out of any framing or scripting context.
  res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

  // Revalidation is cheap and common: the site build re-fetches every logo on every deploy.
  const inm = req.headers['if-none-match'];
  const candidates = (Array.isArray(inm) ? inm.join(',') : inm ?? '')
    .split(',')
    .map((t) => t.trim());
  if (candidates.includes(etag) || candidates.includes('*')) {
    return res.status(304).end();
  }

  res.setHeader('Content-Length', String(bytes.length));
  res.status(200);
  if (req.method === 'HEAD') return res.end();
  return res.end(bytes);
}
