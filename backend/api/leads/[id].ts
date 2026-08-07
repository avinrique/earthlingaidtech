/**
 * PATCH  /api/leads/<id>  admin — update status and/or notes
 * DELETE /api/leads/<id>  admin — remove a lead
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

import { requireAuth } from '../../lib/auth.js';
import { isLeadStatus, sql, type Lead } from '../../lib/db.js';
import { applyCors, json, methodNotAllowed, readJsonBody } from '../../lib/http.js';

const NOTES_MAX = 5000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (requireAuth(req, res)) return;

  const raw = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    return json(res, 400, { ok: false, error: 'bad_id' });
  }

  if (req.method === 'PATCH') return updateLead(req, res, id);
  if (req.method === 'DELETE') return deleteLead(res, id);
  return methodNotAllowed(res, ['PATCH', 'DELETE', 'OPTIONS']);
}

async function updateLead(req: VercelRequest, res: VercelResponse, id: number) {
  const body = readJsonBody(req);

  // `undefined` means "leave alone"; the coalesce in SQL relies on that distinction, so an
  // omitted field is not the same as an explicitly cleared one.
  let status: string | null = null;
  if (body.status !== undefined) {
    if (!isLeadStatus(body.status)) {
      return json(res, 400, { ok: false, error: 'validation', fields: { status: 'Unknown status.' } });
    }
    status = body.status;
  }

  let notes: string | null = null;
  let notesProvided = false;
  if (body.notes !== undefined) {
    if (typeof body.notes !== 'string') {
      return json(res, 400, { ok: false, error: 'validation', fields: { notes: 'Notes must be text.' } });
    }
    notesProvided = true;
    const trimmed = body.notes.replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ').slice(0, NOTES_MAX);
    notes = trimmed.trim().length > 0 ? trimmed : null;
  }

  if (status === null && !notesProvided) {
    return json(res, 400, { ok: false, error: 'validation', fields: { _: 'Nothing to update.' } });
  }

  try {
    const rows = (await sql`
      update leads
      set status = coalesce(${status}::text, status),
          notes  = case when ${notesProvided}::boolean then ${notes}::text else notes end
      where id = ${id}
      returning id, created_at, updated_at, name, email, company, phone,
                service, budget, message, source, status, notes
    `) as Lead[];

    const lead = rows[0];
    if (!lead) return json(res, 404, { ok: false, error: 'not_found' });

    return json(res, 200, { ok: true, lead });
  } catch (error) {
    console.error(`[leads] update ${id} failed`, error);
    return json(res, 500, { ok: false, error: 'server' });
  }
}

async function deleteLead(res: VercelResponse, id: number) {
  try {
    const rows = (await sql`delete from leads where id = ${id} returning id`) as Array<{ id: number }>;
    if (rows.length === 0) return json(res, 404, { ok: false, error: 'not_found' });
    return json(res, 200, { ok: true });
  } catch (error) {
    console.error(`[leads] delete ${id} failed`, error);
    return json(res, 500, { ok: false, error: 'server' });
  }
}
