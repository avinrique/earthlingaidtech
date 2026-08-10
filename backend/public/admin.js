/* ==========================================================================
   Earthling Aidtech — Lead console
   Plain ES module. No framework, no bundler, no external requests.

   SECURITY — XSS:
   Every lead field (name, email, company, message, notes, source, …) is
   attacker-controlled: anyone on the internet can POST /api/leads. This file
   therefore NEVER assigns lead data to innerHTML / insertAdjacentHTML / outerHTML.
   All text reaches the DOM through `el({ text })` -> node.textContent, or through
   node.append(string) which creates a Text node — both escape by construction.
   The only attribute sinks that take lead data are href values, and those are
   built with encodeURIComponent + an explicit mailto: scheme, so a lead cannot
   smuggle in a `javascript:` URL. If you add markup here, keep that invariant.
   ========================================================================== */

/* ── Constants ───────────────────────────────────────────────────────────── */

const LIMIT = 25;

const STATUSES = [
  { key: 'new',       label: 'New' },
  { key: 'contacted', label: 'Contacted' },
  { key: 'qualified', label: 'Qualified' },
  { key: 'won',       label: 'Won' },
  { key: 'lost',      label: 'Lost' },
];
const STATUS_KEYS = STATUSES.map((s) => s.key);
const LABEL = Object.fromEntries(STATUSES.map((s) => [s.key, s.label]));

const TABS = [{ key: '', label: 'All' }, ...STATUSES];

/* ── Tiny DOM helpers ────────────────────────────────────────────────────── */

const $ = (sel, root = document) => root.querySelector(sel);
const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Build an element. `text` and appended strings go through textContent /
 * Text nodes — never innerHTML. See the security note at the top of the file.
 */
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  for (const child of [].concat(children)) if (child !== null && child !== undefined && child !== false) node.append(child);
  return node;
}

function icon(id, size = 16) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const use = document.createElementNS(SVG_NS, 'use');
  use.setAttribute('href', `#${id}`);
  svg.append(use);
  return svg;
}

/* ── Time ────────────────────────────────────────────────────────────────── */

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
const UNITS = [
  ['year',   31536000000],
  ['month',   2592000000],
  ['week',     604800000],
  ['day',       86400000],
  ['hour',       3600000],
  ['minute',       60000],
];

/** Relative time, computed client-side from the ISO timestamp. */
function ago(iso) {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const diff = t - Date.now();
  const abs = Math.abs(diff);
  if (abs < 45000) return 'just now';
  for (const [unit, ms] of UNITS) {
    if (abs >= ms) return rtf.format(Math.round(diff / ms), unit);
  }
  return rtf.format(Math.round(diff / 60000), 'minute');
}

const dtf = new Intl.DateTimeFormat(undefined, {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
});
const stamp = (iso) => (Number.isNaN(Date.parse(iso)) ? '' : dtf.format(new Date(iso)));

/* ── API layer ───────────────────────────────────────────────────────────── */

class ApiError extends Error {
  constructor(code, status, data) {
    super(code);
    this.code = code;
    this.status = status;
    this.data = data;
  }
}

/**
 * fetch wrapper. Same-origin, but `credentials: 'include'` is explicit because
 * the eat_admin cookie is the whole auth story.
 * A 401 from any admin call drops the UI back to the login screen.
 *
 * `raw` sends a File/Blob as-is under its own content-type: the logo endpoint
 * takes image bytes as the request body, not a JSON envelope and not multipart,
 * so there is no boundary parsing to get wrong on either side.
 */
async function api(path, { method = 'GET', body, raw, allow401 = false } = {}) {
  let headers;
  let payload;
  if (raw) {
    headers = { 'Content-Type': raw.type || 'application/octet-stream' };
    payload = raw;
  } else if (body) {
    headers = { 'Content-Type': 'application/json' };
    payload = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(path, { method, credentials: 'include', headers, body: payload });
  } catch {
    throw new ApiError('network', 0, null);
  }

  let data = null;
  try { data = await res.json(); } catch { /* non-JSON body */ }

  if (res.status === 401 && !allow401) {
    showLogin();
    throw new ApiError('unauthorized', 401, data);
  }
  if (!res.ok || !data || data.ok === false) {
    throw new ApiError((data && data.error) || `http_${res.status}`, res.status, data);
  }
  return data;
}

/* ── State ───────────────────────────────────────────────────────────────── */

const state = {
  view: 'leads',
  status: '',
  q: '',
  offset: 0,
  total: 0,
  counts: { new: 0, contacted: 0, qualified: 0, won: 0, lost: 0 },
  leads: [],
  expanded: new Set(),
  loaded: false,
  loading: false,
  reqId: 0,
};

/** Query params shared by GET /api/leads and GET /api/export.csv. */
function queryParams({ paged = true } = {}) {
  const p = new URLSearchParams();
  if (state.status) p.set('status', state.status);
  if (state.q) p.set('q', state.q);
  if (paged) {
    p.set('limit', String(LIMIT));
    p.set('offset', String(state.offset));
  }
  return p;
}

/* State lives in the URL hash, so a filtered view is bookmarkable and survives
   a reload. Tab / page changes push history; typing in search replaces it. */
