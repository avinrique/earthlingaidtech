#!/usr/bin/env node
/**
 * Apply lib/schema.sql to DATABASE_URL.
 *
 *   npm run migrate
 *
 * The schema is idempotent, so this is safe to re-run after every deploy. Statements are split on
 * semicolons at line ends, which is enough for this file — note the $$-quoted trigger function is
 * handled by splitting on ";\n" rather than ";" alone.
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set.');
  console.error('Pull it from Vercel first:  vercel env pull .env.local');
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const schema = await readFile(join(here, '..', 'lib', 'schema.sql'), 'utf8');

const sql = neon(url);

// Keep $$ ... $$ bodies intact: split only on a semicolon that ends a line outside a dollar quote.
const statements = [];
let buffer = '';
let inDollar = false;
for (const line of schema.split('\n')) {
  const dollars = (line.match(/\$\$/g) || []).length;
  buffer += line + '\n';
  if (dollars % 2 === 1) inDollar = !inDollar;
  if (!inDollar && /;\s*$/.test(line)) {
    const stmt = buffer.trim();
    if (stmt && !stmt.startsWith('--')) statements.push(stmt);
    buffer = '';
  }
}
if (buffer.trim()) statements.push(buffer.trim());

console.log(`Applying ${statements.length} statements…`);
for (const [i, statement] of statements.entries()) {
  const label = statement.split('\n')[0].slice(0, 70);
  try {
    await sql.query(statement);
    console.log(`  ${String(i + 1).padStart(2)}. ok   ${label}`);
  } catch (error) {
    console.error(`  ${String(i + 1).padStart(2)}. FAIL ${label}`);
    console.error(error);
    process.exit(1);
  }
}

const [{ count }] = await sql`select count(*)::int as count from leads`;
console.log(`\nSchema applied. leads table holds ${count} row(s).`);
