/* ============================================================
   ADEPTIO Adaptive HR — Owner Edition · v2.4.1.smbowner
   End-to-end test harness (Playwright · real Chromium)

   EXTENDS tools/smoke.js (structural, node-VM, no DOM) into a
   live-browser suite against the client-rendered SPA:
     1. Crawl every route across 3 personas × {web, mobile}
        + launcher + 3 sign-in portal frames + register flow.
        Records console/page errors + bad tokens per page.
     2. Per-persona primary flows (login → dashboard → module →
        create/edit/save) with persistence asserted against the
        live in-memory DB stores (LEDGER, PAYROLL, TAX, FLAGS,
        APPROVALS, DBOPS, WORK, REG) via page.evaluate.
     3. Dead-button / dead-end enumeration on every screen.
   Serves the app from a built-in static server (no external
   server, no network beyond optional web fonts).

   Run:  cd tools/e2e && npm install && node e2e.mjs
   Out:  report.md  ·  results.json  ·  screenshots/<id>.png (failures)
   ============================================================ */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(__dirname, '..', '..');          // the app folder (index.html lives here)
const SHOTS = path.join(__dirname, 'screenshots');
const REPORT = path.join(__dirname, 'report.md');
const RESULTS = path.join(__dirname, 'results.json');

fs.rmSync(SHOTS, { recursive: true, force: true });
fs.mkdirSync(SHOTS, { recursive: true });

/* ---------- findings model ---------- */
const SEV = { BLOCKER: 0, CRITICAL: 1, HIGH: 2, MEDIUM: 3, LOW: 4, INFO: 5 };
const results = {
  app: 'v2.4.1.smbowner', startedAt: new Date().toISOString(),
  counts: { pass: 0, fail: 0 }, findings: [], crawl: [], flows: [], deadButtons: []
};
let shotN = 0;
function finding(severity, area, title, detail, shot) {
  results.findings.push({ severity, area, title, detail: detail || '', shot: shot || null });
}
const okN = (m) => { results.counts.pass++; };
const failN = (m) => { results.counts.fail++; };

async function shot(page, label) {
  const name = `${String(++shotN).padStart(2, '0')}-${label.replace(/[^a-z0-9]+/gi, '_').slice(0, 70)}.png`;
  try { await page.screenshot({ path: path.join(SHOTS, name), fullPage: true }); } catch { /* frame detached */ }
  return name;
}

/* ---------- assert helper: pass silently, fail → finding(+shot) ---------- */
async function assert(page, cond, severity, area, title, detail) {
  if (cond) { okN(title); return true; }
  failN(title);
  const s = await shot(page, `${area}-${title}`);
  finding(severity, area, title, detail, s);
  console.log(`  ✗ [${severity}] ${area} — ${title}${detail ? ' :: ' + detail : ''}`);
  return false;
}

