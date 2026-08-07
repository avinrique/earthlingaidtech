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
