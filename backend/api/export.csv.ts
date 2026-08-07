/**
 * GET /api/export.csv — admin. Same filters as GET /api/leads, delivered as a spreadsheet.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

import { requireAuth } from '../lib/auth.js';
import { isLeadStatus, sql, type Lead } from '../lib/db.js';
import { applyCors, methodNotAllowed } from '../lib/http.js';

/**
 * Quote a CSV field.
 *
 * The leading apostrophe on =, +, - and @ is not cosmetic: without it a lead can submit a name
 * like `=HYPERLINK(...)` and have Excel execute it when Abhinav opens the export. That is CSV
 * injection, and the export is exactly the path an attacker would aim at.
 */
function cell(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value);
  // Test past any leading whitespace: spreadsheets trim it before deciding a cell is a formula, so
  // `  =HYPERLINK(...)` sails through a check anchored at index 0. `|` is included because
  // `|'/C calc'!A0` is the classic DDE payload, which Excel treats as executable just like `=`.
  const guarded = /^[\s]*[=+\-@|\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${guarded.replace(/"/g, '""')}"`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET', 'OPTIONS']);
  if (requireAuth(req, res)) return;

  const statusParam = Array.isArray(req.query.status) ? req.query.status[0] : req.query.status;
  const status = isLeadStatus(statusParam) ? statusParam : null;

  const rawQ = Array.isArray(req.query.q) ? req.query.q[0] : req.query.q;
  const q = (rawQ ?? '').trim().slice(0, 100);
  const search = q ? `%${q}%` : null;

  try {
    const leads = (await sql`
      select id, created_at, updated_at, name, email, company, phone,
             service, budget, message, source, status, notes
      from leads
      where (${status}::text is null or status = ${status})
        and (${search}::text is null
             or name ilike ${search}
             or email ilike ${search}
             or coalesce(company, '') ilike ${search}
             or message ilike ${search})
      order by created_at desc
      limit 5000
    `) as Lead[];

    const header = [
      'id', 'created_at', 'status', 'name', 'email', 'company', 'phone',
      'service', 'budget', 'source', 'message', 'notes',
    ];

    const rows = leads.map((l) =>
      [
        l.id, l.created_at, l.status, l.name, l.email, l.company, l.phone,
        l.service, l.budget, l.source, l.message, l.notes,
      ].map(cell).join(','),
    );

    // BOM so Excel opens UTF-8 names correctly rather than as mojibake.
    const csv = '﻿' + [header.map(cell).join(','), ...rows].join('\r\n');
    const stamp = new Date().toISOString().slice(0, 10);

    res.status(200);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="leads-${stamp}.csv"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(csv);
  } catch (error) {
    console.error('[leads] export failed', error);
    res.status(500).send('export failed');
  }
}