/* ============================================================
   static server — serve APP_ROOT
   ============================================================ */
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.ico': 'image/x-icon', '.png': 'image/png', '.woff2': 'font/woff2' };
function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      try {
        let url = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
        if (url === '/' || url === '') url = '/index.html';
        const fp = path.join(APP_ROOT, url);
        if (!fp.startsWith(APP_ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
          res.writeHead(404, { 'content-type': 'text/plain' }); res.end('404'); return;
        }
        res.writeHead(200, { 'content-type': MIME[path.extname(fp)] || 'application/octet-stream' });
        fs.createReadStream(fp).pipe(res);
      } catch (e) { res.writeHead(500); res.end('500'); }
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

/* ============================================================
   page helpers
   ============================================================ */
const BAD_TOKENS = ['undefined', 'NaN', '[object Object]'];

async function goHash(page, hash) {
  await page.evaluate(h => { window.location.hash = h; }, hash);
  await page.waitForTimeout(90);        // CSS fade + any async beat
}
async function setPortal(page, on) {
  await page.evaluate(v => { window.AUTH && AUTH.setPortal(v); }, on);
}
// attach error capture; returns {flush()} giving errors since last flush, tagged with `where`
function attachErrorCapture(page) {
  const buf = [];
  page.on('pageerror', e => buf.push({ type: 'pageerror', text: String(e && e.message || e) }));
  page.on('console', m => { if (m.type() === 'error') buf.push({ type: 'console', text: m.text() }); });
  page.on('requestfailed', r => {
    const u = r.url();
    buf.push({ type: 'requestfailed', text: u, external: /fonts\.(googleapis|gstatic)\.com/.test(u) });
  });
  return {
    flush() { const out = buf.slice(); buf.length = 0; return out; }
  };
}

// visible text of the rendered app shell
async function appText(page) {
  return page.evaluate(() => (document.getElementById('app')?.innerText || ''));
}
// current rendered screen title (web → workspace h1 / launcher hero h1 ; mobile → .ah-t)
async function renderedTitle(page, device) {
  return page.evaluate((dev) => {
    if (dev === 'mobile') return (document.querySelector('.app-head .ah-t')?.textContent || '').trim();
    const h = document.querySelector('.workspace h1') || document.querySelector('main h1');
    return (h?.textContent || '').trim();
  }, device);
}

/* ============================================================
   MAIN
   ============================================================ */
const { server, port } = await startServer();
const BASE = `http://127.0.0.1:${port}/`;
console.log(`\nADEPTIO v2.4.1.smbowner — e2e\nserving ${APP_ROOT}\n  → ${BASE}\n`);

const browser = await chromium.launch();

try {
  /* ---------------------------------------------------------
     SECTION 1 — CRAWL (open-demo: wall down, every screen reachable)
     --------------------------------------------------------- */
  console.log('SECTION 1 — crawl routes (3 personas × web/mobile) + portals\n');
  for (const device of ['web', 'mobile']) {
    const vp = device === 'mobile' ? { width: 414, height: 900 } : { width: 1366, height: 900 };
    const ctx = await browser.newContext({ viewport: vp });
    const page = await ctx.newPage();
    const errs = attachErrorCapture(page);
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!(window.PERSONAS && window.AUTH && window.DATA), null, { timeout: 8000 });
    errs.flush();

    // enumerate the true renderable screen set + flag-hidden set, per persona
    const graph = await page.evaluate((dev) => {
      const out = {};
      for (const k of window.PERSONA_ORDER) {
        const P = window.PERSONAS[k];
        const map = dev === 'web' ? P.web : P.mobile;
        const hidden = Array.from(window.FLAGS.hiddenScreens(window.DATA.cur().id, k) || []);
        out[k] = { screens: Object.keys(map), hidden };
      }
      return out;
    }, device);

    // drop the wall for the whole crawl
    await setPortal(page, false);

    for (const persona of Object.keys(graph)) {
      const { screens, hidden } = graph[persona];
      for (const screen of screens) {
        const hash = `/${persona}/${device}/${screen}`;
        await goHash(page, hash);
        const pageErrs = errs.flush();
        const isHidden = hidden.includes(screen);

        const expected = await page.evaluate(({ persona, screen, device }) => {
          try { const def = window.PERSONAS[persona][device][screen](); return (def && def.title || '').trim(); }
          catch (e) { return '__throw__:' + e.message; }
        }, { persona, screen, device });

        const title = await renderedTitle(page, device);
        const txt = await appText(page);
        const bad = BAD_TOKENS.filter(t => txt.includes(t));
        const hardErrs = pageErrs.filter(e => e.type === 'pageerror' || (e.type === 'console' && e.type !== 'requestfailed'));
        const extReqFail = pageErrs.filter(e => e.type === 'requestfailed' && e.external);
        const intReqFail = pageErrs.filter(e => e.type === 'requestfailed' && !e.external);

        const rec = { hash, persona, device, screen, isHidden, expectedTitle: expected, renderedTitle: title, bad, errors: hardErrs.map(e => e.text) };
        results.crawl.push(rec);

        // page-level JS errors → CRITICAL
        if (hardErrs.length) {
          await assert(page, false, 'CRITICAL', 'crawl', `console/page error on ${hash}`, hardErrs.map(e => `${e.type}: ${e.text}`).join(' | '));
        } else { okN(hash); }

        // expected screen threw at render
        if (String(expected).startsWith('__throw__')) {
          await assert(page, false, 'CRITICAL', 'crawl', `render fn threw: ${hash}`, expected);
        }

        // routing: rendered screen should match expected (unless intentionally flag-hidden → redirect is expected)
        if (!isHidden && expected && !String(expected).startsWith('__throw__')) {
          await assert(page, title === expected, 'HIGH', 'crawl',
            `route renders wrong screen: ${hash}`,
            `expected title "${expected}", got "${title}" (router fell back → dead/!nav route)`);
        } else if (isHidden) {
          finding('INFO', 'crawl', `screen hidden by feature flag: ${hash}`, `"${screen}" is gated off by default (FLAGS) — direct hash redirects to the persona landing. Expected behavior.`);
        }

        // bad tokens in visible text
        if (bad.length) {
          await assert(page, false, 'MEDIUM', 'crawl', `bad token(s) rendered: ${hash}`, `found ${bad.join(', ')} in visible text`);
        }
        // internal asset 404 (not fonts)
        if (intReqFail.length) {
          await assert(page, false, 'HIGH', 'crawl', `internal asset failed to load: ${hash}`, intReqFail.map(e => e.text).join(', '));
        }
        if (extReqFail.length) {
          finding('INFO', 'crawl', `external resource blocked (offline web font): ${hash}`, extReqFail.map(e => e.text).join(', '));
        }
      }
    }

    // launcher + register + register/done
    for (const h of ['/launcher', '/register', '/register/done']) {
      await goHash(page, h);
      const e = errs.flush().filter(x => x.type === 'pageerror' || x.type === 'console');
      const txt = await appText(page);
      await assert(page, e.length === 0, 'CRITICAL', 'crawl', `console/page error on ${h}`, e.map(x => x.text).join(' | '));
      await assert(page, txt.length > 60, 'HIGH', 'crawl', `${h} renders content`, `body length ${txt.length}`);
    }

    await ctx.close();
  }

  /* ---------------------------------------------------------
     SECTION 1b — SIGN-IN PORTAL (wall up): 3 frames, wrong pwd, scope block, logout, demo toggle
     --------------------------------------------------------- */
  console.log('\nSECTION 1b — sign-in portal + auth flows\n');
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    const page = await ctx.newPage();
    const errs = attachErrorCapture(page);
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.AUTH, null, { timeout: 8000 });

    // raise the wall by entering a persona while portal on (default)
    await goHash(page, '/owner/web/dashboard');
    const frames = await page.$$eval('.lp-frame', els => els.length);
    await assert(page, frames === 3, 'HIGH', 'auth', 'portal shows 3 persona frames', `found ${frames}`);

    // wrong password → error note
    await page.evaluate(() => { const i = document.querySelector('[data-pwd="owner"]'); if (i) i.value = 'WRONG'; });
    await page.click('[data-act="auth-signin:owner"]');
    await page.waitForTimeout(80);
    const errNote = await page.$('.lg-note.bad');
    await assert(page, !!errNote, 'HIGH', 'auth', 'wrong password shows error', 'expected .lg-note.bad after bad sign-in');

    // sign in each persona (select explicit account, click sign-in, verify landing)
    const cases = [
      { persona: 'staff', acct: 'staff@phoungern.la', land: 'today' },
      { persona: 'owner', acct: 'owner@phoungern.la', land: 'dashboard' },
      { persona: 'platform', acct: 'platform@adeptio.la', land: 'overview' },
    ];
    for (const c of cases) {
      await page.evaluate(() => { window.AUTH.signOut(); window.AUTH.setPortal(true); window.location.hash = '#/' + 'launcher'; });
      await goHash(page, `/${c.persona}/web/${c.land}`);   // raise wall, focus persona
      // pick the explicit account → change handler fills its password
      await page.selectOption(`select[data-acct="${c.persona}"]`, c.acct).catch(() => {});
      await page.waitForTimeout(40);
      await page.click(`[data-act="auth-signin:${c.persona}"]`);
      await page.waitForTimeout(110);
      const ses = await page.evaluate(() => window.AUTH.session());
      const hash = await page.evaluate(() => location.hash);
      await assert(page, !!ses && ses.email === c.acct, 'HIGH', 'auth', `sign-in works: ${c.acct}`, `session=${JSON.stringify(ses)}`);
      await assert(page, hash.includes(`/${c.persona}/web/${c.land}`), 'HIGH', 'auth', `lands on ${c.persona}/${c.land}`, `hash=${hash}`);
    }

    // scope block: signed in as staff, attempt owner → redirected back + warn toast
    await page.evaluate(() => { window.AUTH.signOut(); window.AUTH.setPortal(true); });
    await goHash(page, '/staff/web/today');
    await page.selectOption('select[data-acct="staff"]', 'staff@phoungern.la').catch(() => {});
    await page.click('[data-act="auth-signin:staff"]'); await page.waitForTimeout(100);
    await goHash(page, '/owner/web/dashboard');
    const afterScope = await page.evaluate(() => location.hash);
    const toast = await page.$('.toast.warn');
    await assert(page, afterScope.includes('/staff/'), 'HIGH', 'auth', 'cross-persona access blocked (scope guard)', `staff tried owner; ended at hash=${afterScope}`);
    await assert(page, !!toast, 'MEDIUM', 'auth', 'scope block surfaces a warning toast', 'expected .toast.warn');

    // logout → launcher
    await page.evaluate(() => { const b = document.querySelector('[data-act="auth-logout"]'); if (b) b.click(); });
    await page.waitForTimeout(100);
    const outSes = await page.evaluate(() => window.AUTH.session());
    await assert(page, outSes === null, 'MEDIUM', 'auth', 'logout clears the session', `session=${JSON.stringify(outSes)}`);

    // open-demo toggle from launcher meta → wall drops
    await goHash(page, '/launcher');
    await page.evaluate(() => { window.AUTH.setPortal(true); });
    await goHash(page, '/launcher');
    await page.click('[data-act="portal-mode:off"]').catch(async () => { await page.evaluate(() => AUTH.setPortal(false)); });
    await page.waitForTimeout(80);
    await goHash(page, '/owner/web/dashboard');
    const demoHash = await page.evaluate(() => location.hash);
    const onApp = await page.$('.workspace');
    await assert(page, !!onApp && demoHash.includes('/owner/'), 'MEDIUM', 'auth', 'open-demo drops the wall (walk straight in)', `hash=${demoHash}`);

    await ctx.close();
  }

  /* ---------------------------------------------------------
     SECTION 2 — PER-PERSONA FLOWS (login → module → create/edit/save → persisted in DB store)
     each block reloads (state → seed, wall up) then signs in for real
     --------------------------------------------------------- */
  console.log('\nSECTION 2 — primary user flows + DB-store persistence\n');

  async function freshSignIn(page, persona, acct, land) {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });   // reload resets in-memory stores + portal=on
    await page.waitForFunction(() => !!(window.AUTH && window.DATA), null, { timeout: 8000 });
    await goHash(page, `/${persona}/web/${land}`);
    await page.selectOption(`select[data-acct="${persona}"]`, acct).catch(() => {});
    await page.waitForTimeout(40);
    await page.click(`[data-act="auth-signin:${persona}"]`);
    await page.waitForTimeout(120);
  }

  /* ---------- OWNER ---------- */
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
    const page = await ctx.newPage();
    const errs = attachErrorCapture(page);
    const flow = { persona: 'owner', steps: [] };
    const step = (name, ok, note) => { flow.steps.push({ name, ok, note }); };

    await freshSignIn(page, 'owner', 'owner@phoungern.la', 'dashboard');
    const landed = await page.evaluate(() => location.hash);
    await assert(page, landed.includes('/owner/web/dashboard'), 'HIGH', 'flow-owner', 'login → dashboard', `hash=${landed}`);

    // (1) Cashbook: add entry → db_ledger grows + row visible
    await goHash(page, '/owner/web/cashbook');
    const ledgerBefore = await page.evaluate(() => LEDGER.all(DATA.state.tenantId).length);
    await page.fill('[data-led="amount"]', '1500000');
    await page.fill('[data-led="cat"]', 'E2E test sale');
    await page.selectOption('[data-led="kind"]', 'rev').catch(() => {});
    await page.click('[data-act="ledger:add"]'); await page.waitForTimeout(120);
    const ledgerAfter = await page.evaluate(() => LEDGER.all(DATA.state.tenantId).length);
    const rowVisible = (await appText(page)).includes('E2E test sale');
    const okLedger = await assert(page, ledgerAfter === ledgerBefore + 1 && rowVisible, 'HIGH', 'flow-owner',
      'cashbook add persists to db_ledger', `before=${ledgerBefore} after=${ledgerAfter} rowVisible=${rowVisible}`);
    step('cashbook add → db_ledger', okLedger);

    // (2) Pay run lifecycle: advance state
    await goHash(page, '/owner/web/pay-runs');
    const stBefore = await page.evaluate(() => PAYROLL.getRun(DATA.state.tenantId).state);
    await page.click('[data-act="pay-run:advance"]'); await page.waitForTimeout(120);
    const stAfter = await page.evaluate(() => PAYROLL.getRun(DATA.state.tenantId).state);
    const okAdvance = await assert(page, stBefore === 'draft' && stAfter === 'review', 'HIGH', 'flow-owner',
      'pay-run advance mutates db_payroll state', `state ${stBefore} → ${stAfter}`);
    step('pay-run advance', okAdvance);

    // (3) Run prep: per-person adjustment → save draft → commit (schedule)
    await freshSignIn(page, 'owner', 'owner@phoungern.la', 'dashboard');     // reset run state
    await goHash(page, '/owner/web/pay-runs');
    await page.evaluate(() => { const i = document.querySelector('[data-adj$=":allowance"]'); if (i) { i.value = '500000'; } });
    // fill first allowance input robustly
    const firstAdj = await page.$('input[data-adj$=":allowance"]');
    if (firstAdj) { await firstAdj.fill('500000'); }
    await page.click('[data-act="pay:adj-save"]'); await page.waitForTimeout(120);
    const draftSaved = await page.evaluate(() => !!PAYROLL.draftSavedAt(DATA.state.tenantId));
    const adjStored = await page.evaluate(() => {
      const tid = DATA.state.tenantId, ppl = DATA.people(tid);
      return ppl.some(p => { const a = PAYROLL.getAdj(tid, p.id); return a && a.allowance === 500000; });
    });
    const okDraft = await assert(page, draftSaved && adjStored, 'HIGH', 'flow-owner',
      'pay adjustment saves to draft (db_payroll)', `draftSaved=${draftSaved} adjStored=${adjStored}`);
    step('pay adj → draft', okDraft);

    const prBefore = await page.evaluate(() => PAYROLL.pendingPRs(DATA.state.tenantId).length);
    const commitBtn = await page.$('[data-act="pay:commit"]');
    if (commitBtn) { await commitBtn.click(); await page.waitForTimeout(120); }
    const prAfter = await page.evaluate(() => PAYROLL.pendingPRs(DATA.state.tenantId).length);
    const okCommit = await assert(page, !!commitBtn && prAfter === prBefore + 1, 'HIGH', 'flow-owner',
      'commit schedules a pending pay run', `commitBtn=${!!commitBtn} pending ${prBefore} → ${prAfter}`);
    step('pay commit → pendingPRs', okCommit);

    // (4) Tax centre: mark filed + amend VAT rate (effective-dated)
    await goHash(page, '/owner/web/tax');
    const fileBtn = await page.$('[data-act^="tax:file:"]');
    let okFiled = false;
    if (fileBtn) {
      const key = await fileBtn.evaluate(b => b.getAttribute('data-act').split(':').slice(2).join(':'));
      await fileBtn.click(); await page.waitForTimeout(110);
      okFiled = await page.evaluate(k => (TAX.calendar(DATA.state.tenantId).find(p => p.key === k) || {}).status === 'filed', key);
    }
    await assert(page, okFiled, 'HIGH', 'flow-owner', 'tax mark-filed persists to db_tax', `filed=${okFiled}`);
    step('tax mark filed', okFiled);

    const histBefore = await page.evaluate(() => TAX.history().length);
    await page.fill('[data-taxrate="vat"]', '8');
    await page.click('[data-act="tax:rate-vat"]'); await page.waitForTimeout(110);
    const histAfter = await page.evaluate(() => TAX.history().length);
    const vatNow = await page.evaluate(() => TAX.current().vat);
    const okVat = await assert(page, histAfter === histBefore + 1 && Math.abs(vatNow - 0.08) < 1e-9, 'MEDIUM', 'flow-owner',
      'VAT rate edit adds effective row (db_tax)', `history ${histBefore} → ${histAfter}, vat=${vatNow}`);
    step('vat rate amend', okVat);

    // (5) Functions: toggle EWA on → flag persists AND hidden Advances screen appears in rail
    await goHash(page, '/owner/web/functions');
    const ewaBefore = await page.evaluate(() => FLAGS.on(DATA.state.tenantId, 'ewa'));
    await page.click('[data-act="flags:toggle:ewa"]'); await page.waitForTimeout(110);
    const ewaAfter = await page.evaluate(() => FLAGS.on(DATA.state.tenantId, 'ewa'));
    await goHash(page, '/owner/web/dashboard');               // re-render rail
    const advInRail = await page.evaluate(() => !!document.querySelector('[data-go="owner/web/advances"]'));
    const okFlag = await assert(page, ewaBefore === false && ewaAfter === true && advInRail, 'HIGH', 'flow-owner',
      'feature flag toggle persists + reveals gated menu', `ewa ${ewaBefore}→${ewaAfter}, Advances in rail=${advInRail}`);
    step('flag toggle (EWA→Advances)', okFlag);

    // (6) Data studio: back up now → db snapshot lane grows
    await goHash(page, '/owner/web/datastudio');
    const bkBefore = await page.evaluate(() => DBOPS.list(DATA.state.tenantId).length);
    await page.click('[data-act="dbops:backup"]'); await page.waitForTimeout(110);
    const bkAfter = await page.evaluate(() => DBOPS.list(DATA.state.tenantId).length);
    const okBackup = await assert(page, bkAfter === bkBefore + 1, 'MEDIUM', 'flow-owner',
      'data studio backup appends a snapshot', `${bkBefore} → ${bkAfter}`);
    step('db backup', okBackup);

    // (7) Approvals: decide first item → pending decreases
    await goHash(page, '/owner/web/approvals');
    const apBefore = await page.evaluate(() => APPROVALS.pending(DATA.state.tenantId));
    const apBtn = await page.$('[data-act^="approve:"][data-act$=":approved"]');
    if (apBtn) { await apBtn.click(); await page.waitForTimeout(110); }
    const apAfter = await page.evaluate(() => APPROVALS.pending(DATA.state.tenantId));
    const okAppr = await assert(page, !!apBtn && apAfter === apBefore - 1, 'MEDIUM', 'flow-owner',
      'approval decision persists (db_workflow)', `pending ${apBefore} → ${apAfter}`);
    step('approval decide', okAppr);

    // (8) Scheduling: publish week → WORK store flips
    await goHash(page, '/owner/web/scheduling');
    await page.click('[data-act="sched:publish"]'); await page.waitForTimeout(110);
    const published = await page.evaluate(() => WORK.isPublished(DATA.state.tenantId));
    const okPub = await assert(page, published === true, 'MEDIUM', 'flow-owner', 'roster publish persists', `published=${published}`);
    step('scheduling publish', okPub);

    // (9) Tenant switch (topbar) → DATA.cur changes
    const tBefore = await page.evaluate(() => DATA.cur().id);
    await page.selectOption('[data-act-tenant]', 'vientianemart').catch(() => {});
    await page.waitForTimeout(110);
    const tAfter = await page.evaluate(() => DATA.cur().id);
    const okTenant = await assert(page, tBefore === 'phoungern' && tAfter === 'vientianemart', 'HIGH', 'flow-owner',
      'tenant switcher re-scopes the console', `${tBefore} → ${tAfter}`);
    step('tenant switch', okTenant);

    // (10) Leveling: switch L0→L2
    await page.evaluate(() => DATA.setTenant('phoungern'));
    await goHash(page, '/owner/web/leveling');
    await page.click('[data-act="pay-level:L2"]'); await page.waitForTimeout(110);
    const lvl = await page.evaluate(() => DATA.cur().level);
    const okLvl = await assert(page, lvl === 'L2', 'MEDIUM', 'flow-owner', 'leveling switch persists', `level=${lvl}`);
    step('leveling switch', okLvl);

    results.flows.push(flow);
    await ctx.close();
  }

  /* ---------- STAFF ---------- */
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
    const page = await ctx.newPage();
    const flow = { persona: 'staff', steps: [] };
    const step = (name, ok, note) => flow.steps.push({ name, ok, note });

    await freshSignIn(page, 'staff', 'staff@phoungern.la', 'today');
    const landed = await page.evaluate(() => location.hash);
    await assert(page, landed.includes('/staff/web/today'), 'HIGH', 'flow-staff', 'login → today', `hash=${landed}`);

    // walk the full staff menu
    for (const s of ['today', 'clock', 'attendance', 'leave', 'schedule', 'pay', 'documents', 'inbox', 'me']) {
      await goHash(page, `/staff/web/${s}`);
      const t = await renderedTitle(page, 'web');
      await assert(page, t.length > 0, 'HIGH', 'flow-staff', `menu reachable: ${s}`, `title="${t}"`);
    }

    // PRIMARY FLOW — clock in. The punch button has no handler → dead-end.
    await goHash(page, '/staff/web/clock');
    const punch = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.workspace button'));
      const b = btns.find(x => /clock in|selfie/i.test(x.textContent));
      if (!b) return { found: false };
      return { found: true, text: b.textContent.trim(), hasAct: b.hasAttribute('data-act'), hasGo: b.hasAttribute('data-go') };
    });
    const punchDead = punch.found && !punch.hasAct && !punch.hasGo;
    if (punchDead) {
      const s = await shot(page, 'flow-staff-clock-in-deadend');
      finding('HIGH', 'flow-staff', 'staff primary flow "Clock in" is a dead-end',
        `The "${punch.text}" punch button on /staff/web/clock has no data-act/data-go handler — clicking it does nothing, so a staff member cannot complete the core clock-in action. No db_time write occurs.`, s);
      failN('staff clock-in');
      console.log('  ✗ [HIGH] flow-staff — staff clock-in is a dead-end (no handler)');
    } else { okN('staff clock-in'); }
    step('clock-in (primary)', !punchDead, punchDead ? 'dead-end: punch button inert' : '');

    // note: staff has no completable create/edit/save that persists (EWA is flag-gated off by default)
    finding('INFO', 'flow-staff', 'staff persona has no persisting create/edit/save in this build',
      'All staff action buttons (Clock in, Request leave, Claim shift, Request a fix, Change password) are inert demo stubs; the only state-changing staff action (EWA request) is hidden unless the owner enables the EWA flag. Staff is effectively read-only this pass.');

    results.flows.push(flow);
    await ctx.close();
  }

  /* ---------- PLATFORM ---------- */
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
    const page = await ctx.newPage();
    const errs = attachErrorCapture(page);
    const flow = { persona: 'platform', steps: [] };
    const step = (name, ok, note) => flow.steps.push({ name, ok, note });

    await freshSignIn(page, 'platform', 'platform@adeptio.la', 'overview');
    const landed = await page.evaluate(() => location.hash);
    await assert(page, landed.includes('/platform/web/overview'), 'HIGH', 'flow-platform', 'login → overview', `hash=${landed}`);

    // (1) KYC email channel save
    await goHash(page, '/platform/web/registrations');
    errs.flush();
    await page.fill('[data-ch="host"]', 'smtp.e2e.test');
    await page.click('[data-act="kyc:channel-save"]'); await page.waitForTimeout(110);
    const host = await page.evaluate(() => REG.getChannel().host);
    const okCh = await assert(page, host === 'smtp.e2e.test', 'MEDIUM', 'flow-platform', 'KYC email channel save persists', `host=${host}`);
    step('channel save', okCh);

    // (2) Activate a pending registration → status active + outbox grows + pending shrinks
    const pendBefore = await page.evaluate(() => REG.pending().length);
    const obBefore = await page.evaluate(() => DATA.OUTBOX.length);
    const actBtn = await page.$('[data-act^="kyc:activate:"]');
    let activatedId = null;
    if (actBtn) {
      activatedId = await actBtn.evaluate(b => b.getAttribute('data-act').split(':')[2]);
      await actBtn.click(); await page.waitForTimeout(120);
    }
    const statusNow = await page.evaluate(id => (REG.get(id) || {}).status, activatedId);
    const obAfter = await page.evaluate(() => DATA.OUTBOX.length);
    const pendAfter = await page.evaluate(() => REG.pending().length);
    const okAct = await assert(page, statusNow === 'active' && obAfter === obBefore + 1 && pendAfter === pendBefore - 1, 'HIGH', 'flow-platform',
      'KYC activate persists (db_registration) + emails invite', `status=${statusNow} outbox ${obBefore}→${obAfter} pending ${pendBefore}→${pendAfter}`);
    step('KYC activate', okAct);

    // (3) Reject the next pending
    const rejBtn = await page.$('[data-act^="kyc:reject:"]');
    let okRej = false;
    if (rejBtn) {
      const id = await rejBtn.evaluate(b => b.getAttribute('data-act').split(':')[2]);
      await rejBtn.click(); await page.waitForTimeout(110);
      okRej = await page.evaluate(i => (REG.get(i) || {}).status === 'rejected', id);
    }
    await assert(page, okRej, 'MEDIUM', 'flow-platform', 'KYC reject persists', `rejected=${okRej}`);
    step('KYC reject', okRej);

    // (4) DB ops: per-tenant backup
    await goHash(page, '/platform/web/database');
    const dbBefore = await page.evaluate(() => DBOPS.list(DATA.cur().id).length);
    await page.click('[data-act="dbops:platform:backup"]'); await page.waitForTimeout(110);
    const dbAfter = await page.evaluate(() => DBOPS.list(DATA.cur().id).length);
    const okDb = await assert(page, dbAfter > dbBefore, 'MEDIUM', 'flow-platform', 'platform DB op snapshots + persists', `${dbBefore} → ${dbAfter}`);
    step('platform db backup', okDb);

    // (5) CRASH TEST — empty the KYC queue, then re-open registrations.
    //     platform.js calls empty(...) but never imports it → ReferenceError when queue is empty.
    await goHash(page, '/platform/web/registrations');
    errs.flush();
    await page.evaluate(() => {
      // reject everything still pending to drain the queue
      (REG.pending() || []).slice().forEach(r => REG.reject(r.id, 'e2e drain'));
    });
    await goHash(page, '/platform/web/registrations');     // re-render with empty queue
    await page.waitForTimeout(120);
    const drainErrs = errs.flush().filter(e => e.type === 'pageerror' || e.type === 'console');
    const stillRendered = (await appText(page)).length > 80;
    const emptyRefErr = drainErrs.some(e => /empty is not defined|empty is not a function/.test(e.text));
    if (emptyRefErr || !stillRendered) {
      const s = await shot(page, 'flow-platform-registrations-empty-crash');
      finding('CRITICAL', 'flow-platform', 'registrations screen crashes when KYC queue is empty',
        `platform.js references empty(...) (the empty-state helper) at the queue-clear fallback but never destructures it from UI (owner.js & staff.js do). Once the operator activates/rejects every pending registration, re-opening "KYC & registration" throws: ${drainErrs.map(e => e.text).join(' | ') || 'screen rendered blank'}.`, s);
      failN('empty-queue crash'); console.log('  ✗ [CRITICAL] flow-platform — registrations crashes on empty queue');
    } else {
      okN('empty-queue handled');
      finding('INFO', 'flow-platform', 'empty KYC queue handled without crash', 'Could not reproduce the empty(...) ReferenceError — verify manually.');
    }
    step('empty-queue crash test', !(emptyRefErr || !stillRendered), emptyRefErr ? 'ReferenceError: empty is not defined' : '');

    results.flows.push(flow);
    await ctx.close();
  }

  /* ---------------------------------------------------------
     SECTION 3 — DEAD BUTTONS / DEAD-ENDS (open-demo crawl, every screen)
     --------------------------------------------------------- */
  console.log('\nSECTION 3 — dead buttons / inert controls\n');
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.PERSONAS, null, { timeout: 8000 });
    await setPortal(page, false);

    const graph = await page.evaluate(() => {
      const out = {};
      for (const k of window.PERSONA_ORDER) out[k] = Object.keys(window.PERSONAS[k].web);
      return out;
    });

    let totalDead = 0;
    for (const persona of Object.keys(graph)) {
      for (const screen of graph[persona]) {
        await goHash(page, `/${persona}/web/${screen}`);
        const dead = await page.evaluate(() => {
          const scope = document.querySelector('.workspace') || document.body;
          const out = [];
          scope.querySelectorAll('button, a, [role="button"]').forEach(el => {
            const tag = el.tagName.toLowerCase();
            const cls = el.className || '';
            const interactive =
              el.hasAttribute('data-act') || el.hasAttribute('data-go') ||
              el.hasAttribute('data-act-tenant') || el.hasAttribute('data-payslip') ||
              el.matches('.switch, .nav-item, .sec-item, .tab, .pchip, .logo, .seg-logout, .seg-login, .back, .bell, .meta-act') ||
              (tag === 'a' && el.getAttribute('href')) ||
              el.closest('.seg, .lang');
            // selects/inputs in forms are handled by change/submit logic, skip
            if (!interactive && tag !== 'select' && tag !== 'input') {
              const txt = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40);
              if (txt) out.push({ tag, cls: String(cls).split(' ')[0] || '', txt });
            }
          });
          return out;
        });
        if (dead.length) {
          totalDead += dead.length;
          results.deadButtons.push({ persona, screen, count: dead.length, items: dead });
        }
      }
    }
    // classify: these are demo stubs by design (clickable shell). Report as MEDIUM aggregate + per-screen LOW detail.
    if (totalDead) {
      const sample = results.deadButtons.slice(0, 6).map(d => `${d.persona}/${d.screen}: ${d.items.map(i => `"${i.txt}"`).join(', ')}`).join(' · ');
      finding('MEDIUM', 'dead-buttons', `${totalDead} inert controls across ${results.deadButtons.length} screens`,
        `Buttons with no data-act/data-go/href that do nothing when clicked (demo-shell stubs). Examples — ${sample} … (full list in results.json).`);
      console.log(`  • ${totalDead} inert controls across ${results.deadButtons.length} screens (see results.json)`);
    }
    await ctx.close();
  }

  /* ---------------------------------------------------------
     SECTION 4 — informational baselines
     --------------------------------------------------------- */
  finding('INFO', 'persistence', 'all "DB stores" are in-memory only this pass (reset on reload)',
    'Per the README, the live DB/Worker is a later pass. Every persistence assertion above verifies the in-session engine state (db_ledger, db_payroll, db_tax, db_workflow, db_registration …). A browser reload discards all saves — expected for this build, noted so "persisted" is read as in-session.');
  finding('INFO', 'crawl', 'task brief said "4 personas + 3 sign-in portals"',
    'App ships 3 persona shells (Staff · Owner · Platform) + a 4th delegated role (Manager) that rides the Owner shell with a subset, and 3 sign-in portal frames. So "4 personas / 3 portals" reconciles to 3 shells (3 portal frames) + Manager-on-Owner.');

} catch (e) {
  finding('BLOCKER', 'harness', 'e2e harness aborted', String(e && e.stack || e));
  console.log('\nHARNESS ERROR:', e && e.stack || e);
} finally {
  await browser.close();
  server.close();
}

