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
 * The Origin header is never reflected blindly — with `credentials: include` on the other end,
 * reflecting an arbitrary origin would let any site on the internet read authenticated responses.
 * Unknown origins simply get no CORS header, and the browser blocks the read.
 *
 * Returns true if the request was a preflight and has been fully answered.
 */
export function applyCors(req: VercelRequest, res: VercelResponse): boolean {
  const origin = req.headers.origin;

  // Vary matters: a cached response for one origin must not be served to another.
  res.setHeader('Vary', 'Origin');

  if (typeof origin === 'string' && env.allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
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
 * A stable, non-reversible client identifier for rate limiting.
 *
 * The raw IP is never stored. x-forwarded-for is attacker-controllable in general, but on Vercel
 * the platform sets it, and we take only the first hop.
 */
export function clientKey(req: VercelRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const ip = (raw ?? '').split(',')[0]?.trim() || 'unknown';
  return createHash('sha256').update(`${env.ipSalt}:${ip}`).digest('hex').slice(0, 32);
}

export function userAgent(req: VercelRequest): string {
  const ua = req.headers['user-agent'];
  return (Array.isArray(ua) ? ua[0] : ua ?? '').slice(0, 500);
}