function readHash() {
  const p = new URLSearchParams(location.hash.replace(/^#/, ''));
  state.view = p.get('view') === 'content' ? 'content' : 'leads';
  const status = p.get('status') || '';
  state.status = STATUS_KEYS.includes(status) ? status : '';
  state.q = p.get('q') || '';
  const off = Number.parseInt(p.get('offset') || '0', 10);
  state.offset = Number.isFinite(off) && off > 0 ? off : 0;
}

function writeHash({ push = false } = {}) {
  const p = new URLSearchParams();
  // `view` leads the hash so the section is the first thing readable in the URL;
  // the lead filters ride along even from the content view, so switching back
  // returns you to the list you were looking at.
  if (state.view !== 'leads') p.set('view', state.view);
  for (const [k, v] of queryParams({ paged: false })) p.set(k, v);
  if (state.offset) p.set('offset', String(state.offset));
  const hash = p.toString() ? `#${p}` : location.pathname;
  if (push) history.pushState(null, '', hash);
  else history.replaceState(null, '', hash);
}

/* ── Views ───────────────────────────────────────────────────────────────── */

const viewBoot = $('#view-boot');
const viewLogin = $('#view-login');
const viewDash = $('#view-dash');

function show(which) {
  viewBoot.hidden = which !== 'boot';
  viewLogin.hidden = which !== 'login';
  viewDash.hidden = which !== 'dash';
}

function showLogin() {
  show('login');
  const pw = $('#login-password');
  pw.value = '';
  setLoginError('');
  // Don't steal focus from a screen reader mid-announcement on reduced motion setups.
  requestAnimationFrame(() => pw.focus());
}

/* ── Toasts (non-blocking; never window.alert/confirm/prompt) ────────────── */

const toastHost = $('#toasts');

function toast(message, kind = 'error') {
  const node = el('div', { class: `toast toast--${kind}` }, [String(message)]);
  toastHost.append(node);
  const kill = () => {
    node.classList.add('is-out');
    setTimeout(() => node.remove(), 260);
  };
  setTimeout(kill, kind === 'error' ? 6000 : 3200);
  node.addEventListener('click', kill);
}

const HUMAN_ERROR = {
  network: 'Network unreachable — check your connection.',
  unauthorized: 'Session expired. Please sign in again.',
  rate_limited: 'Too many requests. Give it a minute.',
  server: 'The server hit an error. Try again shortly.',
  validation: 'The server rejected that change.',
};
const humanise = (err) => HUMAN_ERROR[err && err.code] || 'Something went wrong. Try again.';

/**
 * Two-step confirm on a single button: the first click arms it, the second acts,
 * and blur or a four-second timeout disarms it again.
 *
 * There is no window.confirm/alert/prompt anywhere in this app. A native modal
 * blocks the whole page (including the headless run used to screenshot the
 * console), cannot be styled to match, and cannot be announced the way the rest
 * of this UI is. `aria-live` on the armed button is what tells a screen reader
 * that the next press is destructive.
 */
function armConfirm(btn, idleLabel, run) {
  const label = $('.btn__label', btn);
  let timer = null;

  const disarm = () => {
    clearTimeout(timer);
    timer = null;
    btn.classList.remove('btn--armed');
    btn.removeAttribute('aria-live');
    label.textContent = idleLabel;
  };

  btn.addEventListener('blur', () => { if (timer) disarm(); });
  btn.addEventListener('click', () => {
    if (!timer) {
      btn.classList.add('btn--armed');
      btn.setAttribute('aria-live', 'assertive');
      label.textContent = 'Confirm?';
      timer = setTimeout(disarm, 4000);
      return;
    }
    disarm();
    run();
  });
}

/** Inline, per-field error text. Empty string hides the node entirely. */
function setInline(node, message) {
  node.textContent = message || '';
  node.hidden = !message;
}

/** Momentary "Saved" tick next to a field that saves on blur. */
function flash(node) {
  node.classList.add('is-on');
  clearTimeout(node._flash);
  node._flash = setTimeout(() => node.classList.remove('is-on'), 1600);
}

/* ══ LOGIN ═══════════════════════════════════════════════════════════════ */

const loginForm = $('#login-form');
const loginErrorEl = $('#login-error');
const loginSubmit = $('#login-submit');

function setLoginError(msg) {
  loginErrorEl.textContent = msg;
  loginErrorEl.hidden = !msg;
}

loginForm.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const password = $('#login-password').value;
  if (!password) { setLoginError('Enter the password.'); return; }

  setLoginError('');
  loginSubmit.disabled = true;
  $('.btn__label', loginSubmit).textContent = 'Signing in…';

  try {
    await api('/api/auth/login', { method: 'POST', body: { password }, allow401: true });
    $('#login-password').value = '';
    await enterDashboard();
  } catch (err) {
    if (err.status === 401 || err.code === 'invalid') setLoginError('That password is not right.');
    else if (err.status === 429 || err.code === 'rate_limited') setLoginError('Too many attempts. Wait a minute, then try again.');
    else if (err.code === 'network') setLoginError('Can’t reach the server. Check your connection.');
    else setLoginError('Sign-in failed. Try again.');
    $('#login-password').focus();
  } finally {
    loginSubmit.disabled = false;
    $('.btn__label', loginSubmit).textContent = 'Sign in';
  }
});

/* ══ DASHBOARD ═══════════════════════════════════════════════════════════ */

const tabsEl = $('#tabs');
const listEl = $('#list');
const listRegion = $('#list-region');
const skeletonEl = $('#skeleton');
const emptyEl = $('#empty');
const fatalEl = $('#fatal');
const pagerEl = $('#pager');
const searchEl = $('#search');
const exportEl = $('#btn-export');
const totalEl = $('#topbar-total');
const titleEl = $('#topbar-title');

/* ── Sections ────────────────────────────────────────────────────────────── */

const panelLeads = $('#panel-leads');
const panelContent = $('#panel-content');
const navLeadsBtn = $('#nav-leads');
const navContentBtn = $('#nav-content');

/**
 * Switch between the two top-level sections.
 *
 * Each section fetches lazily and only once. Landing on #view=content must not
 * pull a page of leads that will never be shown, and coming back to a section
 * must not refetch what is already on screen — the refresh button exists for
 * that, and it refreshes whichever section you are looking at.
 */
function setView(view, { push = false, silent = false } = {}) {
  state.view = view === 'content' ? 'content' : 'leads';
  const isContent = state.view === 'content';

  navLeadsBtn.setAttribute('aria-pressed', String(!isContent));
  navContentBtn.setAttribute('aria-pressed', String(isContent));
  panelLeads.hidden = isContent;
  panelContent.hidden = !isContent;
  exportEl.hidden = isContent;            // the CSV is a leads-only artefact
  titleEl.textContent = isContent ? 'Content' : 'Leads';
  document.title = `${titleEl.textContent} · Earthling Aidtech`;
  if (!silent) writeHash({ push });

  if (isContent) {
    renderClientsCount();
    if (!content.loaded && !content.loading) loadContent();
  } else {
    renderTabs();                         // puts the lead count back in the topbar
    if (!state.loaded && !state.loading) load();
  }
}

navLeadsBtn.addEventListener('click', () => {
  if (state.view !== 'leads') setView('leads', { push: true });
});
navContentBtn.addEventListener('click', () => {
  if (state.view !== 'content') setView('content', { push: true });
});

/* ── Tabs ────────────────────────────────────────────────────────────────── */

function renderTabs() {
  const all = STATUS_KEYS.reduce((n, k) => n + (state.counts[k] || 0), 0);
  const frag = document.createDocumentFragment();

  for (const tab of TABS) {
    const n = tab.key ? (state.counts[tab.key] || 0) : all;
    const selected = state.status === tab.key;
    const btn = el('button', {
      type: 'button',
      class: `tab tone-${tab.key || 'all'}`,
      'aria-pressed': String(selected),
      onclick: () => {
        if (state.status === tab.key) return;
        state.status = tab.key;
        state.offset = 0;
        writeHash({ push: true });
        renderTabs();
        load();
      },
    }, [
      el('span', { class: 'tab__dot', 'aria-hidden': 'true' }),
      el('span', { text: tab.label }),
      el('span', { class: 'tab__n', text: String(n) }),
    ]);
    frag.append(btn);
  }

  tabsEl.replaceChildren(frag);

  // `counts` from the API is deliberately across every status AND every lead —
  // it ignores `q` so the tabs keep showing the whole picture while you search.
  // That makes the sum a lie for the *current view*, so while a search is
  // active the headline number switches to `total`, which does respect both
  // filters. Without this the topbar reads "42 leads" over a list of three.
  totalEl.textContent = state.q
    ? (state.total === 1 ? '1 match' : `${state.total} matches`)
    : (all === 1 ? '1 lead' : `${all} leads`);
}

/* ── Loading / list ──────────────────────────────────────────────────────── */

function setLoading(on, { skeleton = true } = {}) {
  state.loading = on;
  listRegion.setAttribute('aria-busy', String(on));
  if (!skeleton) return;
  skeletonEl.hidden = !on;
  if (on) {
    if (!skeletonEl.childElementCount) {
      skeletonEl.replaceChildren(...Array.from({ length: 5 }, () => el('div', { class: 'sk-row' })));
    }
    listEl.hidden = true;
    emptyEl.hidden = true;
    fatalEl.hidden = true;
    pagerEl.hidden = true;
  }
}

