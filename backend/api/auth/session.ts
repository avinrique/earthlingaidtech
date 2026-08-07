/** GET /api/auth/session — lets the dashboard decide whether to show login or leads. */

import type { VercelRequest, VercelResponse } from '@vercel/node';

import { isAuthed } from '../../lib/auth.js';
import { applyCors, json, methodNotAllowed } from '../../lib/http.js';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET', 'OPTIONS']);

  return json(res, 200, { ok: true, authed: isAuthed(req) });
}
