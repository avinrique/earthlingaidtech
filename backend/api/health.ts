/**
 * GET /api/health — is the service up and can it reach the database?
 *
 * Public on purpose, so it can be curled from anywhere during a deploy. It reveals nothing beyond
 * up/down and the commit sha.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

import { healthy } from '../lib/db.js';
import { applyCors, json, methodNotAllowed } from '../lib/http.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET', 'OPTIONS']);

  const { env } = await import('../lib/env.js');
  const db = await healthy();

  return json(res, db ? 200 : 503, { ok: true, db, version: env.version });
}
