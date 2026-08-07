/** POST /api/auth/login — exchange the admin password for a session cookie. */

import type { VercelRequest, VercelResponse } from '@vercel/node';

import { checkPassword, issueSession } from '../../lib/auth.js';
import { applyCors, clientKey, json, methodNotAllowed, readJsonBody } from '../../lib/http.js';
import { hitLimit } from '../../lib/ratelimit.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
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