/* ============================================================
   REPORT
   ============================================================ */
results.finishedAt = new Date().toISOString();
results.findings.sort((a, b) => (SEV[a.severity] - SEV[b.severity]));
fs.writeFileSync(RESULTS, JSON.stringify(results, null, 2));

const bySev = {};
for (const f of results.findings) (bySev[f.severity] ||= []).push(f);
const order = ['BLOCKER', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
const emoji = { BLOCKER: '🟥', CRITICAL: '🟥', HIGH: '🟧', MEDIUM: '🟨', LOW: '🟦', INFO: '⬜' };

let md = '';
md += `# Adeptio Owner Edition · v2.4.1.smbowner — E2E report\n\n`;
md += `_Playwright · real Chromium · generated ${results.finishedAt}_\n\n`;
md += `**Result:** ${results.counts.fail === 0 ? '✅ no failing assertions' : '❌ ' + results.counts.fail + ' failing assertion(s)'} · `;
md += `${results.counts.pass} passed, ${results.counts.fail} failed · `;
md += `${results.crawl.length} routes crawled · ${results.flows.length} persona flows.\n\n`;

// severity summary table
md += `## Findings by severity\n\n| Severity | Count |\n|---|---|\n`;
for (const s of order) md += `| ${emoji[s]} ${s} | ${(bySev[s] || []).length} |\n`;
md += `\n> Screenshots for every failure are in \`tools/e2e/screenshots/\`. Full machine-readable detail in \`tools/e2e/results.json\`.\n\n`;

md += `## Findings (ordered by severity)\n\n`;
let n = 0;
for (const s of order) {
  for (const f of (bySev[s] || [])) {
    n++;
    md += `### ${n}. ${emoji[s]} [${s}] ${f.area} — ${f.title}\n\n`;
    if (f.detail) md += `${f.detail}\n\n`;
    if (f.shot) md += `![${f.title}](screenshots/${f.shot})\n\n`;
  }
}

// crawl matrix
md += `## Crawl matrix\n\nEvery route visited, per persona × device. ⚠ = wrong screen / token / error; · = clean; (hidden) = flag-gated.\n\n`;
const personas = ['staff', 'owner', 'platform'];
for (const dev of ['web', 'mobile']) {
  md += `**${dev}**\n\n`;
  for (const p of personas) {
    const rows = results.crawl.filter(c => c.persona === p && c.device === dev);
    if (!rows.length) continue;
    const cells = rows.map(r => {
      const flag = r.errors.length ? '⚠err' : r.bad.length ? '⚠tok' : (!r.isHidden && r.expectedTitle && r.renderedTitle !== r.expectedTitle) ? '⚠route' : r.isHidden ? '(hidden)' : '·';
      return `${r.screen}${flag === '·' ? '' : ' ' + flag}`;
    });
    md += `- \`${p}\`: ${cells.join(' · ')}\n`;
  }
  md += `\n`;
}

// flow summary
md += `## Flow step results\n\n`;
for (const fl of results.flows) {
  md += `**${fl.persona}**\n\n`;
  for (const s of fl.steps) md += `- ${s.ok ? '✅' : '❌'} ${s.name}${s.note ? ` — ${s.note}` : ''}\n`;
  md += `\n`;
}

// dead button appendix
md += `## Inert controls (dead buttons) — appendix\n\n`;
if (results.deadButtons.length) {
  md += `Controls with no \`data-act\`/\`data-go\`/\`href\` (do nothing on click). Demo-shell stubs by design, but flagged per the brief.\n\n`;
  for (const d of results.deadButtons) {
    md += `- \`${d.persona}/${d.screen}\` (${d.count}): ${d.items.map(i => `"${i.txt}"`).join(', ')}\n`;
  }
} else md += `_None detected._\n`;

md += `\n---\n_Re-run: \`cd tools/e2e && node e2e.mjs\`. Extends \`tools/smoke.js\` (node-VM structural test) with live-browser coverage._\n`;

fs.writeFileSync(REPORT, md);

console.log(`\n${'='.repeat(56)}`);
console.log(`DONE · ${results.counts.pass} passed · ${results.counts.fail} failed`);
for (const s of order) { const c = (bySev[s] || []).length; if (c) console.log(`  ${emoji[s]} ${s}: ${c}`); }
console.log(`report  → ${REPORT}`);
console.log(`results → ${RESULTS}`);
console.log(`shots   → ${SHOTS} (${shotN})`);
console.log('='.repeat(56));
process.exit(0);
