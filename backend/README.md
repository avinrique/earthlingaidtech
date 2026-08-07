# Earthling Aidtech — Leads API + Admin Dashboard

Deployment runbook. Read top to bottom the first time; after that, jump to
[Smoke test](#8-smoke-test) and [Troubleshooting](#9-troubleshooting).

---

## 1. What this is

Two separately-hosted halves that talk over the public internet.

- **Marketing site** — Astro, static output, built by GitHub Actions, served by
  **GitHub Pages** at `https://earthlingaidtech.com`. It has no server. It cannot
  hold a secret, cannot talk to Postgres, cannot send mail.
- **This project** — plain **Vercel Functions** (`api/*.ts`, `@vercel/node`, no
  framework) plus static admin files in `public/`, served at
  `https://api.earthlingaidtech.com`. It owns the database, the SMTP credentials
  and the admin session cookie.

```
   Browser
      │
      │  GET https://earthlingaidtech.com/contact/
      ▼
┌──────────────────────────┐
│  GitHub Pages (static)   │   Astro build, no server, no secrets
│  earthlingaidtech.com    │
└──────────┬───────────────┘
           │  fetch(PUBLIC_API_BASE + "/api/leads", { method:"POST" })
           │  ── CROSS-ORIGIN ──  browser sends Origin: https://earthlingaidtech.com
           ▼
┌────────────────────────────────────────────────┐
│  Vercel  ·  api.earthlingaidtech.com           │
│                                                │
│   api/leads/index.ts  ← POST (public, CORS gate) + GET (admin)
│   api/leads/[id].ts   ← PATCH / DELETE (admin)
│   api/auth/*.ts       ← eat_admin httpOnly cookie
│   api/health.ts  ·  api/export.csv.ts             │
│   public/  (admin dashboard, self-contained)   │
└──────┬───────────────────────────┬─────────────┘
       │                           │
       ▼                           ▼
┌───────────────┐        ┌──────────────────────────┐
│ Neon Postgres │        │ GoDaddy SMTP :465        │
│ leads table   │        │ services@earthling…      │
└───────────────┘        └──────────────────────────┘
                                    │
                                    ▼
                          avigupta2001ad@gmail.com
```

**CORS is load-bearing, not incidental.** The two halves are on different
origins (`earthlingaidtech.com` vs `api.earthlingaidtech.com` — different host,
so a different origin even though the registrable domain matches). Every browser
call to the API is a cross-origin request. Concretely:

- `POST /api/leads` sends `Content-Type: application/json`, which is **not** a
  CORS-safelisted content type, so the browser fires an `OPTIONS` preflight
  first. If the preflight doesn't come back with the right
  `Access-Control-Allow-Origin`, the POST never leaves the browser and you get a
  console error with **no server log** — the request genuinely did not happen.
- The admin dashboard is served from the API origin itself, so its calls are
  same-origin and CORS never applies to them. It still passes
  `credentials: "include"` for the `eat_admin` cookie, which is a no-op
  same-origin but is the correct thing to state explicitly.
- **The API never sends `Access-Control-Allow-Credentials`, and
  `Access-Control-Allow-Methods` lists only `POST, OPTIONS`.** That is
  deliberate, not an oversight: the only intended cross-origin caller is the
  anonymous enquiry POST. `earthlingaidtech.com` and `api.earthlingaidtech.com`
  share a registrable domain, so `SameSite=Strict` already sends `eat_admin`
  between them — allowing credentials on top of an allow-listed origin would let
  any script that got onto the marketing site (an XSS, a compromised analytics
  tag, a hijacked Pages deploy) read the whole lead table and issue `DELETE`s
  with your session. Withholding the header is what stops that.
  Corollary: **do not try to serve the dashboard from the Pages origin.** It
  would need credentialed CORS and `SameSite=None`, which is exactly the posture
  this design refuses. Keep the dashboard on `api.earthlingaidtech.com`.
- `ALLOWED_ORIGINS` is therefore a production config value, not a dev
  convenience. Getting it wrong breaks the contact form silently.

---

## 2. Provision Neon

Neon is added as a **Vercel Marketplace native integration** — Vercel owns the
billing and injects the connection string into the project's env for you.

From the repo root, with the Vercel project already linked (see
[§5](#5-first-deploy) if you haven't linked yet — you can also do this step
after linking):

```bash
cd /Users/avin/projects/self_project/earthlingaidtech/backend
vercel integration add neon
```

The CLI walks you through: pick the scope (your personal/team account), pick the
plan (**Free** is fine — see the retention note in [§10](#10-operating-notes)),
name the database (`earthlingaidtech-leads`), and confirm connecting it to this
Vercel project. It provisions the Neon project and writes the env vars back.

**What it injects.** The integration sets, at minimum:

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` | Pooled connection string, `...-pooler.<region>.aws.neon.tech`. This is the one the code uses. |
| `DATABASE_URL_UNPOOLED` | Direct connection. Only needed for things that hold a session (migrations with advisory locks, `pg_dump`). |
| `PG*` / `POSTGRES_*` aliases | Convenience duplicates. Ignore them. |

Confirm it landed:

```bash
vercel env ls
```

You want to see `DATABASE_URL` present in **Production, Preview, Development**.
If it only shows in Production, the integration was scoped to production only —
fix it in the Vercel dashboard at **Project → Settings → Environment Variables**,
click the row's `⋯` → **Edit**, and tick Preview and Development too.

Pull it locally so you can run the migration and `vercel dev`:

```bash
vercel env pull .env.local
```

`.env.local` is git-ignored. It now contains real secrets — treat it like the
`~/.eat-mailer/config.json` file (`chmod 600 .env.local` if you want to be
strict).

---

## 3. Run the migration

```bash
cd /Users/avin/projects/self_project/earthlingaidtech/backend
npm install
npm run migrate
```

`npm run migrate` runs `node --env-file-if-exists=.env.local scripts/migrate.mjs`,
so it picks up `DATABASE_URL` from `.env.local` if that file exists and from the
ambient environment otherwise. It applies `lib/schema.sql`, which is idempotent
(`CREATE TABLE IF NOT EXISTS …`), so re-running it is safe and is the normal way
to apply a later schema change. If neither source provides `DATABASE_URL` the
script exits with `DATABASE_URL is not set.`

If you'd rather be explicit about which database you're hitting:

```bash
DATABASE_URL="$(grep -m1 '^DATABASE_URL=' .env.local | cut -d= -f2- | tr -d '"')" npm run migrate
```

**Verify.** Open the Neon SQL editor (Neon Console → your project → **SQL
Editor**) or use `psql` with the unpooled URL:

```bash
psql "$DATABASE_URL_UNPOOLED" -c '\d leads'
psql "$DATABASE_URL_UNPOOLED" -c 'select count(*) from leads;'
```

You should see the `leads` table with `id`, `created_at`, `updated_at`, `name`,
`email`, `company`, `phone`, `service`, `budget`, `message`, `source`, `status`,
`notes`, plus `ip_hash` and `user_agent` (never returned by the API). `count` = 0.
Rate limiting does **not** live on `leads` — it is a second table, `rate_events`,
created by the same migration.

No `psql`? `npx postgres-cli` is a hassle — just use the Neon SQL Editor, it's
two clicks.

---

## 4. Environment variables

Set all of these on the Vercel project before the first production deploy.
"Envs" = which Vercel environments the variable belongs in.

| Name | Example value | Envs | Secret? | What breaks without it |
| --- | --- | --- | --- | --- |
| `DATABASE_URL` | `postgresql://neondb_owner:…@ep-x-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require` | Prod, Preview, Dev | **Yes** (injected by Neon integration) | Everything. `/api/health` returns `db:false`; every lead POST 500s; dashboard shows no leads. |
| `SMTP_HOST` | `smtpout.secureserver.net` | Prod, Preview, Dev | No | Notification mail fails. Leads still save — mail is best-effort — but you find out about them only by opening the dashboard. |
| `SMTP_PORT` | `465` | Prod, Preview, Dev | No | Same as above. Must be `465` with `secure: true`; 587 STARTTLS on GoDaddy is flaky from serverless. |
| `SMTP_USER` | `services@earthlingaidtech.com` | Prod, Preview, Dev | No | SMTP auth fails → no notification mail. |
| `SMTP_PASS` | *(the mailbox password — see below)* | Prod, Preview, Dev | **Yes — sensitive** | SMTP auth fails with `535`. No notification mail. |
| `MAIL_FROM` | `Earthling Aidtech <services@earthlingaidtech.com>` | Prod, Preview, Dev | No | Mail is rejected or lands in spam. GoDaddy requires the envelope-from to match `SMTP_USER`. |
| `LEAD_NOTIFY_TO` | `avigupta2001ad@gmail.com` | Prod, Preview, Dev | No | Mail is composed and dropped — nobody gets notified of a new lead. |
| `ADMIN_PASSWORD` | a 20+ char random string | Prod, Preview, Dev | **Yes** | `POST /api/auth/login` can never succeed → you are locked out of the dashboard. |
| `SESSION_SECRET` | 32 random bytes, hex | Prod, Preview, Dev | **Yes** | Session cookies can't be signed/verified. Every admin request 401s. **Rotating this logs everyone out**, which is also how you revoke a session. |
| `IP_SALT` | 16 random bytes, hex | Prod, Preview, Dev | **Yes** | IP hashing for rate limiting has no salt → stored hashes are reversible by brute force (there are only ~4bn IPv4s). Privacy issue, not an outage. |
| `ALLOWED_ORIGINS` | `https://earthlingaidtech.com,https://www.earthlingaidtech.com` | Prod | No | **The contact form dies silently.** Browser blocks the preflight; nothing reaches the server; no error in Vercel logs. See [§9](#9-troubleshooting). |

For Preview/Dev, add the local origin too:
`https://earthlingaidtech.com,https://www.earthlingaidtech.com,http://localhost:4321`

### `SMTP_PASS` — handle carefully

`SMTP_PASS` is the **existing password of the real `services@earthlingaidtech.com`
mailbox**. It is the same credential the `eatmail` CLI uses. Right now it exists
in exactly one place on disk:

```
~/.eat-mailer/config.json    (mode 600)
```

Rules:

- **Never** commit it — not to this repo, not to `.env`, not in a code comment.
- **Never** `echo`, `cat` or `printf` it into a terminal you're screen-sharing,
  recording, or that streams into an agent transcript. That includes
  `cat ~/.eat-mailer/config.json`.
- **Never** set it with `vercel env add SMTP_PASS production < file` or
  `VERCEL_… vercel env add … --value=…` — both put the secret in shell history.

Set it with the interactive prompt, which reads from stdin without echoing into
history:

```bash
vercel env add SMTP_PASS production
# Paste the value at the "What's the value of SMTP_PASS?" prompt, press Enter.
# Repeat for the other environments:
vercel env add SMTP_PASS preview
vercel env add SMTP_PASS development
```

Then, in the Vercel dashboard, **Project → Settings → Environment Variables**,
find the `SMTP_PASS` row, `⋯` → **Edit**, and tick **Sensitive**. A sensitive
variable is write-only: it is still injected at runtime, but neither the
dashboard nor `vercel env pull` will ever give the value back. That is the
behaviour you want — and it's why `vercel env pull` leaves `SMTP_PASS` blank in
`.env.local`. For local `vercel dev` with real mail, put the value in
`.env.local` by hand, or just accept that local mail sends fail.

### Setting the rest

```bash
cd /Users/avin/projects/self_project/earthlingaidtech/backend

# Non-secret values — fine to pass inline.
printf 'smtpout.secureserver.net' | vercel env add SMTP_HOST production
printf '465'                      | vercel env add SMTP_PORT production
printf 'services@earthlingaidtech.com' | vercel env add SMTP_USER production
printf 'Earthling Aidtech <services@earthlingaidtech.com>' | vercel env add MAIL_FROM production
printf 'avigupta2001ad@gmail.com' | vercel env add LEAD_NOTIFY_TO production
printf 'https://earthlingaidtech.com,https://www.earthlingaidtech.com' | vercel env add ALLOWED_ORIGINS production
```

Generate the three random secrets, then paste each at the prompt (the `openssl`
line prints to *your* terminal only — don't do this on a shared screen):

```bash
openssl rand -hex 32   # -> SESSION_SECRET
openssl rand -hex 16   # -> IP_SALT
openssl rand -base64 24 # -> ADMIN_PASSWORD  (save it in your password manager NOW)

vercel env add SESSION_SECRET production
vercel env add IP_SALT production
vercel env add ADMIN_PASSWORD production
```

Repeat the whole block with `preview` and `development` in place of
`production`, or copy them in the dashboard. Confirm:

```bash
vercel env ls
```

Eleven variables, all present in Production. `SMTP_PASS` should show as
*Sensitive* / *Encrypted*.

Those eleven are the complete set the code reads. The only other environment
variables it touches are `VERCEL`, `VERCEL_ENV` and `VERCEL_GIT_COMMIT_SHA`, all
injected by the platform — never set them yourself. `VERCEL` is what decides
whether the session cookie gets `Secure` (set on every deployment, absent under
local `vercel dev` over plain http); `VERCEL_GIT_COMMIT_SHA` is the `version` in
`/api/health`. `DATABASE_URL_UNPOOLED` and the
`PG*` / `POSTGRES_*` aliases from the Neon integration are unused by the API;
they are only there for `psql` / `pg_dump` from your laptop.

---

## 5. First deploy

The Vercel project's **root directory must be `backend/`** — the repo root is
the Astro site, and if Vercel builds from the root it will try to build Astro and
deploy the marketing site to Vercel by mistake.

```bash
cd /Users/avin/projects/self_project/earthlingaidtech/backend
vercel link
```

Answers:

- *Set up "…/earthlingaidtech"?* → **y**
- *Which scope?* → your account
- *Link to existing project?* → **n** (first time)
- *What's your project's name?* → `earthlingaidtech-leads`
- *In which directory is your code located?* → **`./`**
  Because you ran `vercel link` from inside `backend/`, the CLI records
  `backend` as the root directory relative to the repo. Verify it afterwards.

Verify in the dashboard: **Project → Settings → Build and Deployment → Root
Directory** must read `backend`. Framework Preset should be **Other**. Leave
Build Command empty (there is nothing to build — `api/*.ts` is compiled by the
Node runtime, `public/` is copied as-is).

Deploy:

```bash
vercel deploy --prod
```

You get a `https://earthlingaidtech-leads-<hash>.vercel.app` URL and the
project's stable `…vercel.app` alias. Sanity check before touching DNS:

```bash
curl -s https://earthlingaidtech-leads.vercel.app/api/health | jq
# { "ok": true, "db": true, "version": "9f3c1ab" }
```

`version` is the first 7 characters of `VERCEL_GIT_COMMIT_SHA` — the deployed
commit, not the `package.json` version. It reads `"dev"` under `vercel dev`.

If `db:false` here, stop and fix [§2](#2-provision-neon)/[§3](#3-run-the-migration)
before going further. Note that `/api/health` answers **503** (not 200) whenever
`db` is false, so `curl -f` and uptime monitors will flag it.

---

## 6. Point `api.earthlingaidtech.com` at it

Add the domain to the project **first**, so Vercel provisions the certificate as
soon as DNS resolves: **Project → Settings → Domains → Add**, enter
`api.earthlingaidtech.com`, click **Add**. Vercel will show the record it wants.

Or from the CLI:

```bash
vercel domains add api.earthlingaidtech.com
```

Then add this record at GoDaddy (**Domain Portfolio → earthlingaidtech.com →
DNS → Add New Record**):

| Field | Value |
| --- | --- |
| Type | `CNAME` |
| Name | `api` |
| Value | `cname.vercel-dns.com` |
| TTL | `600` (10 min) — lower it now, raise it later if you like |

> Do **not** touch the apex `A`/`ALIAS` records — those point at GitHub Pages and
> serve the marketing site. You are adding one subdomain, nothing else.

**Shortcut:** you have a `gd-mcp` MCP server wired up (GoDaddy DNS API). Ask
Claude to add the record and it will call `gd_add_dns_records` directly against
`earthlingaidtech.com` — no dashboard clicking. `gd_list_dns_records` is a good
way to confirm the apex records are untouched afterwards.

Wait for propagation and for Vercel to issue the cert (usually < 2 min, up to an
hour if the old TTL was long):

```bash
dig +short api.earthlingaidtech.com CNAME
# cname.vercel-dns.com.

curl -s https://api.earthlingaidtech.com/api/health | jq
# { "ok": true, "db": true, "version": "9f3c1ab" }
```

The **Domains** screen in Vercel should show `api.earthlingaidtech.com` with a
green "Valid Configuration".

---

## 7. Wire up the frontend

The Astro site reads the API base from `PUBLIC_API_BASE` (Astro exposes only
`PUBLIC_*` vars to client code — this one is a public URL, not a secret).

Local dev, in the **repo root** (not `backend/`):

```bash
cd /Users/avin/projects/self_project/earthlingaidtech
echo 'PUBLIC_API_BASE=https://api.earthlingaidtech.com' >> .env
grep -q '^\.env$' .gitignore || echo '.env' >> .gitignore
npm run build && npm run preview
```

For the real deploy, GitHub Actions builds the site — so the value must exist
**in the workflow**, not on your laptop. Two options:

1. **Simplest, and correct here** — hardcode the fallback in
   `src/data/site.ts` (or wherever the form reads it) as
   `import.meta.env.PUBLIC_API_BASE ?? 'https://api.earthlingaidtech.com'`. It's
   a public URL; there is nothing to protect.
2. Add it as a repository variable: **GitHub → repo → Settings → Secrets and
   variables → Actions → Variables tab → New repository variable**, name
   `PUBLIC_API_BASE`, value `https://api.earthlingaidtech.com`; then in
   `.github/workflows/deploy.yml` add to the build step:
   ```yaml
   env:
     PUBLIC_API_BASE: ${{ vars.PUBLIC_API_BASE }}
   ```

Ship it:

```bash
cd /Users/avin/projects/self_project/earthlingaidtech
git add -A
git commit -m "Wire contact form to leads API"
git push origin main
```

`.github/workflows/deploy.yml` runs `withastro/action` and republishes GitHub
Pages. Watch it with `gh run watch`. Takes ~2 min.

---

## 8. Smoke test

Run these in order against production, right after the frontend deploy.

**1. Health.**

```bash
curl -s https://api.earthlingaidtech.com/api/health | jq
# { "ok": true, "db": true, "version": "9f3c1ab" }
```

`db:false` → `DATABASE_URL` is wrong or the migration never ran.

**2. CORS preflight** — this is the one that catches the silent failure.

```bash
curl -s -i -X OPTIONS https://api.earthlingaidtech.com/api/leads \
  -H 'Origin: https://earthlingaidtech.com' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: content-type' | sed -n '1,20p'
```

You need `HTTP/2 204` (or 200) **and**
`access-control-allow-origin: https://earthlingaidtech.com`, plus
`access-control-allow-methods: POST, OPTIONS` and
`access-control-allow-headers: Content-Type`. There should be **no**
`access-control-allow-credentials` header — that absence is intentional
([§1](#1-what-this-is)). If the origin header is missing or says `*`, fix
`ALLOWED_ORIGINS` and redeploy before doing anything else.

**3. Post a real lead** (with the `Origin` header, as a browser would):

```bash
curl -s -X POST https://api.earthlingaidtech.com/api/leads \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://earthlingaidtech.com' \
  -d '{
    "name": "Smoke Test",
    "email": "avigupta2001ad@gmail.com",
    "company": "Earthling Aidtech",
    "phone": "+91 8434106606",
    "service": "Agentic AI",
    "budget": "1-3L",
    "message": "Deployment smoke test — safe to delete.",
    "source": "runbook-smoke-test",
    "page": "/contact/",
    "website": "",
    "t": '"$(( $(date +%s) * 1000 - 9000 ))"'
  }' | jq
# { "ok": true, "id": 1 }
```

`t` is the form-render timestamp; it is backdated 9 seconds so the bot-speed
check passes. `website` is the honeypot and must be empty.

Note the returned `id` — call it `$ID`.

**4. Confirm the row landed.**

```bash
psql "$DATABASE_URL_UNPOOLED" -c \
  "select id, created_at, name, email, status, source from leads order by id desc limit 3;"
```

Or Neon Console → **SQL Editor** → `select * from leads order by id desc limit 3;`

**5. Confirm the email arrived.** Check `avigupta2001ad@gmail.com`, including
**Spam** — first mail from a new sending path very often lands there. Subject
should reference the lead name. If nothing after ~60 s, go to
[§9 SMTP](#smtp-timeouts-the-weak-link) — but note the lead itself is already
saved, which is the point of making mail best-effort.

**6. Log into the dashboard.**

Open `https://api.earthlingaidtech.com/` in a browser, enter `ADMIN_PASSWORD`.
You should land on the leads list with the smoke-test row and
`counts.new === 1`. From the terminal:

```bash
# login, keeping the eat_admin cookie in a jar
curl -s -c /tmp/eat.jar -X POST https://api.earthlingaidtech.com/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"password":"PASTE_ADMIN_PASSWORD"}' | jq

curl -s -b /tmp/eat.jar 'https://api.earthlingaidtech.com/api/leads?limit=5' | jq '.total, .counts'
```

(Prefer the browser for this so `ADMIN_PASSWORD` stays out of shell history.)

**7. Exercise PATCH, then clean up.**

```bash
ID=1   # the id returned in step 3

curl -s -b /tmp/eat.jar -X PATCH https://api.earthlingaidtech.com/api/leads/$ID \
  -H 'Content-Type: application/json' \
  -d '{"status":"contacted","notes":"smoke test"}' | jq '.lead.status'
# "contacted"

curl -s -b /tmp/eat.jar -X DELETE https://api.earthlingaidtech.com/api/leads/$ID | jq
# { "ok": true }

curl -s -b /tmp/eat.jar 'https://api.earthlingaidtech.com/api/leads' | jq '.total'
# 0

rm -f /tmp/eat.jar
```

**8. Finally, do it for real.** Open
`https://earthlingaidtech.com/contact/` in a browser with DevTools → Network
open, submit the form, and confirm you see a `204` preflight followed by a `200`
POST. Delete that lead too. This is the only step that proves the *whole* chain,
because it's the only one where a real browser enforces CORS.

---

## 9. Troubleshooting

### CORS failures

Symptom, in the browser console:

```
Access to fetch at 'https://api.earthlingaidtech.com/api/leads' from origin
'https://earthlingaidtech.com' has been blocked by CORS policy:
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

How to read it:

- **"No 'Access-Control-Allow-Origin' header"** → the origin isn't in
  `ALLOWED_ORIGINS`, or the OPTIONS handler isn't returning headers. Check for
  an exact string match: scheme included, **no trailing slash**,
  `www.` is a *different* origin and needs its own entry.
- **"Response to preflight request doesn't pass"** → the OPTIONS response is a
  non-2xx (often a 404 because the path is wrong, or a 405).
- **"Request header field content-type is not allowed"** →
  `Access-Control-Allow-Headers` doesn't list `content-type`.
- **"credentials mode is 'include' … 'Access-Control-Allow-Credentials' is not
  'true'"** → something is now making a *credentialed* cross-origin call. Nothing
  in this design should: the enquiry form POSTs anonymously and the dashboard is
  same-origin. Do **not** "fix" it by adding the header — see the security note
  in [§1](#1-what-this-is). Find the caller instead.
- **"Method PATCH is not allowed by Access-Control-Allow-Methods"** → likewise
  intentional. Only `POST, OPTIONS` is advertised; admin verbs are meant to be
  unreachable cross-origin.

Key point: **a blocked preflight leaves no trace in Vercel logs** for the POST.
If the browser shows a CORS error and `vercel logs` shows nothing, that's
consistent — the request was never sent. Reproduce it with the `curl -X OPTIONS`
in step 2 above; curl doesn't enforce CORS, so it shows you the raw headers.

After changing `ALLOWED_ORIGINS` you must **redeploy** — env changes don't apply
to already-built deployments:

```bash
cd backend && vercel deploy --prod
```

### SMTP timeouts (the weak link)

**Be clear-eyed about this: GoDaddy SMTP from a serverless function is the least
reliable link in the whole chain.** Not a maybe. The reasons stack up:

- GoDaddy's `smtpout.secureserver.net` rate-limits aggressively and is unhappy
  about connections from cloud IP ranges it doesn't recognise.
- Vercel functions run from a rotating, shared pool of egress IPs, so you look
  like a different sender on every invocation — the worst possible profile for a
  consumer SMTP relay.
- A full SMTP conversation (TCP → TLS → AUTH → DATA → QUIT) is 5+ round trips.
  Under a serverless `maxDuration` that's a lot of wall-clock to spend on a
  request whose real job (the DB insert) took 40 ms.

**The symptom:** the form submits fine, the user sees the success state, the row
appears in the dashboard — **and no email arrives**. Silent, intermittent, and it
will work perfectly during testing and then miss one lead in ten in production.
In the function logs you'll see one of:

```
Error: Connection timeout                      (ETIMEDOUT / ECONNRESET on :465)
Error: Invalid login: 535 Authentication failed
Error: 554 Message rejected / relay denied
Task timed out after 10.00 seconds
```

Mitigations, in order:

1. Mail is **best-effort by design** — the insert commits before the send is
   attempted, so a mail failure never loses a lead. Verify that's still true if
   `lib/mailer.ts` is edited.
2. Raise the function's `maxDuration` (Fluid Compute) so a slow handshake has
   room; `export const config = { maxDuration: 30 }` in the route, or set it in
   `vercel.json`.
3. Confirm port **465 with `secure: true`**. 587/STARTTLS is worse here.
4. If failures persist: **swap to Resend.** This is a single-file change in
   `lib/mailer.ts` — replace the nodemailer transport with a `fetch` to
   `https://api.resend.com/emails` (one HTTP call, one round trip, no SMTP
   handshake), swap `SMTP_*` for `RESEND_API_KEY`, keep `MAIL_FROM` /
   `LEAD_NOTIFY_TO` as-is. You'll need to verify the domain in Resend (a DKIM
   `TXT` + a `MX` for bounces — again, `gd-mcp` can add those). No other file
   changes. Do this the first time you notice a missed notification; don't wait
   for it to become a pattern.

Meanwhile: **the dashboard is the source of truth, not your inbox.** Check it
daily until mail delivery has proven itself over a few weeks.

### Neon cold starts

On the Free plan a Neon compute **auto-suspends after ~5 minutes idle**. The next
query pays a cold start — typically 500 ms, occasionally 2–4 s.

- First request after a quiet night feels slow. This is normal, not a bug.
- If a lead POST times out with something like `Connection terminated` /
  `ECONNRESET` on the very first query, that's a cold start colliding with a
  short client timeout. The retry (i.e. the user pressing submit again)
  succeeds.
- Use the **pooled** `DATABASE_URL` (`…-pooler…`) for the functions — the HTTP
  driver in `@neondatabase/serverless` doesn't hold a TCP session, which is what
  you want when every invocation is a fresh sandbox.
- `GET /api/health` warms the compute. If cold starts ever bother you, a Vercel
  Cron hitting `/api/health` every 5 minutes keeps it awake — but that also keeps
  compute-hours ticking, so only do it if you actually feel the latency.
- Disabling auto-suspend requires a paid Neon plan.

### What a 429 means

Two limiters return `429 { ok:false, error:"rate_limited" }`. A third, `notify`,
never returns anything to the caller — see below.

- **`POST /api/leads`** — too many submissions from the same hashed IP in the
  window. Real people don't hit it; bots and your own load-testing do. If a real
  client reports it, they're most likely behind a shared corporate NAT.
- **`POST /api/auth/login`** — too many failed password attempts. This is
  brute-force protection and it is doing its job. Wait out the window; don't
  raise the limit.

There is also a third, **global** bucket, `notify` (60 mails/hour, not keyed by
IP). It caps outbound notification mail so a distributed flood cannot burn the
sending domain. It never affects the HTTP response: the lead is stored and shows
in the dashboard either way, only the email is skipped, and you get
`lead <id> stored; notification skipped — hourly mail budget exhausted` in the
function logs. If you see that line, open the dashboard — the leads are there.

Rate-limit state lives in the database (the `rate_events` table, keyed on
`sha256(IP_SALT + IP)`), so it survives across function instances — **a redeploy
does not clear it.** If you have locked yourself out and need in immediately,
either wait out the 15-minute window, or clear your own bucket:

```sql
DELETE FROM rate_events WHERE bucket = 'login';
```

Changing `IP_SALT` also invalidates every existing bucket — blunter, and it needs
a redeploy, but it works.

Note: a 429 from Vercel's own edge (not your handler) looks different — it comes
back as HTML, not JSON. That means you're hitting platform DDoS protection, which
is a different conversation.

---

## 10. Operating notes

**Where leads live.** One place: the `leads` table in the Neon Postgres database
attached to this Vercel project. Nothing is stored in Vercel Blob, nothing on the
function filesystem (there isn't one that survives). Email is a *notification*,
not a record — never treat your inbox as the archive.

**Reading them.**

- Dashboard: `https://api.earthlingaidtech.com/` (login with `ADMIN_PASSWORD`).
- CSV: `GET /api/export.csv` with the same filters as the list endpoint —
  from the dashboard's Export button, or:
  ```bash
  curl -s -b /tmp/eat.jar \
    'https://api.earthlingaidtech.com/api/export.csv?status=new' \
    -o leads-$(date +%F).csv
  ```

**Backups.** Neon's Free plan keeps a 24-hour point-in-time restore window —
enough to undo an accidental `DELETE`, not enough to be a backup strategy. Take
your own, monthly, into a location you control:

```bash
cd /Users/avin/projects/self_project/earthlingaidtech/backend
vercel env pull .env.local      # refresh DATABASE_URL_UNPOOLED
set -a; . ./.env.local; set +a

pg_dump "$DATABASE_URL_UNPOOLED" --table=leads --data-only --column-inserts \
  > ~/backups/eat-leads-$(date +%F).sql
```

Or, dependency-free, just archive the CSV export — for a lead table that's a
perfectly honest backup, and it's the format you'd import into a CRM anyway.
Either way, put the file somewhere durable (`~/backups/` is on one laptop; iCloud
or a private repo is better) and **don't commit it** — it's personal data.

**Retention.** There is no automatic deletion. Rows stay until you delete them.
That's a deliberate choice for a low-volume B2B lead table, but it's also a
liability: names, emails, phone numbers and free-text messages accumulate
forever.

A reasonable policy, applied by hand every few months:

```sql
-- Drop dead leads older than two years.
DELETE FROM leads
WHERE status IN ('lost')
  AND updated_at < now() - interval '2 years';
```

Keep `won` and `qualified` rows — they're business records. If you ever need a
formal privacy posture (a client asking about GDPR/DPDP), the honest statements
are: data is stored in Neon Postgres in a single region, access is a single
password-protected dashboard over TLS, IPs are stored only as salted hashes and
never in plaintext, and deletion on request is a one-click action in the
dashboard.

**Rotating credentials.**

| Credential | How | Effect |
| --- | --- | --- |
| `ADMIN_PASSWORD` | `vercel env rm ADMIN_PASSWORD production` then `vercel env add …`, redeploy | New password required; existing sessions survive until the cookie expires. |
| `SESSION_SECRET` | same | **Immediately invalidates every session.** This is the emergency "log everyone out" lever. |
| `SMTP_PASS` | change it in the GoDaddy mailbox first, then update Vercel **and** `~/.eat-mailer/config.json` | Miss the second one and the `eatmail` CLI breaks. |

**Routine redeploy** (after any env change):

```bash
cd /Users/avin/projects/self_project/earthlingaidtech/backend && vercel deploy --prod
```

**Logs:** `vercel logs <deployment-url> --follow`, or **Project → Logs** in the
dashboard (Runtime Logs, filter by `/api/leads`).