async function load({ skeleton = true } = {}) {
  const id = ++state.reqId;
  setLoading(true, { skeleton });
  fatalEl.hidden = true;

  try {
    const data = await api(`/api/leads?${queryParams()}`);
    if (id !== state.reqId) return; // a newer request already won

    state.leads = Array.isArray(data.leads) ? data.leads : [];
    state.total = Number(data.total) || 0;
    state.counts = Object.assign({ new: 0, contacted: 0, qualified: 0, won: 0, lost: 0 }, data.counts || {});

    // Offset can outrun the result set (deletes, filter switch) — walk back.
    if (state.offset > 0 && state.leads.length === 0 && state.total > 0) {
      state.offset = Math.max(0, (Math.ceil(state.total / LIMIT) - 1) * LIMIT);
      writeHash();
      setLoading(false, { skeleton });
      return load({ skeleton });
    }

    state.loaded = true;
    renderTabs();
    renderList();
    renderPager();
    updateExportLink();
  } catch (err) {
    if (id !== state.reqId || err.status === 401) return;
    state.leads = [];
    listEl.replaceChildren();
    emptyEl.hidden = true;
    pagerEl.hidden = true;
    fatalEl.hidden = false;
    $('#fatal-text').textContent = humanise(err);
  } finally {
    if (id === state.reqId) setLoading(false, { skeleton });
  }
}

function renderList() {
  const frag = document.createDocumentFragment();
  for (const lead of state.leads) frag.append(renderLead(lead));
  listEl.replaceChildren(frag);

  const isEmpty = state.leads.length === 0;
  listEl.hidden = isEmpty;
  emptyEl.hidden = !isEmpty;
  if (isEmpty) {
    const filtered = Boolean(state.status || state.q);
    $('#empty-title').textContent = filtered ? 'No leads match this view' : 'No leads yet';
    $('#empty-note').textContent = filtered
      ? 'Try a different status tab, or clear the search.'
      : 'New enquiries from earthlingaidtech.com will land here.';
  }
}

function renderPager() {
  const pages = Math.ceil(state.total / LIMIT);
  pagerEl.hidden = state.total === 0 || pages <= 1;
  if (pagerEl.hidden) return;

  const from = state.total === 0 ? 0 : state.offset + 1;
  const to = Math.min(state.offset + LIMIT, state.total);
  $('#pg-range').textContent = `${from}–${to} of ${state.total}`;
  $('#pg-prev').disabled = state.offset <= 0;
  $('#pg-next').disabled = state.offset + LIMIT >= state.total;
}

function updateExportLink() {
  const p = queryParams({ paged: false });
  exportEl.href = p.toString() ? `/api/export.csv?${p}` : '/api/export.csv';
}

/* ── A lead row ──────────────────────────────────────────────────────────── */

function statusPill(status) {
  const key = STATUS_KEYS.includes(status) ? status : 'new';
  return el('span', { class: `pill lead__pill tone-${key}`, text: LABEL[key] });
}

function metaCell(label, value, link) {
  const v = value
    ? (link ? el('a', { href: link, rel: 'noopener' }, [String(value)]) : String(value))
    : '—';
  return el('div', {}, [
    el('p', { class: 'meta__k', text: label }),
    el('p', { class: `meta__v${value ? '' : ' meta__v--none'}` }, [v]),
  ]);
}

/**
 * tel: URI. Kept to digits plus a single leading `+` — encodeURIComponent turns
 * `+` into `%2B` and spaces into `%20`, which several dialers refuse to parse.
 * Building the scheme ourselves from a digits-only string also means a lead
 * cannot smuggle in `javascript:`.
 */
function telHref(phone) {
  if (!phone) return null;
  const plus = /^\s*\+/.test(String(phone)) ? '+' : '';
  const digits = String(phone).replace(/\D/g, '');
  return digits ? `tel:${plus}${digits}` : null;
}

