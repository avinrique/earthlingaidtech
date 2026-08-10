/**
 * POST /api/content/clients/<id>/logo — admin. Replace a client's logo.
 *
 * The body is the image itself, not a multipart form: one client, one file, no other fields. Raw
 * bytes mean no boundary parsing, no multipart dependency, and a request the console can make with
 * `fetch(url, { method: 'POST', body: file })` — the File object already carries the right
 * Content-Type. Uploading again simply overwrites; there is no separate "delete logo" verb because
 * a client with no logo renders as a styled wordmark, which is a perfectly good outcome.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * SECURITY — WHY SVG IS REJECTED
 *
 * SVG is not an image format in the sense that matters here: it is an XML document that can carry
 * <script>, event handlers, <foreignObject> and external references. Served from this origin it
 * would execute in the same origin as the admin console, which means one uploaded file could read
 * the console's DOM and act with the operator's session — the eat_admin cookie is httpOnly, but an
 * attacker with script execution here does not need to read it, only to use it.
 *
 * The mitigations exist (Content-Disposition: attachment, a `sandbox` CSP, a separate origin), but
 * every one of them either breaks the thing the file is for — being rendered with <img src> in the
 * console and downloaded by the site build — or adds an origin to operate. And the payoff is
 * nothing: a client logo is a wordmark that PNG and WebP render perfectly at the sizes this site
 * uses. So SVG is refused at the door with its own error code, and the console can say why.
 *
 * The remaining formats are inert raster data. There is no parser on this server that touches
 * them: the bytes are stored and served back verbatim, so a malformed PNG is a broken image in a
 * browser, not a decoder exploit here.
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

import { requireAuth } from '../../../../lib/auth.js';
import { sql } from '../../../../lib/db.js';
import { applyCors, json, methodNotAllowed } from '../../../../lib/http.js';
import { toClient, type ClientRow } from '../../index.js';

/**
 * 256KB, matching the `content_clients_logo_size` CHECK in lib/schema.sql.
 *
 * Enforced here as well as in the database on purpose: the database constraint is the guarantee,
 * but it only fires after a quarter-megabyte has crossed the wire into a bound parameter. Checking
 * first turns a wasted round trip and an opaque constraint error into an immediate, explainable 413.
 */
const MAX_BYTES = 256 * 1024;

/** Formats we are willing to store. See the SVG note above for what is missing and why. */
const ALLOWED = ['image/png', 'image/jpeg', 'image/webp'] as const;
type AllowedMime = (typeof ALLOWED)[number];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (requireAuth(req, res)) return;
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST', 'OPTIONS']);

  const raw = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    return json(res, 400, { ok: false, error: 'bad_id' });
  }

  const declared = contentType(req);
  if (declared === 'image/svg+xml') {
    return json(res, 415, {
      ok: false,
      error: 'svg_rejected',
      message: 'SVG logos are not accepted. Export the mark as a PNG or WebP and upload that.',
    });
  }
  if (!isAllowed(declared)) {
    return json(res, 415, {
      ok: false,
      error: 'unsupported_type',
      message: 'Logos must be a PNG, JPEG or WebP image.',
    });
  }

  // Reject on the declared length before reading anything, when the client was honest enough to
  // send one. The read below re-checks, because Content-Length is a claim, not a measurement.
  const declaredLength = Number(req.headers['content-length']);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BYTES) {
    return json(res, 413, { ok: false, error: 'too_large', max_bytes: MAX_BYTES });
  }

  let bytes: Buffer | null;
  try {
    bytes = await readRawBody(req, MAX_BYTES);
  } catch (error) {
    console.error(`[content] logo ${id} body read failed`, error);
    return json(res, 400, { ok: false, error: 'bad_body' });
  }

  if (bytes === null) {
    return json(res, 413, { ok: false, error: 'too_large', max_bytes: MAX_BYTES });
  }
  if (bytes.length === 0) {
    return json(res, 400, { ok: false, error: 'empty_body' });
  }

  /**
   * Trust the bytes, not the header.
   *
   * Content-Type is supplied by the caller even on an authenticated route, so `image/png` proves
   * nothing about what follows it. Sniffing the magic number and requiring it to agree with the
   * declaration means the mime we store — and therefore the mime the media route later serves — is
   * derived from the file itself. That is what stops an HTML or SVG payload being stored under a
   * PNG label and then served back with a content-type that a browser is willing to render.
   */
  const sniffed = sniff(bytes);
  if (sniffed === null || sniffed !== declared) {
    return json(res, 415, {
      ok: false,
      error: 'content_mismatch',
      message: 'That file is not a valid PNG, JPEG or WebP image.',
    });
  }

  try {
    // logo_updated_at is what the media URL's `v` parameter and the media ETag are both built from,
    // so it has to move on every upload — that is what makes a replaced logo a new URL and stops a
    // cache anywhere in the chain from serving the old mark forever.
    const rows = (await sql`
      update content_clients
      set logo_bytes = ${bytes}, logo_mime = ${sniffed}, logo_updated_at = now()
      where id = ${id}
      returning id::int as id, name, note, url, sort_order::int as sort_order, active,
                (logo_bytes is not null) as has_logo, logo_updated_at
    `) as ClientRow[];

    const row = rows[0];
    if (!row) return json(res, 404, { ok: false, error: 'not_found' });

    return json(res, 200, { ok: true, client: toClient(req, row) });
  } catch (error) {
    console.error(`[content] logo ${id} store failed`, error);
    return json(res, 500, { ok: false, error: 'server' });
  }
}

