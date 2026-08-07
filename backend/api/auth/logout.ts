/** POST /api/auth/logout — clear the session cookie. */

import type { VercelRequest, VercelResponse } from '@vercel/node';

import { clearSession } from '../../lib/auth.js';
import { applyCors, json, methodNotAllowed } from '../../lib/http.js';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST', 'OPTIONS']);

  // Unconditional: logging out when already logged out is not an error.
  clearSession(res);
  return json(res, 200, { ok: true });
}