/** mailto: for a reply, with the lead's first name prefilled. */
function replyHref(lead) {
  const first = String(lead.name || '').trim().split(/\s+/)[0] || 'there';
  const subject = 'Re: your enquiry — Earthling Aidtech';
  const body = `Hi ${first},\n\nThanks for reaching out to Earthling Aidtech.\n\n`;
  return `mailto:${encodeURIComponent(lead.email || '')}` +
         `?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function renderLead(lead) {
  const bodyId = `lead-body-${lead.id}`;
  const open = state.expanded.has(lead.id);

  const root = el('article', { class: `lead${open ? ' is-open' : ''}`, dataset: { id: String(lead.id) } });

  /* ── head (collapsed row) ── */
  const toggle = el('button', {
    type: 'button',
    class: 'lead__toggle',
    'aria-expanded': String(open),
    'aria-controls': bodyId,
  }, [
    el('span', { class: 'lead__who' }, [
      el('span', { class: 'lead__name', text: lead.name || '(no name)' }),
      lead.company ? el('span', { class: 'lead__company', text: lead.company }) : null,
    ]),
    el('span', { class: 'lead__email', text: lead.email || '' }),
    el('span', {
      class: `lead__service${lead.service ? '' : ' lead__service--none'}`,
      text: lead.service || 'No service selected',
    }),
    statusPill(lead.status),
    el('span', { class: 'lead__time', text: ago(lead.created_at), title: stamp(lead.created_at) }),
    (() => { const s = icon('i-chevron', 18); s.classList.add('lead__chev'); return s; })(),
  ]);

  toggle.addEventListener('click', () => {
    const nowOpen = !state.expanded.has(lead.id);
    if (nowOpen) state.expanded.add(lead.id); else state.expanded.delete(lead.id);
    toggle.setAttribute('aria-expanded', String(nowOpen));
    root.classList.toggle('is-open', nowOpen);
    body.hidden = !nowOpen;
  });

  /* ── expanded body ── */
  const notesInput = el('textarea', {
    class: 'notes__input',
    rows: '3',
    placeholder: 'Private notes — saved when you click away.',
    'aria-label': `Notes for ${lead.name || 'this lead'}`,
  });
  notesInput.value = lead.notes || '';
  const savedFlag = el('span', { class: 'notes__saved', text: 'Saved' });

  notesInput.addEventListener('blur', async () => {
    const next = notesInput.value;
    const prev = lead.notes || '';
    if (next === prev) return;

    lead.notes = next;                                   // optimistic
    try {
      const res = await api(`/api/leads/${lead.id}`, { method: 'PATCH', body: { notes: next } });
      if (res.lead) Object.assign(lead, res.lead);
      savedFlag.classList.add('is-on');
      setTimeout(() => savedFlag.classList.remove('is-on'), 1600);
    } catch (err) {
      lead.notes = prev;                                 // roll back
      notesInput.value = prev;
      if (err.status !== 401) toast(`Notes not saved — ${humanise(err)}`);
    }
  });

  const select = el('select', { class: 'select', 'aria-label': `Status for ${lead.name || 'this lead'}` },
    STATUSES.map((s) => el('option', { value: s.key, text: s.label, selected: s.key === lead.status })));
  select.value = STATUS_KEYS.includes(lead.status) ? lead.status : 'new';

  select.addEventListener('change', async () => {
    const next = select.value;
    const prev = lead.status;
    if (next === prev) return;

    // Optimistic: pill, tab counts and the select all move before the request.
    lead.status = next;
    root.querySelector('.lead__pill').replaceWith(statusPill(next));
    state.counts[prev] = Math.max(0, (state.counts[prev] || 0) - 1);
    state.counts[next] = (state.counts[next] || 0) + 1;
    renderTabs();

    try {
      const res = await api(`/api/leads/${lead.id}`, { method: 'PATCH', body: { status: next } });
      if (res.lead) Object.assign(lead, res.lead);
      // Filtering by a status this lead just left? Retire the row from the view.
      if (state.status && state.status !== lead.status) {
        state.total = Math.max(0, state.total - 1);
        removeRow(root, lead.id);
        renderPager();
      }
      toast(`${lead.name || 'Lead'} → ${LABEL[next]}`, 'ok');
    } catch (err) {
      lead.status = prev;                                // roll back
      select.value = prev;
      root.querySelector('.lead__pill').replaceWith(statusPill(prev));
      state.counts[next] = Math.max(0, (state.counts[next] || 0) - 1);
      state.counts[prev] = (state.counts[prev] || 0) + 1;
      renderTabs();
      if (err.status !== 401) toast(`Status not saved — ${humanise(err)}`);
    }
  });

  /* Quick actions */
  const copyBtn = el('button', { type: 'button', class: 'btn btn--ghost btn--sm' }, [
    icon('i-copy', 14), el('span', { class: 'btn__label', text: 'Copy email' }),
  ]);
  copyBtn.addEventListener('click', async () => {
    const ok = await copyText(lead.email || '');
    const label = $('.btn__label', copyBtn);
    label.textContent = ok ? 'Copied' : 'Copy failed';
    setTimeout(() => { label.textContent = 'Copy email'; }, 1800);
    if (!ok) toast('Clipboard blocked by the browser — select the address instead.');
  });

  const replyBtn = el('a', { class: 'btn btn--ghost btn--sm', href: replyHref(lead) }, [
    icon('i-mail', 14), el('span', { class: 'btn__label', text: 'Reply' }),
  ]);

  /* Inline two-step delete — see armConfirm() for why there is no window.confirm. */
  const delBtn = el('button', { type: 'button', class: 'btn btn--ghost btn--sm btn--danger' }, [
    icon('i-trash', 14), el('span', { class: 'btn__label', text: 'Delete' }),
  ]);
  armConfirm(delBtn, 'Delete', async () => {
    delBtn.disabled = true;
    root.classList.add('is-pending');
    try {
      await api(`/api/leads/${lead.id}`, { method: 'DELETE' });
      state.counts[lead.status] = Math.max(0, (state.counts[lead.status] || 0) - 1);
      state.total = Math.max(0, state.total - 1);
      removeRow(root, lead.id);
      renderTabs();
      renderPager();
      toast(`Deleted ${lead.name || 'lead'}.`, 'ok');
    } catch (err) {
      delBtn.disabled = false;
      root.classList.remove('is-pending');
      if (err.status !== 401) toast(`Delete failed — ${humanise(err)}`);
    }
  });

  const body = el('div', { class: 'lead__body', id: bodyId }, [
    el('div', { class: 'meta' }, [
      metaCell('Received', stamp(lead.created_at)),
      metaCell('Phone', lead.phone, telHref(lead.phone)),
      metaCell('Budget', lead.budget),
      metaCell('Service', lead.service),
      metaCell('Source', lead.source),
    ]),
    el('div', { class: 'message', text: lead.message || '(no message)' }),
    el('div', { class: 'notes' }, [
      el('div', { class: 'notes__head' }, [
        el('span', { class: 'meta__k', text: 'Notes' }),
        savedFlag,
      ]),
      notesInput,
    ]),
    el('div', { class: 'rowbar' }, [
      el('div', { class: 'status-set' }, [
        el('span', { class: 'status-set__label', text: 'Status' }),
        select,
      ]),
      el('div', { class: 'rowbar__acts' }, [replyBtn, copyBtn, delBtn]),
    ]),
  ]);
  body.hidden = !open;

  root.append(toggle, body);
  return root;
}

function removeRow(root, id) {
  state.expanded.delete(id);
  state.leads = state.leads.filter((l) => l.id !== id);
  root.classList.add('is-leaving');
  setTimeout(() => {
    root.remove();
    if (state.leads.length === 0) renderList();
  }, 200);
}

async function copyText(text) {
  if (!text) return false;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fall through to the legacy path */ }
  try {
    // Class, not an inline style: the CSP in vercel.json is `style-src 'self'`.
    const ta = el('textarea', { class: 'offscreen', 'aria-hidden': 'true', tabindex: '-1' });
    ta.value = text;
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

/* ── Toolbar wiring ──────────────────────────────────────────────────────── */

let searchTimer = null;
searchEl.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    const q = searchEl.value.trim();
    if (q === state.q) return;
    state.q = q;
    state.offset = 0;
    writeHash();
    load();
  }, 300);
});
searchEl.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && searchEl.value) {
    ev.preventDefault();
    searchEl.value = '';
    searchEl.dispatchEvent(new Event('input'));
  }
});

const refreshBtn = $('#btn-refresh');
refreshBtn.addEventListener('click', async () => {
  refreshBtn.classList.add('is-busy');
  refreshBtn.disabled = true;
  await (state.view === 'content' ? loadContent({ skeleton: false }) : load({ skeleton: false }));
  refreshBtn.classList.remove('is-busy');
  refreshBtn.disabled = false;
});

$('#fatal-retry').addEventListener('click', () => load());

$('#pg-prev').addEventListener('click', () => {
  if (state.offset <= 0) return;
  state.offset = Math.max(0, state.offset - LIMIT);
  writeHash({ push: true });
  load();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});
$('#pg-next').addEventListener('click', () => {
  if (state.offset + LIMIT >= state.total) return;
  state.offset += LIMIT;
  writeHash({ push: true });
  load();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

$('#btn-logout').addEventListener('click', async () => {
  try { await api('/api/auth/logout', { method: 'POST', allow401: true }); }
  catch { /* the cookie is gone either way — fall through to the login screen */ }
  state.leads = [];
  state.expanded.clear();
  state.loaded = false;
  listEl.replaceChildren();
  resetContent();
  showLogin();
});

/* Back / forward through section + filter history. */
window.addEventListener('popstate', () => {
  if (viewDash.hidden) return;
  readHash();
  searchEl.value = state.q;
  setView(state.view, { silent: true });
  // Only the leads view keeps filters in the hash, so only it can need a refetch
  // here; setView already triggers the first load of a section it has never shown.
  if (state.view === 'leads' && state.loaded) {
    renderTabs();
    load();
  }
});

/* ══ CONTENT ═════════════════════════════════════════════════════════════════

   Clients and the headline numbers live in the database, but the public site is
   a STATIC build — it reads a snapshot of this data at build time, never at
   request time. So every editor below saves the instant you leave the field, and
   nothing a visitor sees changes until the site is rebuilt. That is the entire
   reason the publish bar exists and why it sits above the editors instead of
   under them.

   SECURITY — XSS: client names and notes are operator-entered rather than public,
   but they are still stored strings replayed into an authenticated page, so they
   go through el({ text }) / textContent exactly like lead data. Website URLs get
   an extra scheme check before they are allowed to become an href.
   ═══════════════════════════════════════════════════════════════════════════ */

/* Mirrors the server's own cap. Checking it here too means the obvious mistake —
   dragging in a 4MB screenshot — is answered instantly and in words, instead of
   after a pointless upload that returns a bare 413. */
const LOGO_MAX_BYTES = 256 * 1024;
const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
const LOGO_TYPES_HUMAN = 'a PNG, JPG, WebP or SVG';

/* Known settings, in the order they should be edited. Anything the API returns
   that is not listed here still gets an editor, with a label derived from the key
   — a new setting must never be invisible just because this file is out of date. */
const SETTING_FIELDS = [
  { key: 'students_trained',       label: 'Students trained (stat tile)',    hint: 'Short form for the big number blocks — “1.7k+”.' },
  { key: 'students_trained_prose', label: 'Students trained (in sentences)', hint: 'Written out for running copy — “1,700+”.' },
  { key: 'sessions_delivered',     label: 'Sessions delivered',              hint: 'Stat tile — “15+”.' },
  { key: 'technical_tracks',       label: 'Technical tracks',                hint: 'Stat tile — “7”.' },
  { key: 'workshops_count',        label: 'Workshops offered',               hint: 'Stat tile — “6”.' },
];
const SETTING_BY_KEY = new Map(SETTING_FIELDS.map((f) => [f.key, f]));

/* Field names as the operator sees them, for error sentences. */
const CLIENT_FIELD_LABEL = { name: 'Name', note: 'Note', url: 'Website' };

const content = {
  loaded: false,
  loading: false,
  reqId: 0,
  clients: [],
  settings: {},
  expanded: new Set(),
  /* client id -> cache-buster. The logo URL is deliberately cacheable, so after a
     replace the browser would otherwise keep showing the old bytes. */
  logoBust: new Map(),
};

const clientsRegion = $('#clients-region');
const clientsListEl = $('#clients-list');
const clientsSkeleton = $('#clients-skeleton');
const clientsEmpty = $('#clients-empty');
const clientsFatal = $('#clients-fatal');
const clientsCountEl = $('#clients-count');
const settingsListEl = $('#settings-list');
const publishBtn = $('#btn-publish');
const publishStateEl = $('#publish-state');

const addForm = $('#client-add');
const addName = $('#add-name');
const addNote = $('#add-note');
const addUrl = $('#add-url');
const addSubmit = $('#add-submit');
const addError = $('#add-error');

/* ── Small formatters ────────────────────────────────────────────────────── */

function fmtBytes(n) {
  if (!Number.isFinite(n)) return 'an unknown size';
  if (n < 1024) return `${n} bytes`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Normalise an operator-typed website to an absolute http(s) URL, or null.
 *
 * This is what stops `javascript:alert(1)` from ever reaching an href. It is not
 * about distrusting the operator so much as refusing to build a sink that only
 * behaves because of who is typing into it. A bare `example.com` is treated as
 * https, which is what anyone typing it means.
 */
function safeUrl(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`;
  let u;
  try { u = new URL(candidate); } catch { return null; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  if (!u.hostname.includes('.')) return null;
  return u.href;
}

const prettyHost = (href) => href.replace(/^https?:\/\//, '').replace(/\/$/, '');

/** snake_case -> "Snake case", for settings this file has not been taught yet. */
const humaniseKey = (key) => String(key).replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

/** "A .pdf file" / "A image/gif file" — used in the logo error sentences. */
function describeFile(file) {
  const ext = (String(file.name || '').match(/\.([a-z0-9]+)$/i) || [])[1];
  if (ext) return `A .${ext.toLowerCase()} file`;
  if (file.type) return `A ${file.type} file`;
  return 'That file';
}

/** Report a failed write. 401 is silent: api() has already dropped us to login. */
function reportError(err, prefix, inlineEl) {
  if (!err || err.status === 401) return;
  const message = `${prefix} — ${humanise(err)}`;
  if (inlineEl) setInline(inlineEl, message);
  else toast(message);
}

/* ── Loading ─────────────────────────────────────────────────────────────── */

function sortClients() {
  // id is the tie-break so equal sort_orders (hand-seeded rows) still render in
  // a stable order rather than shuffling between loads.
  content.clients.sort((a, b) => (a.sort_order - b.sort_order) || (a.id - b.id));
}

async function loadContent({ skeleton = true } = {}) {
  const id = ++content.reqId;
  content.loading = true;
  clientsRegion.setAttribute('aria-busy', 'true');
  clientsFatal.hidden = true;

  if (skeleton) {
    if (!clientsSkeleton.childElementCount) {
      clientsSkeleton.replaceChildren(...Array.from({ length: 3 }, () => el('div', { class: 'sk-row' })));
    }
    clientsSkeleton.hidden = false;
    clientsListEl.hidden = true;
    clientsEmpty.hidden = true;
  }

  try {
    // Two calls on purpose: the admin route is the only one that returns hidden
    // clients, and the settings map only exists on the public snapshot route.
    // `fresh` defeats any CDN copy of that public route — without it the console
    // can be handed back the value it just overwrote.
    const [adminRes, publicRes] = await Promise.all([
      api('/api/content/clients'),
      api(`/api/content?fresh=${Date.now()}`),
    ]);
    if (id !== content.reqId) return;   // a newer load already won

    content.clients = Array.isArray(adminRes.clients) ? adminRes.clients.slice() : [];
    sortClients();
    content.settings = (publicRes && publicRes.settings && typeof publicRes.settings === 'object')
      ? publicRes.settings
      : {};
    content.loaded = true;
    renderClients();
    renderSettings();
  } catch (err) {
    if (id !== content.reqId || err.status === 401) return;
    content.clients = [];
    clientsListEl.replaceChildren();
    clientsListEl.hidden = true;
    clientsEmpty.hidden = true;
    clientsFatal.hidden = false;
    $('#clients-fatal-text').textContent = humanise(err);
    // Deliberately NOT rendering empty number fields: blank boxes look like the
    // real values and invite someone to save nothing over something.
    settingsListEl.replaceChildren(
      el('p', { class: 'inline-error', text: 'The numbers could not be loaded either. Use “Try again” above.' }),
    );
  } finally {
    if (id === content.reqId) {
      content.loading = false;
      content.reqId === id && clientsRegion.setAttribute('aria-busy', 'false');
      clientsSkeleton.hidden = true;
    }
  }
}

function resetContent() {
  content.reqId += 1;                    // orphan any in-flight load
  content.loaded = false;
  content.loading = false;
  content.clients = [];
  content.settings = {};
  content.expanded.clear();
  content.logoBust.clear();
  clientsListEl.replaceChildren();
  settingsListEl.replaceChildren();
  clientsEmpty.hidden = true;
  clientsFatal.hidden = true;
  setPublishState('No publish started in this session.', null);
}

/* ── Clients ─────────────────────────────────────────────────────────────── */

function renderClients() {
  const frag = document.createDocumentFragment();
  content.clients.forEach((client, i) => frag.append(renderClient(client, i)));
  clientsListEl.replaceChildren(frag);

  const empty = content.clients.length === 0;
  clientsListEl.hidden = empty;
  clientsEmpty.hidden = !empty;
  clientsFatal.hidden = true;
  renderClientsCount();
}

function renderClientsCount() {
  const total = content.clients.length;
  const hidden = content.clients.reduce((n, c) => n + (c.active ? 0 : 1), 0);
  const label = total === 0
    ? 'no clients'
    : `${total} ${total === 1 ? 'client' : 'clients'}${hidden ? ` · ${hidden} hidden` : ''}`;
  clientsCountEl.textContent = label;
  if (state.view === 'content') totalEl.textContent = label;
}

/** Thumbnail, or the placeholder glyph when the row has no logo. */
function logoNode(client) {
  if (!client.logo) return icon('i-image', 20);
  const bust = content.logoBust.get(client.id);
  const img = el('img', {
    src: `/api/media/client/${encodeURIComponent(client.id)}${bust ? `?v=${bust}` : ''}`,
    alt: '',
    loading: 'lazy',
    decoding: 'async',
  });
  // A row can claim a logo the media route cannot serve. Show the placeholder
  // rather than a broken-image glyph, which looks like the console is broken.
  img.addEventListener('error', () => img.replaceWith(icon('i-image', 20)), { once: true });
  return img;
}

/**
 * PATCH one client, optimistically.
 *
 * `onOptimistic` is called synchronously after the local object is updated and
 * again after a rollback, so the caller has exactly one place to repaint from
 * `client` and never has to duplicate the "what does it look like now" logic.
 */
async function patchClient(client, patch, onOptimistic) {
  const prev = {};
  for (const k of Object.keys(patch)) prev[k] = client[k];
  Object.assign(client, patch);
  if (onOptimistic) onOptimistic();

  try {
    const res = await api(`/api/content/clients/${client.id}`, { method: 'PATCH', body: patch });
    if (res.client && typeof res.client === 'object') Object.assign(client, res.client);
    if (onOptimistic) onOptimistic();
    return { ok: true };
  } catch (err) {
    Object.assign(client, prev);
    if (onOptimistic) onOptimistic();
    return { ok: false, error: err };
  }
}

/**
 * Reorder with buttons, not drag-and-drop: a drag handle is unreachable from a
 * keyboard, and this list is a dozen rows at most.
 *
 * The whole list is renumbered densely (10, 20, 30…) rather than swapping two
 * values with each other. Seeded rows routinely share a sort_order, and swapping
 * two equal numbers is a no-op that silently un-does the move on the next reload.
 */
async function moveClient(client, dir) {
  const list = content.clients;
  const from = list.indexOf(client);
  const to = from + dir;
  if (from < 0 || to < 0 || to >= list.length) return;

  const snapshot = list.slice();
  const orders = new Map(list.map((c) => [c.id, c.sort_order]));

  list.splice(from, 1);
  list.splice(to, 0, client);

  const changed = [];
  list.forEach((c, i) => {
    const next = (i + 1) * 10;
    if (c.sort_order !== next) {
      c.sort_order = next;
      changed.push(c);
    }
  });

  renderClients();
  refocusMove(client.id, dir);

  try {
    await Promise.all(changed.map((c) => api(`/api/content/clients/${c.id}`, {
      method: 'PATCH',
      body: { sort_order: c.sort_order },
    })));
  } catch (err) {
    content.clients = snapshot;
    for (const c of content.clients) c.sort_order = orders.get(c.id);
    renderClients();
    refocusMove(client.id, dir);
    reportError(err, 'Order not saved');
  }
}

/**
 * The list is re-rendered on every move, which throws away focus. Put it back on
 * the button that was just pressed — or on its twin when the row has reached an
 * end and that button is now disabled — so the keyboard can move a row twice.
 */
function refocusMove(id, dir) {
  const row = clientsListEl.querySelector(`[data-id="${CSS.escape(String(id))}"]`);
  if (!row) return;
  const same = row.querySelector(dir < 0 ? '.js-up' : '.js-down');
  const twin = row.querySelector(dir < 0 ? '.js-down' : '.js-up');
  const target = same && !same.disabled ? same : twin;
  if (target && !target.disabled) target.focus();
}

function renderClient(client, index) {
  const editId = `client-edit-${client.id}`;
  const open = content.expanded.has(client.id);
  const who = client.name || 'this client';

  const root = el('article', {
    class: `client${open ? ' is-open' : ''}${client.active ? '' : ' is-off'}`,
    dataset: { id: String(client.id) },
  });

  /* ── head: identity ── */
  const thumb = el('div', { class: 'client__thumb' }, [logoNode(client)]);
  const nameEl = el('p', { class: 'client__name' });
  const noteEl = el('p', { class: 'client__note' });
  const siteWrap = el('span', { class: 'client__sitewrap' });
  const whoEl = el('div', { class: 'client__who' }, [nameEl, noteEl, siteWrap]);

  /* Everything that mirrors `client` into the head lives here, so the optimistic
     paint, the rollback paint and the initial paint are the same code path. */
  function syncHead() {
    nameEl.textContent = client.name || '(unnamed)';
    noteEl.textContent = client.note || 'No note';
    const href = safeUrl(client.url);
    if (href) {
      siteWrap.replaceChildren(el('a', {
        class: 'client__site', href, target: '_blank', rel: 'noopener noreferrer',
      }, [icon('i-link', 12), el('span', { text: prettyHost(href) })]));
    } else {
      siteWrap.replaceChildren();
    }
    root.classList.toggle('is-off', !client.active);
    swLabel.textContent = client.active ? 'Live' : 'Hidden';
    sw.setAttribute('aria-checked', String(Boolean(client.active)));
  }

  /* ── head: active switch ── */
  const swLabel = el('span', { text: client.active ? 'Live' : 'Hidden' });
  const sw = el('button', {
    type: 'button',
    class: 'switch client__sw',
    role: 'switch',
    'aria-checked': String(Boolean(client.active)),
    'aria-label': `Show ${who} on the website`,
  }, [el('span', { class: 'switch__track', 'aria-hidden': 'true' }), swLabel]);

  sw.addEventListener('click', async () => {
    sw.disabled = true;
    const { ok, error } = await patchClient(client, { active: !client.active }, syncHead);
    sw.disabled = false;
    renderClientsCount();
    if (ok) toast(`${client.name || 'Client'} is now ${client.active ? 'live' : 'hidden'}.`, 'ok');
    else reportError(error, 'Visibility not saved');
  });

  /* ── head: order ── */
  const upBtn = el('button', {
    type: 'button', class: 'btn btn--ghost js-up',
    title: 'Move up', 'aria-label': `Move ${who} up`, disabled: index === 0,
  }, [icon('i-up', 13)]);
  const downBtn = el('button', {
    type: 'button', class: 'btn btn--ghost js-down',
    title: 'Move down', 'aria-label': `Move ${who} down`,
    disabled: index === content.clients.length - 1,
  }, [icon('i-down', 13)]);
  upBtn.addEventListener('click', () => moveClient(client, -1));
  downBtn.addEventListener('click', () => moveClient(client, 1));

  /* ── head: edit / delete ── */
  const editBtn = el('button', {
    type: 'button', class: 'btn btn--ghost btn--sm',
    'aria-expanded': String(open), 'aria-controls': editId,
  }, [icon('i-pencil', 14), el('span', { class: 'btn__label', text: 'Edit' })]);

  const delBtn = el('button', {
    type: 'button', class: 'btn btn--ghost btn--sm btn--danger', 'aria-label': `Delete ${who}`,
  }, [icon('i-trash', 14), el('span', { class: 'btn__label', text: 'Delete' })]);

  armConfirm(delBtn, 'Delete', async () => {
    delBtn.disabled = true;
    root.classList.add('is-pending');
    try {
      await api(`/api/content/clients/${client.id}`, { method: 'DELETE' });
      content.expanded.delete(client.id);
      content.logoBust.delete(client.id);
      content.clients = content.clients.filter((c) => c.id !== client.id);
      root.classList.add('is-leaving');
      // Re-render after the leave transition: it also fixes every row's
      // move-button disabled state and the header count in one pass.
      setTimeout(renderClients, 200);
      toast(`Deleted ${client.name || 'client'}.`, 'ok');
    } catch (err) {
      delBtn.disabled = false;
      root.classList.remove('is-pending');
      reportError(err, 'Delete failed');
    }
  });

  const head = el('div', { class: 'client__head' }, [
    thumb,
    whoEl,
    sw,
    el('div', { class: 'client__acts' }, [
      el('div', { class: 'client__order' }, [upBtn, downBtn]),
      editBtn,
      delBtn,
    ]),
  ]);

  /* ── editor ── */
  const editError = el('p', { class: 'inline-error', role: 'alert', hidden: true });
  const savedFlag = el('span', { class: 'saved-flag', text: 'Saved' });

  function editField(labelText, key, attrs) {
    const input = el('input', Object.assign(
      { class: 'ifield__input', type: 'text', autocomplete: 'off', id: `client-${client.id}-${key}` },
      attrs,
    ));
    input.value = client[key] == null ? '' : String(client[key]);

    // Enter commits by blurring rather than submitting anything — there is no
    // form here, and leaving the field is already the save gesture.
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') { ev.preventDefault(); input.blur(); }
    });
    input.addEventListener('blur', () => saveField(input, key));

    const wrap = el('label', { class: 'ifield' }, [
      el('span', { class: 'ifield__label', text: labelText }),
      input,
    ]);
    return { wrap, input };
  }

  async function saveField(input, key) {
    const typed = input.value.trim();
    const current = client[key] == null ? '' : String(client[key]);
    if (typed === current) return;

    if (key === 'name' && !typed) {
      setInline(editError, 'A client needs a name.');
      input.value = current;
      return;
    }
    if (key === 'url' && typed && !safeUrl(typed)) {
      setInline(editError, 'That website doesn’t look like a link. Try https://example.com.');
      input.value = current;
      return;
    }
    setInline(editError, '');

    let next = typed;
    if (key === 'url') next = typed ? safeUrl(typed) : null;
    else if (key !== 'name') next = typed || null;

    const { ok, error } = await patchClient(client, { [key]: next }, syncHead);
    input.value = client[key] == null ? '' : String(client[key]);
    if (ok) flash(savedFlag);
    else reportError(error, `“${CLIENT_FIELD_LABEL[key]}” not saved`, editError);
  }

  const nameField = editField('Name', 'name', { maxlength: '120', required: true });
  const noteField = editField('Note', 'note', { maxlength: '200' });
  const urlField = editField('Website', 'url', { maxlength: '300', type: 'url', spellcheck: 'false' });

  /* ── editor: logo ── */
  const logoMeta = el('p', { class: 'edit__meta' });
  function setLogoMeta(text, isError) {
    logoMeta.textContent = text;
    logoMeta.classList.toggle('is-err', Boolean(isError));
  }
  setLogoMeta(client.logo
    ? 'Logo set · replacing it swaps the image everywhere on the site.'
    : `No logo yet · ${LOGO_TYPES_HUMAN}, up to ${fmtBytes(LOGO_MAX_BYTES)}.`);

  const fileInput = el('input', {
    type: 'file',
    class: 'logo-pick__input',
    accept: LOGO_TYPES.join(','),
    'aria-label': `Upload a logo for ${who}`,
  });
  const pickBtn = el('label', { class: 'btn btn--ghost btn--sm logo-pick' }, [
    icon('i-upload', 14),
    el('span', { class: 'btn__label', text: client.logo ? 'Replace logo' : 'Upload logo' }),
    fileInput,
  ]);

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;

    // Size first and always, so the number in any refusal below is one the
    // operator can see for themselves rather than take on trust.
    const size = fmtBytes(file.size);
    if (file.size > LOGO_MAX_BYTES) {
      setLogoMeta(`That file is ${size}, and the limit is ${fmtBytes(LOGO_MAX_BYTES)}. Export the logo smaller and try again.`, true);
      fileInput.value = '';
      return;
    }
    if (file.type && !LOGO_TYPES.includes(file.type)) {
      setLogoMeta(`${describeFile(file)} isn’t a format the site can use. Save it as ${LOGO_TYPES_HUMAN} image and try again.`, true);
      fileInput.value = '';
      return;
    }

    fileInput.disabled = true;
    setLogoMeta(`Uploading ${file.name} · ${size}…`);
    try {
      const res = await api(`/api/content/clients/${client.id}/logo`, { method: 'POST', raw: file });
      if (res.client && typeof res.client === 'object') Object.assign(client, res.client);
      // Fallback flag only: nothing here reads the path, the thumbnail is served
      // from /api/media/client/<id>. The real path arrives with the next load.
      else client.logo = client.logo || 'uploaded';

      content.logoBust.set(client.id, Date.now());
      thumb.replaceChildren(logoNode(client));
      $('.btn__label', pickBtn).textContent = 'Replace logo';
      setLogoMeta(`Logo updated · ${file.name} · ${size}.`);
      toast(`Logo updated for ${client.name || 'client'}.`, 'ok');
    } catch (err) {
      setLogoMeta(logoErrorText(err, file), true);
    } finally {
      fileInput.value = '';
      fileInput.disabled = false;
    }
  });

  const saveBtn = el('button', { type: 'button', class: 'btn btn--accent btn--sm' },
    [el('span', { class: 'btn__label', text: 'Done' })]);
  saveBtn.addEventListener('click', () => {
    // Every field already saved on blur — including the blur caused by this very
    // click — so this button only has to close the editor.
    content.expanded.delete(client.id);
    editBtn.setAttribute('aria-expanded', 'false');
    root.classList.remove('is-open');
    body.hidden = true;
    editBtn.focus();
  });

  const body = el('div', { class: 'client__edit', id: editId }, [
    el('div', { class: 'edit__grid' }, [nameField.wrap, noteField.wrap, urlField.wrap]),
    editError,
    el('div', { class: 'edit__foot' }, [
      el('div', { class: 'edit__logo' }, [pickBtn, logoMeta]),
      el('div', { class: 'edit__logo' }, [savedFlag, saveBtn]),
    ]),
  ]);
  body.hidden = !open;

  editBtn.addEventListener('click', () => {
    const nowOpen = !content.expanded.has(client.id);
    if (nowOpen) content.expanded.add(client.id); else content.expanded.delete(client.id);
    editBtn.setAttribute('aria-expanded', String(nowOpen));
    root.classList.toggle('is-open', nowOpen);
    body.hidden = !nowOpen;
    if (nowOpen) nameField.input.focus();
  });

  syncHead();
  root.append(head, body);
  return root;
}

