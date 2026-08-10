/**
 * /api/auth/login | /api/auth/logout | /api/auth/session
 *
 * These began as three files. They are one because Vercel's Hobby plan caps a deployment at 12
 * Serverless Functions and every file under api/ is a function — a limit you discover by having a
 * deploy rejected, not from the code. Merging the three smallest, most closely related handlers
 * buys headroom without collapsing anything that deserves its own module.
 *
 * The public URLs are unchanged, so the console needs no edit.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

import { checkPassword, clearSession, isAuthed, issueSession } from '../../lib/auth.js';
import { applyCors, clientKey, json, methodNotAllowed, readJsonBody } from '../../lib/http.js';
import { hitLimit } from '../../lib/ratelimit.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;

  const raw = Array.isArray(req.query.action) ? req.query.action[0] : req.query.action;

  switch (raw) {
    case 'login':
      return login(req, res);
    case 'logout':
      return logout(req, res);
    case 'session':
      return session(req, res);
    default:
      return json(res, 404, { ok: false, error: 'not_found' });
  }
}

async function login(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST', 'OPTIONS']);

  // Rate limited before the password is even looked at — this endpoint is the only thing between
  // the internet and the lead database, so brute force has to be expensive.
  if (await hitLimit('login', clientKey(req))) {
    return json(res, 429, { ok: false, error: 'rate_limited' });
  }

  const { password } = readJsonBody(req);
  if (!checkPassword(password)) {
    // No distinction between "no password sent" and "wrong password".
    return json(res, 401, { ok: false, error: 'invalid' });
  }

  issueSession(res);
  return json(res, 200, { ok: true });
}

function logout(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST', 'OPTIONS']);

  // Unconditional: logging out when already logged out is not an error.
  clearSession(res);
  return json(res, 200, { ok: true });
}

function session(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET', 'OPTIONS']);

  return json(res, 200, { ok: true, authed: isAuthed(req) });
}
