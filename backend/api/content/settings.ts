/**
 * PATCH /api/content/settings — admin. Update one or more of the site's headline numbers.
 *
 * The body is the map itself — `{ "students_trained": "1.8k+" }` — not a list of operations, so the
 * console can send one field on blur or all of them on save with the same call. Keys that are not
 * in the request are untouched.
 *
 * WHY THE KEYS ARE A FIXED WHITELIST
 * These values are not data the site looks up; they are values `src/data/site.ts` reads by name.
 * A key nothing reads is a number the operator will edit, publish, and then not see change — the
 * most confusing possible outcome. Rejecting unknown keys turns that silent nothing into an error
 * at the moment of typing. The whitelist is SETTING_DEFAULTS in ./index.ts, which is also where the
 * public payload gets its fallbacks, so there is one list rather than two that can disagree.
 *
 * WHY VALUES ARE TEXT
 * "1.7k+" and "1,700+" are the same quantity written for two different places on the page. They are
 * editorial strings, not numbers to compute with, and storing them as text is what lets Abhinav
 * write "15+" rather than fighting a number input over the plus sign.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

import { requireAuth } from '../../lib/auth.js';
import { sql } from '../../lib/db.js';
import { applyCors, json, methodNotAllowed, readJsonBody } from '../../lib/http.js';
import { cleanLine, SETTING_DEFAULTS, SETTING_VALUE_MAX } from './index.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (requireAuth(req, res)) return;
  if (req.method !== 'PATCH') return methodNotAllowed(res, ['PATCH', 'OPTIONS']);

  const body = readJsonBody(req);
  const fields: Record<string, string> = {};
  const keys: string[] = [];
  const values: string[] = [];

  for (const [key, raw] of Object.entries(body)) {
    if (!Object.prototype.hasOwnProperty.call(SETTING_DEFAULTS, key)) {
      fields[key] = 'That is not a setting this site reads.';
      continue;
    }

    // A number is a reasonable thing for a client to send for "7"; anything else has to be a string.
    const text = cleanLine(typeof raw === 'number' && Number.isFinite(raw) ? String(raw) : raw, SETTING_VALUE_MAX + 1);

    if (text.length === 0) {
      // Blanking a stat tile is never the intent — it renders as an empty box on the live site.
      // Hiding the tile is a code change, not a content edit.
      fields[key] = 'This cannot be empty.';
      continue;
    }
    if (text.length > SETTING_VALUE_MAX) {
      fields[key] = `Keep it to ${SETTING_VALUE_MAX} characters — it has to fit in a stat tile.`;
      continue;
    }

    keys.push(key);
    values.push(text);
  }

  if (Object.keys(fields).length > 0) {
    return json(res, 400, { ok: false, error: 'validation', fields });
  }
  if (keys.length === 0) {
    return json(res, 400, { ok: false, error: 'validation', fields: { _: 'Nothing to update.' } });
  }

  try {
    // One statement for the whole map rather than a loop of upserts: the console can send five keys
    // at once, and five sequential round trips to Neon would be both slower and partially
    // applicable — an edit that half-saved is worse than one that failed. `unnest` pairs the two
    // arrays into rows; both arrays are bound parameters, so nothing here is built from input text.
    await sql`
      insert into content_settings (key, value)
      select k, v from unnest(${keys}::text[], ${values}::text[]) as t(k, v)
      on conflict (key) do update set value = excluded.value
    `;

    // Read back the full map rather than echoing what was sent. The console renders this straight
    // into its inputs, and it should show what the database now holds — including keys this request
    // did not touch and any value the seed set that the operator has never edited.
    const rows = (await sql`select key, value from content_settings`) as Array<{
      key: string;
      value: string;
    }>;

    const settings: Record<string, string> = { ...SETTING_DEFAULTS };
    for (const row of rows) {
      if (typeof row.value === 'string' && row.value.trim().length > 0) {
        settings[row.key] = row.value.trim();
      }
    }

    return json(res, 200, { ok: true, settings });
  } catch (error) {
    console.error('[content] settings update failed', error);
    return json(res, 500, { ok: false, error: 'server' });
  }
}
