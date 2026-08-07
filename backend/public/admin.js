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
 */
async function api(path, { method = 'GET', body, allow401 = false } = {}) {
  let res;
  try {
    res = await fetch(path, {
      method,
      credentials: 'include',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
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
  status: '',
  q: '',
  offset: 0,
  total: 0,
  counts: { new: 0, contacted: 0, qualified: 0, won: 0, lost: 0 },
  leads: [],
  expanded: new Set(),
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
  const status = p.get('status') || '';
  state.status = STATUS_KEYS.includes(status) ? status : '';
  state.q = p.get('q') || '';
  const off = Number.parseInt(p.get('offset') || '0', 10);
  state.offset = Number.isFinite(off) && off > 0 ? off : 0;
}

function writeHash({ push = false } = {}) {
  const p = queryParams({ paged: false });
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
  totalEl.textContent = all === 1 ? '1 lead' : `${all} leads`;
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

  /* Inline two-step delete. No window.confirm anywhere in this app — a native
     modal would block the headless automation used to screenshot the console. */
  const delBtn = el('button', { type: 'button', class: 'btn btn--ghost btn--sm btn--danger' }, [
    icon('i-trash', 14), el('span', { class: 'btn__label', text: 'Delete' }),
  ]);
  let armTimer = null;
  const disarm = () => {
    clearTimeout(armTimer);
    armTimer = null;
    delBtn.classList.remove('btn--armed');
    delBtn.removeAttribute('aria-live');
    $('.btn__label', delBtn).textContent = 'Delete';
  };
  delBtn.addEventListener('blur', () => { if (armTimer) disarm(); });
  delBtn.addEventListener('click', async () => {
    if (!armTimer) {
      delBtn.classList.add('btn--armed');
      delBtn.setAttribute('aria-live', 'assertive');
      $('.btn__label', delBtn).textContent = 'Confirm?';
      armTimer = setTimeout(disarm, 4000);
      return;
    }
    disarm();
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
      metaCell('Phone', lead.phone, lead.phone ? `tel:${encodeURIComponent(lead.phone)}` : null),
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
    const ta = el('textarea', { style: 'position:fixed;top:-1000px;opacity:0' });
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
  await load({ skeleton: false });
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
  listEl.replaceChildren();
  showLogin();
});

/* Back / forward through filter history. */
window.addEventListener('popstate', () => {
  if (viewDash.hidden) return;
  readHash();
  searchEl.value = state.q;
  renderTabs();
  load();
});

/* ── Boot ────────────────────────────────────────────────────────────────── */

async function enterDashboard() {
  readHash();
  searchEl.value = state.q;
  renderTabs();
  show('dash');
  updateExportLink();
  await load();
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
