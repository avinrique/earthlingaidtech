#!/usr/bin/env node
/**
 * Seed the editable-content tables from the copy that currently lives in the site's
 * src/data/site.ts.
 *
 *   npm run seed
 *
 * Run this once after `npm run migrate`, but it is safe to run at any time: every insert is
 * `on conflict do nothing`. That matters because the console is the source of truth once the CMS
 * is live — a re-run must never resurrect an old name, undo a reorder, or clobber a number
 * Abhinav changed by hand. Seeding is a bootstrap, not a sync.
 *
 * Idempotency keys:
 *   - clients  -> unique index on lower(name), created here rather than in schema.sql because it
 *                 is a property of *seeding* (don't insert the same brand twice), not a rule the
 *                 operator should be blocked by if two clients genuinely share a name. It is
 *                 created `if not exists` and the script degrades gracefully if it cannot be.
 *   - settings -> the primary key.
 */

import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set.');
  console.error('Pull it from Vercel first:  vercel env pull .env.local');
  process.exit(1);
}

const sql = neon(url);

/**
 * The 14 clients as they appear in src/data/site.ts, in that order. sort_order is the array index
 * so the seeded site renders identically to the hand-written one — EverChiq stays last.
 */
const CLIENTS = [
  { name: 'Edmond Fernandes', note: 'Public health' },
  { name: 'CHD Group', note: 'NGO' },
  { name: 'EPICH', note: 'Public health' },
  { name: 'Perenhil', note: 'Healthcare' },
  { name: 'Credley', note: 'Fintech' },
  { name: 'Woostaa', note: 'Housing solution' },
  { name: 'Curota.ai', note: 'AI data annotation' },
  { name: 'CampusPathway', note: 'Admissions · EdTech' },
  { name: 'OrynConsulting', note: 'Consulting' },
  { name: 'SalesSphere360', note: 'Sales' },
  { name: 'Halde20', note: 'Restaurant · Switzerland' },
  { name: 'Chillaxmandu', note: 'Lifestyle' },
  { name: 'ThePixelSphere', note: 'Studio' },
  { name: 'EverChiq', note: 'Fashion · D2C' },
];

/**
 * Headline numbers, with the two forms the site actually needs: the terse stat-tile string and
 * the long form that reads correctly inside a sentence. They are separate keys rather than one
 * value formatted two ways, because "1.7k+" and "1,700+" are editorial choices, not derivable.
 */
const SETTINGS = {
  students_trained: '1.7k+',
  students_trained_prose: '1,700+',
  sessions_delivered: '15+',
  technical_tracks: '7',
  workshops_count: '6',
};

// Guard against seeding a database that has not been migrated yet — a missing table here is a
// confusing error 40 lines later otherwise.
try {
  await sql`select 1 from content_clients limit 1`;
  await sql`select 1 from content_settings limit 1`;
} catch (error) {
  console.error('content_clients / content_settings are missing. Run `npm run migrate` first.');
  console.error(error.message);
  process.exit(1);
}

// Name uniqueness is what makes the client seed idempotent. If it cannot be created (because the
// table already holds a duplicate the operator added deliberately), fall back to an existence
// check instead of failing the whole seed.
let haveNameIndex = true;
try {
  await sql`
    create unique index if not exists content_clients_name_unique
      on content_clients (lower(name))
  `;
} catch (error) {
  haveNameIndex = false;
  console.warn(`! could not create unique index on name: ${error.message}`);
  console.warn('  falling back to per-row existence checks.');
}

console.log('Clients');
let clientsInserted = 0;
let clientsSkipped = 0;

for (const [index, client] of CLIENTS.entries()) {
  let rows;

  if (haveNameIndex) {
    rows = await sql`
      insert into content_clients (name, note, sort_order, active)
      values (${client.name}, ${client.note}, ${index}, true)
      on conflict (lower(name)) do nothing
      returning id
    `;
  } else {
    const existing = await sql`
      select id from content_clients where lower(name) = lower(${client.name}) limit 1
    `;
    rows = existing.length
      ? []
      : await sql`
          insert into content_clients (name, note, sort_order, active)
          values (${client.name}, ${client.note}, ${index}, true)
          returning id
        `;
  }

  if (rows.length) {
    clientsInserted += 1;
    console.log(`  + ${client.name}  (sort_order ${index}, id ${rows[0].id})`);
  } else {
    clientsSkipped += 1;
    console.log(`  · ${client.name}  already present — left untouched`);
  }
}

console.log('\nSettings');
let settingsInserted = 0;
let settingsSkipped = 0;

for (const [key, value] of Object.entries(SETTINGS)) {
  const rows = await sql`
    insert into content_settings (key, value)
    values (${key}, ${value})
    on conflict (key) do nothing
    returning key
  `;

  if (rows.length) {
    settingsInserted += 1;
    console.log(`  + ${key} = ${value}`);
  } else {
    settingsSkipped += 1;
    console.log(`  · ${key} already set — left untouched`);
  }
}

const [{ clients }] = await sql`select count(*)::int as clients from content_clients`;
const [{ settings }] = await sql`select count(*)::int as settings from content_settings`;

console.log(
  `\nSeed complete. Clients: ${clientsInserted} inserted, ${clientsSkipped} skipped (${clients} total). ` +
    `Settings: ${settingsInserted} inserted, ${settingsSkipped} skipped (${settings} total).`,
);
