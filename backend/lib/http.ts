/**
 * Request/response plumbing shared by every function: CORS, JSON replies, body parsing,
 * and client identification.
 */

import { createHash } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';

import { env } from './env.js';

/**
 * Apply CORS for a strict allowlist.
 *
 * The Origin header is never reflected blindly — reflecting an arbitrary origin would let any site
 * on the internet drive this API from a visitor's browser. Unknown origins simply get no CORS
 * header, and the browser blocks the read.
 *
 * SECURITY — no credentials, ever.
 * The only cross-origin caller is the marketing site's enquiry form, and it POSTs anonymously.
 * The dashboard is served from this same project, so its calls are same-origin and CORS does not
 * apply to them at all. Sending `Access-Control-Allow-Credentials: true` would be actively
 * dangerous here: earthlingaidtech.com and api.earthlingaidtech.com share a registrable domain, so
 * SameSite=Strict considers them the same site and DOES send the eat_admin cookie between them.
 * Combined with an allow-listed origin plus credentials, any script running on the marketing site
 * — an XSS, a compromised analytics tag, a hijacked GitHub Pages deploy — could read the entire
 * lead database and issue DELETEs with the operator's session. Withholding the header means the
 * browser refuses those cross-origin reads and blocks the PATCH/DELETE preflight outright.
 *
 * Returns true if the request was a preflight and has been fully answered.
 */
export function applyCors(req: VercelRequest, res: VercelResponse): boolean {
  const origin = req.headers.origin;

  // Vary matters: a cached response for one origin must not be served to another.
  res.setHeader('Vary', 'Origin');

  if (typeof origin === 'string' && env.allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    // Only the public lead POST is meant to be reachable cross-origin. The admin verbs are
    // deliberately absent so a preflight for them fails.
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400');
  }

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}

export function json(res: VercelResponse, status: number, body: unknown): void {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.send(JSON.stringify(body));
}

export function methodNotAllowed(res: VercelResponse, allowed: string[]): void {
  res.setHeader('Allow', allowed.join(', '));
  json(res, 405, { ok: false, error: 'method_not_allowed' });
}

/**
 * Vercel usually parses JSON bodies for us, but not when the content-type is missing or odd —
 * so handle both shapes rather than trusting one.
 */
export function readJsonBody(req: VercelRequest): Record<string, unknown> {
  const body = req.body;
  if (!body) return {};
  if (typeof body === 'object' && !Array.isArray(body)) return body as Record<string, unknown>;
  if (typeof body === 'string') {
    try {
      const parsed: unknown = JSON.parse(body);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  return {};
}

/**
 * A stable, non-reversible client identifier for rate limiting. The raw IP is never stored.
 *
 * SECURITY — never trust the FIRST hop of x-forwarded-for.
 * X-Forwarded-For is a header the client can set and proxies APPEND to, so its leftmost entry is
 * whatever the caller typed. Keying the limiter on it makes every limit in this service bypassable
 * with one extra request header — including the login limiter, which is the only thing in front of
 * ADMIN_PASSWORD. We prefer headers only the platform can set, and when we do fall back to
 * x-forwarded-for we take the LAST hop: the one the trusted proxy appended.
 */
export function clientKey(req: VercelRequest): string {
  return createHash('sha256').update(`${env.ipSalt}:${clientIp(req)}`).digest('hex').slice(0, 32);
}

function header(req: VercelRequest, name: string): string {
  const raw = req.headers[name];
  return ((Array.isArray(raw) ? raw[0] : raw) ?? '').trim();
}

function clientIp(req: VercelRequest): string {
  // Order matters. The last hop of the forwarding chain is the entry the platform edge appended,
  // so it is the one value here a caller cannot choose. x-real-ip is only a fallback: Vercel sets
  // it, but if it ever did not, a client-sent header would be trusted — so it must not win.
  const chain = header(req, 'x-vercel-forwarded-for') || header(req, 'x-forwarded-for');
  const hops = chain.split(',').map((h) => h.trim()).filter(Boolean);
  const ip = hops[hops.length - 1] || header(req, 'x-real-ip') || '';
  return ip ? normaliseIp(ip) : 'unknown';
}

/**
 * Collapse an address to the unit a limit should apply to.
 *
 * IPv4 is used as-is. IPv6 is truncated to its /64 prefix, because a single subscriber is routinely
 * handed an entire /64 — limiting on the full 128-bit address limits nothing at all.
 */
function normaliseIp(ip: string): string {
  const bare = ip.replace(/^\[/, '').replace(/\]$/, '').replace(/%.*$/, '').toLowerCase();
  // No colon (IPv4) or a dotted tail (IPv4-mapped): treat as a single host.
  if (!bare.includes(':') || bare.includes('.')) return bare.slice(0, 45);

  const [head = '', tail = ''] = bare.split('::');
  const headGroups = head ? head.split(':').filter(Boolean) : [];
  const tailGroups = tail ? tail.split(':').filter(Boolean) : [];
  const gap = bare.includes('::') ? Math.max(0, 8 - headGroups.length - tailGroups.length) : 0;
  const groups = [...headGroups, ...Array(gap).fill('0'), ...tailGroups];

  return `${groups.slice(0, 4).map((g) => g.padStart(4, '0')).join(':')}::/64`;
}

export function userAgent(req: VercelRequest): string {
  const ua = req.headers['user-agent'];
  return (Array.isArray(ua) ? ua[0] : ua ?? '').slice(0, 500);
}
