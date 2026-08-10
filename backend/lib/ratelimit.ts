/**
 * Rate limiting backed by Postgres.
 *
 * A Vercel function's memory does not survive between invocations, so an in-process counter would
 * reset constantly and enforce nothing. The database is the only shared state we have, and at lead
 * volume the extra round trip is irrelevant.
 */

import { sql } from './db.js';

export type Bucket = 'lead' | 'login' | 'notify' | 'publish';

/** Key for a limit that is global rather than per-client. */
export const GLOBAL = 'all';

interface Rule {
  limit: number;
  windowMinutes: number;
}

const RULES: Record<Bucket, Rule> = {
  // Generous: a real person retrying a failing form must not be locked out.
  lead: { limit: 5, windowMinutes: 60 },
  // Tight: this is the only thing standing in front of the admin password.
  login: { limit: 8, windowMinutes: 15 },
  /**
   * GLOBAL ceiling on outbound notification mail, deliberately not keyed by client.
   *
   * The per-IP `lead` rule bounds one attacker on one address. It bounds nothing for a botnet, or
   * for anyone with a residential proxy pool or a single IPv6 /48 — and every accepted lead sends
   * SMTP through the real services@ mailbox, so unbounded leads means an unbounded mail bill, a
   * flooded inbox and a burnt sender reputation on the domain the business runs on. This caps the
   * blast radius at something a human could still read.
   *
   * Exceeding it never rejects the lead: the row is already committed and only the email is
   * skipped, so an attacker cannot use this bucket to stop real enquiries arriving.
   */
  notify: { limit: 60, windowMinutes: 60 },
  /**
   * GLOBAL ceiling on site rebuilds, deliberately not keyed by client.
   *
   * Publishing fans out into a full GitHub Actions run: checkout, npm install, Astro build, Pages
   * deploy. It is the most expensive thing this API can cause, it is serialised by the workflow's
   * `concurrency: pages` group, and it is authenticated — so the threat is not an attacker, it is a
   * button that looks like it did nothing. An operator who clicks Publish six times because the
   * page has not visibly changed yet would otherwise queue six identical builds behind each other,
   * each one delaying the deploy they are waiting for. Keying per-client would let a second tab or
   * a phone defeat that, hence GLOBAL.
   *
   * The window is generous enough that legitimate editing sessions — save some clients, publish,
   * spot a typo, publish again — never hit it.
   */
  publish: { limit: 6, windowMinutes: 30 },
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
