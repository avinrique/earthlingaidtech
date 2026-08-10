/**
 * GET  /api/content/clients — admin. Every client, active or not, in display order.
 * POST /api/content/clients — admin. Add one.
 *
 * The public payload (GET /api/content) hides inactive clients; the console must see them, because
 * "hidden" is how a client is retired here — a soft delete that keeps the row, its logo and its
 * position, so putting one back is a toggle rather than a re-upload. That difference is the only
 * reason this route exists separately from the public one.
 *
 * Logos are not part of either verb. A client has to exist before its logo has somewhere to go, so
 * the console creates the row first and uploads to POST .../<id>/logo second.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

import { requireAuth } from '../../../lib/auth.js';
import { sql } from '../../../lib/db.js';
import { applyCors, json, methodNotAllowed, readJsonBody } from '../../../lib/http.js';
import { isDuplicateName, readName, readNote, readUrl, toClient, type ClientRow } from '../index.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (requireAuth(req, res)) return;

  if (req.method === 'GET') return listClients(req, res);
  if (req.method === 'POST') return createClient(req, res);
  return methodNotAllowed(res, ['GET', 'POST', 'OPTIONS']);
}

async function listClients(req: VercelRequest, res: VercelResponse) {
  try {
    // Same ordering as the public route, and the same deliberate omission of logo_bytes: the
    // console renders logos through <img src="/api/media/client/…">, so shipping the bytes inside
    // this JSON would mean sending every logo twice on every list refresh.
    const rows = (await sql`
      select id::int as id, name, note, url, sort_order::int as sort_order, active,
             (logo_bytes is not null) as has_logo, logo_updated_at
      from content_clients
      order by sort_order, id
    `) as ClientRow[];

    return json(res, 200, { ok: true, clients: rows.map((row) => toClient(req, row)) });
  } catch (error) {
    console.error('[content] client list failed', error);
    return json(res, 500, { ok: false, error: 'server' });
  }
}

async function createClient(req: VercelRequest, res: VercelResponse) {
  const body = readJsonBody(req);

  const name = readName(body.name);
  const note = readNote(body.note);
  const url = readUrl(body.url);

  // Collect every field error before answering. One round trip per typo is a miserable way to fill
  // in a three-field form.
  const fields: Record<string, string> = {};
  if (!name.ok) fields.name = name.error;
  if (!note.ok) fields.note = note.error;
  if (!url.ok) fields.url = url.error;
  if (!name.ok || !note.ok || !url.ok) {
    return json(res, 400, { ok: false, error: 'validation', fields });
  }

  try {
    // sort_order is assigned server-side as "one past the current last", so a new client lands at
    // the end of the marquee instead of colliding with an existing position. Computing it inside
    // the insert keeps it a single statement — a read-then-write would race two console tabs into
    // the same slot.
    const rows = (await sql`
      insert into content_clients (name, note, url, sort_order)
      select ${name.value}, ${note.value}, ${url.value}, coalesce(max(sort_order), -1) + 1
      from content_clients
      returning id::int as id, name, note, url, sort_order::int as sort_order, active,
                (logo_bytes is not null) as has_logo, logo_updated_at
    `) as ClientRow[];

    const row = rows[0];
    if (!row) {
      console.error('[content] client insert returned no row');
      return json(res, 500, { ok: false, error: 'server' });
    }

    return json(res, 201, { ok: true, client: toClient(req, row) });
  } catch (error) {
    if (isDuplicateName(error)) {
      return json(res, 409, {
        ok: false,
        error: 'validation',
        fields: { name: 'There is already a client with that name.' },
      });
    }
    console.error('[content] client insert failed', error);
    return json(res, 500, { ok: false, error: 'server' });
  }
}
