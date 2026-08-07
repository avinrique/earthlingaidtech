/**
 * Rate limiting backed by Postgres.
 *
 * A Vercel function's memory does not survive between invocations, so an in-process counter would
 * reset constantly and enforce nothing. The database is the only shared state we have, and at lead
 * volume the extra round trip is irrelevant.
 */

import { sql } from './db.js';

export type Bucket = 'lead' | 'login';

interface Rule {
  limit: number;
  windowMinutes: number;
}

const RULES: Record<Bucket, Rule> = {
  // Generous: a real person retrying a failing form must not be locked out.
  lead: { limit: 5, windowMinutes: 60 },
  // Tight: this is the only thing standing in front of the admin password.
  login: { limit: 8, windowMinutes: 15 },
};

/**
 * Records the attempt and reports whether the caller is over the limit.
 * Fails OPEN: if the database is unreachable we would rather accept a lead than lose one.
 */
export async function hitLimit(bucket: Bucket, key: string): Promise<boolean> {
  const rule = RULES[bucket];
  try {
    const rows = (await sql`
      with recorded as (
        insert into rate_events (bucket, key) values (${bucket}, ${key}) returning created_at
      )
      select count(*)::int as hits
      from rate_events
      where bucket = ${bucket}
        and key = ${key}
        and created_at > now() - make_interval(mins => ${rule.windowMinutes})
    `) as Array<{ hits: number }>;

    return (rows[0]?.hits ?? 0) > rule.limit;
  } catch {
    return false;
  }
}

/**
 * Drop expired rows. Called opportunistically from the lead endpoint rather than on a schedule —
 * the table is tiny and this keeps the deployment to one moving part.
 */
export async function pruneRateEvents(): Promise<void> {
  try {
    await sql`delete from rate_events where created_at < now() - interval '24 hours'`;
  } catch {
    // Housekeeping only; never fail a request over it.
  }
}
