/**
 * GET /api/content — public. The single endpoint the marketing site's build depends on.
 *
 * WHY IT IS PUBLIC AND WHY IT IS SHAPED LIKE THIS
 * earthlingaidtech.com is static HTML on GitHub Pages, so nothing on it can read Neon at request
 * time. `scripts/sync-content.mjs` fetches this endpoint during the build and bakes the answer into
 * `src/data/content.json`. That makes this a *build* dependency, not a *runtime* one — and the
 * build is explicitly written to shrug off a failure here and use the committed snapshot instead.
 * Two consequences shape everything below: the response must be cheap enough to serve on every
 * build without thinking about it, and it must be honest about the current state of the database
 * rather than clever about it.
 *
 * WHY logo_bytes IS NEVER SELECTED HERE
 * The logos live in Postgres as bytea (see lib/schema.sql). A dozen clients at up to 256KB each is
 * a multi-megabyte JSON payload if the bytes are inlined — base64'd, uncacheable, and re-sent on
 * every poll. So this query asks only whether a logo exists and hands back a URL to the media
 * route for the bytes themselves. The sync script downloads those separately and commits them.
 *
 * WHY THIS FILE ALSO HOLDS SHARED CODE
 * The client row shape, the media-URL builder and the field validators are needed by all five
 * content routes. They would normally live in lib/, but lib/ is out of scope for this change, and a
 * validation limit or a settings whitelist copy-pasted into four files is a limit that drifts. The
 * sibling routes import the named exports below; Vercel only ever invokes the default export, so
 * the extra exports cost nothing at runtime.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

import { sql } from '../../lib/db.js';
import { applyCors, json, methodNotAllowed } from '../../lib/http.js';

/* ---------------------------------------------------------------------------
 * Shapes
 * ------------------------------------------------------------------------- */

/** What every content route returns for a client. Matches `ContentClient` in src/data/site.ts. */
export interface Client {
  id: number;
  name: string;
  note: string | null;
  url: string | null;
  /** Absolute URL of the logo on this API, or null. The site build rewrites it to a local path. */
  logo: string | null;
  sort_order: number;
  active: boolean;
}

/**
 * A row as selected from content_clients.
 *
 * `has_logo` and `logo_updated_at` stand in for the bytes: enough to say whether a logo exists and
 * which revision it is, without moving a single byte of image data.
 */
export interface ClientRow {
  id: number;
  name: string;
  note: string | null;
  url: string | null;
  sort_order: number;
  active: boolean;
  has_logo: boolean;
  logo_updated_at: unknown;
}

/* ---------------------------------------------------------------------------
 * Settings
 * ------------------------------------------------------------------------- */

/**
 * The editable keys, with the values the site shipped with.
 *
 * This doubles as the whitelist for PATCH /api/content/settings — an operator cannot invent a key
 * that no page reads — and as the floor for the payload below. The floor matters: an empty or
 * half-seeded settings table would otherwise hand the build a blank string for a headline number,
 * and a stat tile reading "" is a worse failure than a stat tile reading last month's figure.
 * src/data/site.ts carries the same fallbacks independently, so a value has to be lost twice
 * before anything renders empty.
 */
export const SETTING_DEFAULTS: Record<string, string> = {
  students_trained: '1.7k+',
  students_trained_prose: '1,700+',
  sessions_delivered: '15+',
  technical_tracks: '7',
  workshops_count: '6',
};

/** Display strings ("1.7k+"), never prose. Long enough for a formatted number, short enough to be a number. */
export const SETTING_VALUE_MAX = 40;

/* ---------------------------------------------------------------------------
 * Field validation
 *
 * Shared by the create and update routes. Operator-entered rather than attacker-entered, but the
 * values end up in committed JSON, in the rendered site and in the console's DOM, so they get the
 * same treatment as anything else: bounded length, no control characters, no non-http schemes.
 * ------------------------------------------------------------------------- */

export const LIMITS = { name: 80, note: 40, url: 200 } as const;

export type FieldResult<T> = { ok: true; value: T } | { ok: false; error: string };

/**
 * Strip control characters and trim, exactly as lib/validate.ts does for leads.
 *
 * The CR/LF removal is the part that matters: these strings are echoed into HTTP headers nowhere
 * today, but they do reach a committed JSON file and an HTML page, and a name containing a newline
 * is never a real client name.
 *
 * `max` is deliberately the *rejection* threshold plus one at every call site — we clamp so a
 * gigabyte of input cannot be held in memory, then reject anything that survived at full length
 * rather than silently storing a truncated brand name.
 */
