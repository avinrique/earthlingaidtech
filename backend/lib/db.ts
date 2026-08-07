/**
 * Neon Postgres access.
 *
 * `neon()` speaks HTTP, not the wire protocol, so there is no connection pool to exhaust and no
 * socket to leave open when a Vercel function freezes. Every query below uses tagged-template
 * parameterisation — values are sent out of band, never interpolated into SQL.
 */

import { neon } from '@neondatabase/serverless';

import { env } from './env.js';

export const sql = neon(env.databaseUrl);

export const LEAD_STATUSES = ['new', 'contacted', 'qualified', 'won', 'lost'] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export function isLeadStatus(value: unknown): value is LeadStatus {
  return typeof value === 'string' && (LEAD_STATUSES as readonly string[]).includes(value);
}

export interface Lead {
  id: number;
  created_at: string;
  updated_at: string;
  name: string;
  email: string;
  company: string | null;
  phone: string | null;
  service: string | null;
  budget: string | null;
  message: string;
  source: string | null;
  status: LeadStatus;
  notes: string | null;
}

/**
 * Columns exposed to the dashboard — ip_hash and user_agent are deliberately never selected, so
 * they cannot leak through the API. Written out literally at each call site rather than
 * interpolated, because identifiers cannot be parameterised and interpolation is how injection
 * bugs start.
 */

export async function healthy(): Promise<boolean> {
  try {
    await sql`select 1`;
    return true;
  } catch {
    return false;
  }
}
