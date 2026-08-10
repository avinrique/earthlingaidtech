-- Schema for the Earthling Aidtech lead system.
-- Idempotent: safe to run against an existing database. Applied by `npm run migrate`.

create table if not exists leads (
  id          bigserial primary key,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  name        text        not null,
  email       text        not null,
  company     text,
  phone       text,
  service     text,
  budget      text,
  message     text        not null,

  -- Which page the enquiry came from, so we can tell what the site is actually converting.
  source      text,

  status      text        not null default 'new'
                          check (status in ('new', 'contacted', 'qualified', 'won', 'lost')),
  notes       text,

  -- Salted hash, never the raw address: enough to spot an abusive source, not enough to
  -- re-identify a visitor.
  ip_hash     text,
  user_agent  text
);

create index if not exists leads_created_at_idx on leads (created_at desc);
create index if not exists leads_status_idx     on leads (status);

-- Trigram-free search: good enough at this volume and needs no extension.
create index if not exists leads_email_idx      on leads (lower(email));

-- Rate limiting. Rows are pruned opportunistically by the lead endpoint.
create table if not exists rate_events (
  id         bigserial   primary key,
  bucket     text        not null,
  key        text        not null,
  created_at timestamptz not null default now()
);

create index if not exists rate_events_lookup_idx
  on rate_events (bucket, key, created_at desc);

-- Keep updated_at honest without the API having to remember.
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists leads_set_updated_at on leads;
create trigger leads_set_updated_at
  before update on leads
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Editable site content.
--
-- The marketing site is a static Astro build, so nothing here is read at request time. A prebuild
-- step pulls /api/content and writes it into the repo; if that fetch fails the committed copy is
-- used. These tables are therefore the *source* of content, never a runtime dependency of the
-- site being up.
-- ---------------------------------------------------------------------------

-- Client logos live in Postgres as bytea rather than in an object store on purpose: there are a
-- dozen-odd marks, each well under 100KB, and they are read once per site build — not per
-- visitor. Adding S3/Blob would mean a second backing service, a second set of credentials and a
-- second failure mode for the sake of ~1MB of data. The CHECK below keeps that assumption true:
-- an oversized upload is rejected by the database itself, not merely by the API, so no route can
-- ever bloat a row past the limit.
create table if not exists content_clients (
  id              bigserial   primary key,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  name            text        not null,
  note            text,
  url             text,

  logo_bytes      bytea,
  logo_mime       text,
  logo_updated_at timestamptz,

  -- Display order on the site. Ties fall back to id, so a fresh row without an explicit order
  -- still lands somewhere deterministic.
  sort_order      int         not null default 0,

  -- Soft delete / staging: hidden from the public payload but still editable in the console.
  active          boolean     not null default true,

  constraint content_clients_logo_size check (
    logo_bytes is null or octet_length(logo_bytes) <= 262144
  )
);

-- The public payload's exact access pattern: active rows, in display order.
create index if not exists content_clients_active_order_idx
  on content_clients (active, sort_order);

drop trigger if exists content_clients_set_updated_at on content_clients;
create trigger content_clients_set_updated_at
  before update on content_clients
  for each row execute function set_updated_at();

-- Headline numbers and other short strings that change often enough to be worth editing without a
-- code change. Deliberately untyped key/value text: the values are display strings ("1.7k+"),
-- not numbers to compute with, and a flat map means adding a key is a seed line rather than a
-- migration.
create table if not exists content_settings (
  key        text        primary key,
  value      text        not null,
  updated_at timestamptz not null default now()
);

drop trigger if exists content_settings_set_updated_at on content_settings;
create trigger content_settings_set_updated_at
  before update on content_settings
  for each row execute function set_updated_at();