/**
 * Turn an upload failure into a sentence with numbers in it. A raw "413" tells
 * the operator nothing they can act on; "that file is 512 KB, the limit is
 * 256 KB" tells them exactly what to do next.
 */
function logoErrorText(err, file) {
  if (!err) return 'Upload failed. Try again.';
  if (err.status === 401) return 'Your session expired. Sign in again, then re-upload.';

  const limit = Number(err.data && (err.data.limit || err.data.max_bytes)) || LOGO_MAX_BYTES;
  if (err.status === 413 || err.code === 'too_large') {
    return `That file is ${fmtBytes(file.size)}, and the limit is ${fmtBytes(limit)}. Export the logo smaller and try again.`;
  }
  if (err.status === 415 || err.code === 'unsupported_type' || err.code === 'unsupported_media_type') {
    return `${describeFile(file)} isn’t a format the site can use. Save it as ${LOGO_TYPES_HUMAN} image and try again.`;
  }
  return `Upload failed — ${humanise(err)}`;
}

/* ── Add a client ────────────────────────────────────────────────────────── */

addForm.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const name = addName.value.trim();
  const note = addNote.value.trim();
  const url = addUrl.value.trim();

  if (!name) { setInline(addError, 'A client needs a name.'); addName.focus(); return; }
  if (url && !safeUrl(url)) {
    setInline(addError, 'That website doesn’t look like a link. Try https://example.com.');
    addUrl.focus();
    return;
  }
  setInline(addError, '');

  addSubmit.disabled = true;
  $('.btn__label', addSubmit).textContent = 'Adding…';
  try {
    const res = await api('/api/content/clients', {
      method: 'POST',
      body: { name, note: note || null, url: url ? safeUrl(url) : null },
    });
    if (res.client && typeof res.client === 'object') {
      content.clients.push(res.client);
      sortClients();
      renderClients();
    } else {
      // The API answered ok but told us nothing — reload rather than invent a row.
      await loadContent({ skeleton: false });
    }
    addForm.reset();
    addName.focus();
    toast(`Added ${name}.`, 'ok');
  } catch (err) {
    if (err.status !== 401) setInline(addError, humanise(err));
  } finally {
    addSubmit.disabled = false;
    $('.btn__label', addSubmit).textContent = 'Add client';
  }
});

