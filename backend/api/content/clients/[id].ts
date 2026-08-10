/**
 * PATCH  /api/content/clients/<id> — admin. Edit any field, including visibility and position.
 * DELETE /api/content/clients/<id> — admin. Remove the row and its logo for good.
 *
 * PATCH is a genuine partial update: an omitted key means "leave this alone", and `null` means
 * "clear it". Those are different intentions and the SQL below keeps them different — a note the
 * operator never touched must survive an edit that only changed the name, and a note they deleted
 * must actually go. The `coalesce` / `case when …provided` pair is the same pattern api/leads/[id].ts
 * uses, for the same reason: one statement, no read-modify-write race between two console tabs.
 *
 * Deleting is deliberately available but rarely the right verb — `active: false` hides a client
 * while keeping its logo and position, so the console offers that first. DELETE exists for the
 * genuine mistake (a row added twice, a name typed into the wrong form).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

import { requireAuth } from '../../../lib/auth.js';
import { sql } from '../../../lib/db.js';
import { applyCors, json, methodNotAllowed, readJsonBody } from '../../../lib/http.js';
import { isDuplicateName, readName, readNote, readUrl, toClient, type ClientRow } from '../index.js';

/**
 * Positions are set by the console dragging rows around, not typed in. The ceiling exists only so a
 * malformed request cannot store an absurd integer that then sorts unpredictably against the rest.
 */
const SORT_ORDER_MAX = 100_000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (requireAuth(req, res)) return;

  const raw = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    return json(res, 400, { ok: false, error: 'bad_id' });
  }

  if (req.method === 'PATCH') return updateClient(req, res, id);
  if (req.method === 'DELETE') return deleteClient(res, id);
  return methodNotAllowed(res, ['PATCH', 'DELETE', 'OPTIONS']);
}

async function updateClient(req: VercelRequest, res: VercelResponse, id: number) {
  const body = readJsonBody(req);
  const fields: Record<string, string> = {};

  // `undefined` (the key was absent) is the "leave alone" signal throughout. Note the asymmetry:
  // name has no null form — a client without a name cannot be rendered — while note and url do.
  let name: string | null = null;
  if (body.name !== undefined) {
    const result = readName(body.name);
    if (!result.ok) fields.name = result.error;
    else name = result.value;
  }

  let note: string | null = null;
  let noteProvided = false;
  if (body.note !== undefined) {
    const result = readNote(body.note);
    if (!result.ok) fields.note = result.error;
    else {
      noteProvided = true;
      note = result.value;
    }
  }

  let url: string | null = null;
  let urlProvided = false;
  if (body.url !== undefined) {
    const result = readUrl(body.url);
    if (!result.ok) fields.url = result.error;
    else {
      urlProvided = true;
      url = result.value;
    }
  }

  let active: boolean | null = null;
  if (body.active !== undefined) {
    if (typeof body.active !== 'boolean') fields.active = 'Visibility must be true or false.';
    else active = body.active;
  }

  let sortOrder: number | null = null;
  if (body.sort_order !== undefined) {
    const n = Number(body.sort_order);
    if (!Number.isInteger(n) || n < 0 || n > SORT_ORDER_MAX) {
      fields.sort_order = 'Position must be a whole number.';
    } else {
      sortOrder = n;
    }
  }

  if (Object.keys(fields).length > 0) {
    return json(res, 400, { ok: false, error: 'validation', fields });
  }
  if (name === null && !noteProvided && !urlProvided && active === null && sortOrder === null) {
    return json(res, 400, { ok: false, error: 'validation', fields: { _: 'Nothing to update.' } });
  }

  try {
    // Every value is a bound parameter; the explicit casts are what let one statement serve all
    // thirty-one combinations of supplied fields without building SQL by hand. updated_at is left
    // to the content_clients_set_updated_at trigger rather than set here, so it stays correct for
    // writes that do not go through this route (the logo upload, a manual fix in psql).
    const rows = (await sql`
      update content_clients
      set name       = coalesce(${name}::text, name),
          note       = case when ${noteProvided}::boolean then ${note}::text else note end,
          url        = case when ${urlProvided}::boolean then ${url}::text else url end,
          active     = coalesce(${active}::boolean, active),
          sort_order = coalesce(${sortOrder}::int, sort_order)
      where id = ${id}
      returning id::int as id, name, note, url, sort_order::int as sort_order, active,
                (logo_bytes is not null) as has_logo, logo_updated_at
    `) as ClientRow[];

    const row = rows[0];
    if (!row) return json(res, 404, { ok: false, error: 'not_found' });

    return json(res, 200, { ok: true, client: toClient(req, row) });
  } catch (error) {
    if (isDuplicateName(error)) {
      return json(res, 409, {
        ok: false,
        error: 'validation',
        fields: { name: 'There is already a client with that name.' },
      });
    }
    console.error(`[content] client update ${id} failed`, error);
    return json(res, 500, { ok: false, error: 'server' });
  }
}

async function deleteClient(res: VercelResponse, id: number) {
  try {
    // The logo goes with the row: the bytes are a column, not a file in a bucket, so there is no
    // orphan to clean up afterwards. That is the main reason logos live in Postgres at this size.
    const rows = (await sql`
      delete from content_clients where id = ${id} returning id::int as id
    `) as Array<{ id: number }>;

    if (rows.length === 0) return json(res, 404, { ok: false, error: 'not_found' });
    return json(res, 200, { ok: true });
  } catch (error) {
    console.error(`[content] client delete ${id} failed`, error);
    return json(res, 500, { ok: false, error: 'server' });
  }
}
