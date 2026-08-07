/**
 * Admin session handling.
 *
 * One operator, one password, so there is no user table — just a signed cookie. The cookie carries
 * an expiry and an HMAC over it; without SESSION_SECRET it cannot be forged, and because the
 * payload is signed rather than encrypted we keep nothing sensitive in it.
 */

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';

import { env } from './env.js';

const COOKIE = 'eat_admin';
const TTL_MS = 12 * 60 * 60 * 1000; // 12h — long enough for a working day, short enough to matter

function sign(payload: string): string {
  return createHmac('sha256', env.sessionSecret).update(payload).digest('base64url');
}

/** Constant-time compare that does not leak length through an early return. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Still burn a comparison so the timing of a length mismatch matches a value mismatch.
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

export function checkPassword(candidate: unknown): boolean {
  if (typeof candidate !== 'string' || candidate.length === 0) return false;
  return safeEqual(candidate, env.adminPassword);
}

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

export function issueSession(res: VercelResponse): void {
  const expires = Date.now() + TTL_MS;
  // The nonce makes two sessions issued in the same millisecond distinguishable.
  const payload = `${expires}.${randomBytes(9).toString('base64url')}`;
  const token = `${payload}.${sign(payload)}`;

  const attrs = [
    `${COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${Math.floor(TTL_MS / 1000)}`,
  ];
  // Secure would make the cookie unusable over plain http on localhost during `vercel dev`.
  if (env.isProduction) attrs.push('Secure');

  res.setHeader('Set-Cookie', attrs.join('; '));
}

export function clearSession(res: VercelResponse): void {
  const attrs = [`${COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Strict', 'Max-Age=0'];
  if (env.isProduction) attrs.push('Secure');
  res.setHeader('Set-Cookie', attrs.join('; '));
}

export function isAuthed(req: VercelRequest): boolean {
  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (!token) return false;

  const lastDot = token.lastIndexOf('.');
  if (lastDot < 0) return false;

  const payload = token.slice(0, lastDot);
  const signature = token.slice(lastDot + 1);
  if (!safeEqual(signature, sign(payload))) return false;

  const expires = Number(payload.split('.')[0]);
  return Number.isFinite(expires) && expires > Date.now();
}

/** Guard for admin endpoints. Returns true when the caller has been rejected. */
export function requireAuth(req: VercelRequest, res: VercelResponse): boolean {
  if (isAuthed(req)) return false;
  res.status(401).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.send(JSON.stringify({ ok: false, error: 'unauthorized' }));
  return true;
}