$('#clients-retry').addEventListener('click', () => loadContent());

/* ── Numbers (settings) ──────────────────────────────────────────────────── */

function renderSettings() {
  const extras = Object.keys(content.settings)
    .filter((k) => !SETTING_BY_KEY.has(k))
    .sort();
  const frag = document.createDocumentFragment();
  for (const key of [...SETTING_FIELDS.map((f) => f.key), ...extras]) frag.append(renderSetting(key));
  settingsListEl.replaceChildren(frag);
}

function renderSetting(key) {
  const def = SETTING_BY_KEY.get(key) || { label: humaniseKey(key), hint: '' };
  const inputId = `set-${key}`;
  const savedFlag = el('span', { class: 'saved-flag', text: 'Saved' });
  const errorEl = el('p', { class: 'inline-error', role: 'alert', hidden: true });

  const input = el('input', {
    class: 'ifield__input', type: 'text', id: inputId, maxlength: '60',
    autocomplete: 'off', spellcheck: 'false',
  });
  input.value = content.settings[key] == null ? '' : String(content.settings[key]);

  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') { ev.preventDefault(); input.blur(); }
  });

  input.addEventListener('blur', async () => {
    const next = input.value.trim();
    const prev = content.settings[key] == null ? '' : String(content.settings[key]);
    if (next === prev) return;
    setInline(errorEl, '');

    content.settings[key] = next;                          // optimistic
    try {
      const res = await api('/api/content/settings', { method: 'PATCH', body: { [key]: next } });
      if (res.settings && typeof res.settings === 'object') Object.assign(content.settings, res.settings);
      input.value = content.settings[key] == null ? '' : String(content.settings[key]);
      flash(savedFlag);
    } catch (err) {
      content.settings[key] = prev;                        // roll back
      input.value = prev;
      if (err.status !== 401) setInline(errorEl, `Not saved — ${humanise(err)}`);
    }
  });

  return el('div', { class: 'setting' }, [
    el('div', { class: 'setting__head' }, [
      el('label', { class: 'ifield__label', for: inputId, text: def.label }),
      savedFlag,
    ]),
    input,
    def.hint ? el('p', { class: 'setting__hint', text: def.hint }) : null,
    errorEl,
  ]);
}