export function cleanLine(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
}

export function readName(raw: unknown): FieldResult<string> {
  const name = cleanLine(raw, LIMITS.name + 1);
  if (name.length === 0) return { ok: false, error: 'A client name is required.' };
  if (name.length > LIMITS.name) {
    return { ok: false, error: `Keep the name to ${LIMITS.name} characters or fewer.` };
  }
  return { ok: true, value: name };
}

/** Empty means "no note", not "a note that is blank" — hence null rather than ''. */
export function readNote(raw: unknown): FieldResult<string | null> {
  const note = cleanLine(raw, LIMITS.note + 1);
  if (note.length === 0) return { ok: true, value: null };
  if (note.length > LIMITS.note) {
    return { ok: false, error: `Keep the note to ${LIMITS.note} characters — it sits under the logo.` };
  }
  return { ok: true, value: note };
}

/**
 * Parse a client website.
 *
 * The scheme check is the security-relevant half: this string is written into an `href` on the
 * public site and in the admin console, so `javascript:` and `data:` must never survive validation.
 * The stored value is the *serialised* URL, which normalises the host and guarantees that what we
 * persist is something `new URL()` already accepted — no smuggled whitespace, no ambiguity between
 * what we validated and what we saved.
 */
export function readUrl(raw: unknown): FieldResult<string | null> {
  const text = cleanLine(raw, LIMITS.url + 1);
  if (text.length === 0) return { ok: true, value: null };

  let parsed: URL;
  try {
    parsed = new URL(text);
  } catch {
    return { ok: false, error: 'That does not look like a full web address (include https://).' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: 'Links must start with http:// or https://.' };
  }

  const normalised = parsed.toString();
  if (normalised.length > LIMITS.url) {
    return { ok: false, error: `Keep the link to ${LIMITS.url} characters or fewer.` };
  }
  return { ok: true, value: normalised };
}

/**
 * Was this a collision with the unique index on lower(name)?
 *
 * scripts/seed-content.mjs creates `content_clients_name_unique` so that re-running the seed cannot
 * duplicate a brand. That index is not a rule the routes below invented, but it is their problem:
 * without this check an operator who re-adds "EverChiq" gets an opaque 500 instead of being told
 * the client is already in the list — very possibly hidden, which is why they could not find it.
 *
 * 23505 is Postgres' unique_violation. The index name is deliberately not matched on: if another
 * unique constraint appears later, "that value is already taken" is still the honest answer.
 */
export function isDuplicateName(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === '23505';
}

/* ---------------------------------------------------------------------------
 * Media URLs
 * ------------------------------------------------------------------------- */

function firstHeader(req: VercelRequest, name: string): string {
  const raw = req.headers[name];
  const value = (Array.isArray(raw) ? raw[0] : raw) ?? '';
  // A forwarded header can be a comma-joined chain; the first entry is the one addressed to us.
  return (value.split(',')[0] ?? '').trim();
}

/**
 * The origin this request arrived on.
 *
 * Derived from the request rather than from configuration on purpose. Whoever called us reached
 * this service on *some* origin, and the media route lives on that same origin, so echoing it back
 * is correct for the custom domain, the vercel.app fallback and `vercel dev` alike — with no
 * environment variable to keep in sync and no way for the two to disagree.
 *
 * Host is nominally caller-controlled. The worst a forged one achieves is that the forger's own
 * response points at a host of their choosing: nothing here is signed, stored, mailed or redirected
 * to on the strength of it. The character clamp is belt-and-braces so a junk header cannot produce
 * a junk field in the committed snapshot.
 */
function requestOrigin(req: VercelRequest): string {
  const host = firstHeader(req, 'x-forwarded-host') || firstHeader(req, 'host');
  const proto = firstHeader(req, 'x-forwarded-proto') || (process.env.VERCEL ? 'https' : 'http');

  const safeHost = /^[a-z0-9.\-:[\]]{1,255}$/i.test(host) ? host : 'api.earthlingaidtech.com';
  const safeProto = proto === 'http' ? 'http' : 'https';
  return `${safeProto}://${safeHost}`;
}

/**
 * The logo's revision, as whole seconds.
 *
 * Used both as the `v` query parameter on the media URL and as the ETag on the media response, so
 * the two can never disagree about which bytes are current. Neon hands timestamptz back as a Date;
 * a string is accepted too so this survives a driver or serialisation change.
 */