/* ---------------------------------------------------------------------------
 * Request body
 * ------------------------------------------------------------------------- */

function contentType(req: VercelRequest): string {
  const raw = req.headers['content-type'];
  const value = (Array.isArray(raw) ? raw[0] : raw) ?? '';
  return (value.split(';')[0] ?? '').trim().toLowerCase();
}

function isAllowed(mime: string): mime is AllowedMime {
  return (ALLOWED as readonly string[]).includes(mime);
}

/**
 * Collect the raw request body, or null if it exceeds `cap`.
 *
 * WHY THIS IS NOT JUST `req.body`.
 * The platform's helper parses the body for a fixed set of content types — JSON, form-encoded,
 * text, octet-stream — and returns `undefined` for anything else, which includes every image type.
 * It has already drained the socket by then, but it replays the bytes back onto `req` as 'data'
 * and 'end' events, so they are still available; we just have to gather them ourselves.
 *
 * The listener style is deliberate. That replay intercepts exactly 'data' and 'end'; `for await
 * (… of req)` goes through 'readable' on the original, already-consumed stream and would hang or
 * come back empty. Reading via on('data') works against both the replayed stream and a real one.
 *
 * The cap is checked as chunks arrive rather than after concatenating, so an oversized upload is
 * abandoned instead of being buffered in full first.
 */
function readRawBody(req: VercelRequest, cap: number): Promise<Buffer | null> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let settled = false;

    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
    };

    req.on('data', (chunk: Buffer) => {
      if (settled) return;
      size += chunk.length;
      if (size > cap) {
        // Stop accumulating and answer now. The rest of the body is drained by the platform, not
        // by us, so there is nothing to tear down here.
        chunks.length = 0;
        settle(() => resolve(null));
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => settle(() => resolve(Buffer.concat(chunks))));
    req.on('error', (error) => settle(() => reject(error)));
  });
}

/* ---------------------------------------------------------------------------
 * Format sniffing
 * ------------------------------------------------------------------------- */

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Identify the format from its leading bytes, or null when it is none of the three.
 *
 * Only the container signature is checked — this is a gate on "what will a browser treat this as",
 * not a validity check on the image data. A browser decides how to render a resource from the
 * declared content-type and (absent nosniff) from these same leading bytes, so agreeing with them
 * is exactly the property that matters.
 */
function sniff(bytes: Buffer): AllowedMime | null {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(PNG_SIGNATURE)) return 'image/png';

  // JPEG: SOI marker (FFD8) followed by the first marker's FF. Every JPEG variant starts this way.
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }

  // WebP is a RIFF container: "RIFF" <4-byte length> "WEBP". Both tags must be present — "RIFF"
  // alone is also how WAV and AVI files start.
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString('latin1') === 'RIFF' &&
    bytes.subarray(8, 12).toString('latin1') === 'WEBP'
  ) {
    return 'image/webp';
  }

  return null;
}
