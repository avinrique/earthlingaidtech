/**
 * Validation for the public lead endpoint.
 *
 * Everything arriving here is attacker-controlled. The rules are deliberately strict on shape and
 * length (a database full of 2MB "names" is a real outcome) and deliberately lenient on content —
 * a legitimate enquiry from any country has to get through.
 */

export interface LeadInput {
  name: string;
  email: string;
  company: string | null;
  phone: string | null;
  service: string | null;
  budget: string | null;
  message: string;
  source: string | null;
}

export interface ValidationResult {
  ok: boolean;
  fields: Record<string, string>;
  value: LeadInput;
}

const LIMITS = {
  name: 120,
  email: 200,
  company: 160,
  phone: 40,
  service: 80,
  budget: 60,
  message: 5000,
  source: 300,
} as const;

/**
 * Deliberately permissive: one @, something either side, a dot in the domain, no whitespace.
 * Stricter regexes reject valid addresses, and the real proof an address works is a reply.
 */
const EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

/** Strip control characters, including the CR/LF that would enable header injection downstream. */
function clean(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
}

/** Same, but newlines survive — the message body is allowed to have paragraphs. */
function cleanMultiline(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/\r\n/g, '\n')
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ')
    .trim()
    .slice(0, max);
}

function orNull(value: string): string | null {
  return value.length > 0 ? value : null;
}

export function validateLead(body: Record<string, unknown>): ValidationResult {
  const fields: Record<string, string> = {};

  const name = clean(body.name, LIMITS.name);
  const email = clean(body.email, LIMITS.email).toLowerCase();
  const message = cleanMultiline(body.message, LIMITS.message);

  if (name.length < 2) fields.name = 'Please tell us your name.';
  if (!EMAIL.test(email)) fields.email = 'That email address does not look right.';
  if (message.length < 10) fields.message = 'A sentence or two about what you need, please.';

  return {
    ok: Object.keys(fields).length === 0,
    fields,
    value: {
      name,
      email,
      message,
      company: orNull(clean(body.company, LIMITS.company)),
      phone: orNull(clean(body.phone, LIMITS.phone)),
      service: orNull(clean(body.service, LIMITS.service)),
      budget: orNull(clean(body.budget, LIMITS.budget)),
      source: orNull(clean(body.source ?? body.page, LIMITS.source)),
    },
  };
}

/**
 * Cheap bot checks that cost a human nothing.
 *
 * `website` is a hidden field: a human never sees it, so anything in it is a bot. `t` is when the
 * form rendered; a genuine person cannot read the page and type a message in under three seconds.
 * Both are enforced here, server-side — the markup alone would stop nobody.
 */
export function looksAutomated(body: Record<string, unknown>): boolean {
  const honeypot = body.website;
  if (typeof honeypot === 'string' && honeypot.trim().length > 0) return true;

  const rendered = Number(body.t);
  if (Number.isFinite(rendered) && rendered > 0) {
    const elapsed = Date.now() - rendered;
    // Negative means a clock skew or a forged value; only the too-fast case is treated as a bot.
    if (elapsed >= 0 && elapsed < 3000) return true;
  }
  return false;
}