export function logoVersion(value: unknown): string {
  const ms =
    value instanceof Date ? value.getTime() : typeof value === 'string' ? Date.parse(value) : NaN;
  return Number.isFinite(ms) ? String(Math.floor(ms / 1000)) : '0';
}

/**
 * Public URL for a client's logo, or null when there is none.
 *
 * The `v` parameter is what makes the media route safe to serve as immutable: replacing a logo
 * changes the version, which changes the URL, so no CDN, browser or build cache can pin the old
 * image. Without it the only correct cache policy would be "revalidate constantly".
 */
export function logoUrl(req: VercelRequest, row: ClientRow): string | null {
  if (!row.has_logo) return null;
  return `${requestOrigin(req)}/api/media/client/${row.id}?v=${logoVersion(row.logo_updated_at)}`;
}

/** Row -> the wire shape. The one place the Client contract is actually produced. */
export function toClient(req: VercelRequest, row: ClientRow): Client {
  return {
    id: row.id,
    name: row.name,
    note: row.note,
    url: row.url,
    logo: logoUrl(req, row),
    sort_order: row.sort_order,
    active: row.active,
  };
}

/* ---------------------------------------------------------------------------
 * Handler
 * ------------------------------------------------------------------------- */

/**
 * Short, because the content behind it changes a handful of times a year but is read on every
 * build; long enough that a burst of builds does not hammer Neon. `stale-while-revalidate` means a
 * cold revalidation never blocks a build — the previous payload is served while the new one is
 * fetched, which is precisely the failure mode this feature is most exposed to.
 */
const CACHE_CONTROL = 'public, max-age=0, s-maxage=60, stale-while-revalidate=300';

/**
 * Let this one response be cached.
 *
 * lib/http.json() stamps `Cache-Control: no-store` on every reply, which is the correct default for
 * a service whose other endpoints all return leads. This endpoint is the exact opposite: fully
 * public, and fetched by every site build. lib/ is out of scope for this change, so rather than
 * fork json()'s encoding and content-type handling here, we intercept the single header it sets and
 * substitute the value. Every other header json() writes passes through untouched.
 */
function cacheable(res: VercelResponse, value: string): VercelResponse {
  const original = res.setHeader.bind(res);
  res.setHeader = ((name: string, headerValue: number | string | readonly string[]) =>
    original(name, name.toLowerCase() === 'cache-control' ? value : headerValue)) as typeof res.setHeader;
  return res;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== 'GET' && req.method !== 'HEAD') return methodNotAllowed(res, ['GET', 'OPTIONS']);

  try {
    // Two independent reads, issued together: the Neon HTTP driver has no connection to serialise
    // on, so waiting for the first before starting the second would just add a round trip to every
    // build. `active` is filtered in SQL rather than in JS so an inactive client's name never
    // leaves the database on the public route.
    const [clientRows, settingRows] = await Promise.all([
      sql`
        select id::int as id, name, note, url, sort_order::int as sort_order, active,
               (logo_bytes is not null) as has_logo, logo_updated_at
        from content_clients
        where active
        order by sort_order, id
      ` as unknown as Promise<ClientRow[]>,
      sql`select key, value from content_settings` as unknown as Promise<
        Array<{ key: string; value: string }>
      >,
    ]);

    // Defaults first, database on top. A key present in the table wins; a key missing from it (or
    // blanked to whitespace) falls back rather than rendering as nothing. Keys the table holds but
    // this file does not know about are passed through — the site ignores what it does not read,
    // and dropping them here would make adding a key a two-repo change.
    const settings: Record<string, string> = { ...SETTING_DEFAULTS };
    for (const row of settingRows) {
      if (typeof row.value === 'string' && row.value.trim().length > 0) {
        settings[row.key] = row.value.trim().slice(0, SETTING_VALUE_MAX);
      }
    }

    return json(cacheable(res, CACHE_CONTROL), 200, {
      ok: true,
      clients: clientRows.map((row) => toClient(req, row)),
      settings,
    });
  } catch (error) {
    console.error('[content] public read failed', error);
    // The build treats any non-2xx as "use the committed snapshot", so a 500 here is a warning in
    // the build log and nothing more. Say nothing about the cause: this response is public.
    return json(res, 500, { ok: false, error: 'server' });
  }
}