/* ── Publish ─────────────────────────────────────────────────────────────── */

const clockFmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });

function setPublishState(text, kind) {
  publishStateEl.textContent = text;
  publishStateEl.classList.toggle('is-busy', kind === 'busy');
  publishStateEl.classList.toggle('is-ok', kind === 'ok');
  publishStateEl.classList.toggle('is-err', kind === 'err');
}

publishBtn.addEventListener('click', async () => {
  publishBtn.disabled = true;
  $('.btn__label', publishBtn).textContent = 'Publishing…';
  setPublishState('Asking the site to rebuild…', 'busy');

  try {
    await api('/api/publish', { method: 'POST' });
    setPublishState(
      `Rebuild started at ${clockFmt.format(new Date())}. It usually takes a few minutes; ` +
      'reload earthlingaidtech.com after that to see the change. You can keep editing meanwhile.',
      'ok',
    );
  } catch (err) {
    // Nothing was lost either way — the edits were saved as they were made. Say
    // so, because "publish failed" reads like "your work is gone".
    setPublishState(
      err.status === 401
        ? 'Session expired before the rebuild started. Sign in and press Publish again — your edits are saved.'
        : `Publish failed at ${clockFmt.format(new Date())} — ${humanise(err)} Your edits are saved; press Publish again.`,
      'err',
    );
  } finally {
    publishBtn.disabled = false;
    $('.btn__label', publishBtn).textContent = 'Publish site';
  }
});

/* ── Boot ────────────────────────────────────────────────────────────────── */

async function enterDashboard() {
  readHash();
  searchEl.value = state.q;
  renderTabs();
  show('dash');
  updateExportLink();
  setView(state.view, { silent: true });   // loads whichever section the hash asked for
}

async function boot() {
  show('boot');
  try {
    const s = await api('/api/auth/session', { allow401: true });
    if (s.authed) await enterDashboard();
    else showLogin();
  } catch {
    // Session probe failed (offline, cold start). Login is the safe landing.
    showLogin();
    setLoginError('Could not reach the server. Sign in to retry.');
  }
}

boot();
