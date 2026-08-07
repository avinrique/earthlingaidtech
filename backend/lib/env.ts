/**
 * Environment access, validated once at module load.
 *
 * Everything here is server-side only. Nothing in this file may ever be imported by anything
 * that ships to a browser — the Astro site talks to this service over HTTP and knows only its
 * origin.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    // Thrown at cold start rather than on the first request, so a misconfigured deploy fails
    // loudly in the Vercel logs instead of silently dropping leads.
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

export const env = {
  databaseUrl: required('DATABASE_URL'),

  smtp: {
    host: optional('SMTP_HOST', 'smtpout.secureserver.net'),
    port: Number(optional('SMTP_PORT', '465')),
    user: required('SMTP_USER'),
    pass: required('SMTP_PASS'),
    from: optional('MAIL_FROM', 'Earthling Aidtech <services@earthlingaidtech.com>'),
  },

  /** Where new-lead notifications land. Comma-separated for multiple recipients. */
  notifyTo: required('LEAD_NOTIFY_TO'),

  adminPassword: required('ADMIN_PASSWORD'),
  sessionSecret: required('SESSION_SECRET'),

  /** Salt for hashing IPs. Rotating it resets rate-limit buckets, which is fine. */
  ipSalt: optional('IP_SALT', 'earthling-aidtech-lead-salt'),

  allowedOrigins: optional(
    'ALLOWED_ORIGINS',
    'https://earthlingaidtech.com,https://www.earthlingaidtech.com',
  )
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),

  version: optional('VERCEL_GIT_COMMIT_SHA', 'dev').slice(0, 7),
  isProduction: process.env.VERCEL_ENV === 'production',
} as const;
