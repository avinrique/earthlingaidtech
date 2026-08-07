/**
 * POST /api/leads   public  — capture an enquiry from the marketing site
 * GET  /api/leads   admin   — list, filter and search for the dashboard
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

import { requireAuth } from '../../lib/auth.js';
import { isLeadStatus, sql, type Lead } from '../../lib/db.js';
import { applyCors, clientKey, json, methodNotAllowed, readJsonBody, userAgent } from '../../lib/http.js';
import { notifyNewLead } from '../../lib/mailer.js';
import { GLOBAL, hitLimit, pruneRateEvents } from '../../lib/ratelimit.js';
import { looksAutomated, validateLead } from '../../lib/validate.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;

  if (req.method === 'POST') return createLead(req, res);
  if (req.method === 'GET') return listLeads(req, res);
  return methodNotAllowed(res, ['GET', 'POST', 'OPTIONS']);
}

async function createLead(req: VercelRequest, res: VercelResponse) {
  const body = readJsonBody(req);

  // Silently accept and discard obvious bots. Returning success denies them the feedback they
  // would need to tune around the check, and costs a real user nothing.
  if (looksAutomated(body)) {
    return json(res, 200, { ok: true, id: 0 });
  }

  const { ok, fields, value } = validateLead(body);
  if (!ok) {
    return json(res, 400, { ok: false, error: 'validation', fields });
  }

  const key = clientKey(req);
  if (await hitLimit('lead', key)) {
    return json(res, 429, { ok: false, error: 'rate_limited' });
  }

  let id: number;
  try {
    const rows = (await sql`
      insert into leads (name, email, company, phone, service, budget, message, source, ip_hash, user_agent)
      values (${value.name}, ${value.email}, ${value.company}, ${value.phone}, ${value.service},
              ${value.budget}, ${value.message}, ${value.source}, ${key}, ${userAgent(req)})
      returning id::int as id
    `) as Array<{ id: number }>;
    id = rows[0]!.id;
  } catch (error) {
    console.error('[leads] insert failed', error);
    return json(res, 500, { ok: false, error: 'server' });
  }

  // The lead is safely stored. From here nothing may fail the request: a bounced notification is
  // an inconvenience, a rejected enquiry is a lost customer.
  //
  // The per-IP limit above does not bound a distributed flood, and every notification is a real
  // SMTP send from the business mailbox. The global hourly mail budget caps that separately —
  // when it is exhausted the lead is still stored and still visible in the dashboard, we simply
  // stop mailing, so the spam run cannot burn the sending domain or bury the real enquiries.
  if (await hitLimit('notify', GLOBAL)) {
    console.warn(`[leads] lead ${id} stored; notification skipped — hourly mail budget exhausted`);
  } else {
    const notified = await notifyNewLead(id, value);
    if (!notified.sent) {
      console.error(`[leads] lead ${id} stored but notification failed: ${notified.error}`);
    }
  }

  void pruneRateEvents();

  return json(res, 200, { ok: true, id });
}

async function listLeads(req: VercelRequest, res: VercelResponse) {
  if (requireAuth(req, res)) return;

  const statusParam = first(req.query.status);
  const status = isLeadStatus(statusParam) ? statusParam : null;

  const q = (first(req.query.q) ?? '').trim().slice(0, 100);
  const search = q ? `%${q}%` : null;

  const limit = clampInt(first(req.query.limit), 25, 1, 200);
  const offset = clampInt(first(req.query.offset), 0, 0, 100_000);

  try {
    // Parameterised throughout — `status` and `search` are values, never concatenated SQL. The
    // `is null` guards let one query serve the filtered and unfiltered cases.
    const leads = (await sql`
      select id::int as id, created_at, updated_at, name, email, company, phone,
             service, budget, message, source, status, notes
      from leads
      where (${status}::text is null or status = ${status})
        and (${search}::text is null
             or name ilike ${search}
             or email ilike ${search}
             or coalesce(company, '') ilike ${search}
             or message ilike ${search})
      order by created_at desc
      limit ${limit} offset ${offset}
    `) as Lead[];

    const totals = (await sql`
      select count(*)::int as total
      from leads
      where (${status}::text is null or status = ${status})
        and (${search}::text is null
             or name ilike ${search}
             or email ilike ${search}
             or coalesce(company, '') ilike ${search}
             or message ilike ${search})
    `) as Array<{ total: number }>;

    // Counts are always across all statuses, so the filter tabs keep showing the full picture.
    const grouped = (await sql`
      select status, count(*)::int as n from leads group by status
    `) as Array<{ status: string; n: number }>;

    const counts = { new: 0, contacted: 0, qualified: 0, won: 0, lost: 0 };
    for (const row of grouped) {
      if (row.status in counts) counts[row.status as keyof typeof counts] = row.n;
    }

    return json(res, 200, { ok: true, leads, total: totals[0]?.total ?? 0, counts });
  } catch (error) {
    console.error('[leads] list failed', error);
    return json(res, 500, { ok: false, error: 'server' });
  }
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function clampInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}
