/* ============================================================
   ADEPTIO · app shell — router · shells · topbar · actions
   v2.4.1.smbowner · Owner Edition
   Route:  #/{persona}/{device}/{screen}[/{param}]
   Three personas: staff (single rail) · owner (TWO-TIER) · platform (single rail)
   ============================================================ */
(function () {
  const { icon, avatar, esc } = UI;
  const app = () => document.getElementById("app");

  const PVARS = {
    staff: ["--staff", "--staff-d", "--staff-ln", "--staff-bg"],
    owner: ["--owner", "--owner-d", "--owner-ln", "--owner-bg"],
    platform: ["--platform", "--platform-d", "--platform-ln", "--platform-bg"]
  };
  const defScreen = (k) => k === "owner" ? "dashboard" : k === "platform" ? "overview" : "today";
  const firstTab = (k) => PERSONAS[k].tabs[0].id;
  function firstScreen(P, dev) { return dev === "mobile" ? P.tabs[0].id : (P.twoTier ? "dashboard" : P.nav[0].items[0].id); }

  // owner web→mobile region map (device toggle keeps you near where you were)
  const OWNER_W2M = { dashboard: "home", people: "staff", attendance: "staff", scheduling: "staff", leave: "staff", messaging: "staff", access: "staff", "pay-runs": "pay", components: "pay", advances: "pay", statutory: "pay", payslips: "pay", leveling: "pay", cashbook: "books", close: "books", tax: "books", costbenefit: "books", reports: "books" };

  /* ---------------- routing ---------------- */
  function landingRoute(ses) {
    const p = AUTH.primaryScope(ses.scopes);
    return { view: "app", persona: p, device: "web", screen: defScreen(p) };
  }
  function route() {
    const h = location.hash.replace(/^#\/?/, "");
    if (h === "login") return (AUTH.portalOn() && AUTH.session()) ? landingRoute(AUTH.session()) : { view: "login" };
    if (!h || h === "launcher") return { view: "launcher" };
    // wall: sign-in mode + no session → login (focus the entered persona)
    if (AUTH.portalOn() && !AUTH.session()) {
      const p0 = h.split("/")[0];
      if (PERSONAS[p0]) AUTHV.state.focus = p0;
      return { view: "login" };
    }
    const [persona, device, screen, ...rest] = h.split("/");
    if (!PERSONAS[persona]) return { view: "launcher" };
    const P = PERSONAS[persona], dev = device === "mobile" ? "mobile" : "web";
    // scope rule — username decides the landing
    const ses = AUTH.portalOn() ? AUTH.session() : null;
    if (ses && AUTH.primaryScope(ses.scopes) !== persona) {
      const lr = landingRoute(ses);
      lr.blocked = `Signed in as ${ses.email} — that account has no ${P.label} access. Sign out to switch.`;
      return lr;
    }
    const map = dev === "web" ? P.web : P.mobile;
    let scr = map[screen] ? screen : firstScreen(P, dev);
    if (FLAGS.hiddenScreens(DATA.state.tenantId, persona).has(scr)) scr = firstScreen(P, dev); // feature off → its screen is hidden
    return { view: "app", persona, device: dev, screen: scr, param: rest.length ? decodeURIComponent(rest.join("/")) : undefined };
  }
  function go(path) { location.hash = "#/" + path; }
  window.go = go;

  /* ---------------- toast ---------------- */
  let toastWrap;
  window.toast = function (msg, tone) {
    if (!toastWrap) { toastWrap = document.createElement("div"); toastWrap.className = "toast-wrap"; document.body.appendChild(toastWrap); }
    const el = document.createElement("div");
    el.className = "toast" + (tone ? " " + tone : "");
    el.innerHTML = `${icon(tone === "warn" ? "alert" : "check")}<span>${msg}</span>`;
    toastWrap.appendChild(el);
    setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 350); }, 3600);
  };

  /* ---------------- device equiv ---------------- */
  function mobileEquiv(r) { const P = PERSONAS[r.persona]; if (r.persona === "owner") return OWNER_W2M[r.screen] || "more"; if (P.mobile[r.screen]) return r.screen; const tp = P.tabParent && P.tabParent[r.screen]; return tp || P.tabs[0].id; }
  function webEquiv(r) { const P = PERSONAS[r.persona]; if (P.web[r.screen]) return r.screen; return firstScreen(P, "web"); }

  /* ---------------- topbar ---------------- */
  function topbar(r) {
    const onApp = r.view === "app";
    const cur = onApp ? r.persona : null;
    const ses = AUTH.portalOn() ? AUTH.session() : null;
    const chips = PERSONA_ORDER.map(k => {
      const P = PERSONAS[k], v = PVARS[k];
      const noScope = ses && AUTH.primaryScope(ses.scopes) !== k;
      const action = noScope
        ? `data-act="toast:Signed in as ${ses.email} — no ${P.label} access. Sign out to switch accounts."`
        : `data-go="${k}/${onApp ? r.device : "web"}/${k === cur && onApp ? r.screen : defScreen(k)}"`;
      return `<button class="pchip ${noScope ? "locked" : ""}" style="--pc:var(${v[0]});--pd:var(${v[1]});--pl:var(${v[2]})"
        aria-pressed="${cur === k}" ${action} title="${P.label} · ${P.roleLine}">
        ${noScope ? icon("lock", "lk") : '<span class="dot"></span>'}<span class="pl">${P.label}</span></button>`;
    }).join("");

    let tenantUI = "";
    if (onApp) {
      if (r.persona === "platform") {
        tenantUI = `<div class="tenant-switch platform" title="Operator sees across all tenants"><span class="ts-mark">∀</span><div class="ts-body"><span class="ts-lbl">Scope</span><span class="ts-name">All tenants</span></div></div>`;
      } else if (r.persona === "owner") {
        const active = DATA.activeTenants();
        tenantUI = `<div class="tenant-switch" title="Switch tenant"><span class="ts-mark">${DATA.cur().short}</span><div class="ts-body"><span class="ts-lbl">Tenant</span><select data-act-tenant aria-label="Tenant">${active.map(t => `<option value="${t.id}" ${t.id === DATA.cur().id ? "selected" : ""}>${esc(t.name)}</option>`).join("")}</select></div>${icon("chevD", "ts-ico")}</div>`;
      } else {
        tenantUI = `<div class="tenant-switch"><span class="ts-mark">${DATA.cur().short}</span><div class="ts-body"><span class="ts-lbl">Company</span><span class="ts-name">${esc(DATA.cur().name)}</span></div></div>`;
      }
    }

    const acctUI = ses
      ? `<span class="avatar-btn session" title="${esc(ses.email)} · ${esc(ses.role)}">${avatar(ses.name)}</span>
         <button class="seg-logout" data-act="auth-logout" title="Sign out (${esc(ses.email)})">${icon("logout")}</button>`
      : AUTH.portalOn()
        ? `<button class="seg-login" data-go="login" title="Open the sign-in portal">${icon("key")} Sign in</button>`
        : `<button class="seg-login off" data-act="portal-mode:on" title="Open-demo is on — every persona opens without sign-in. Click to arm the portal.">${icon("eye")} Demo mode</button>`;

    return `<header class="topbar">
      <button class="logo" data-go="launcher" aria-label="Adeptio home">
        <span class="logo-mark">A</span>
        <span><span class="logo-word">Adeptio</span><br><span class="logo-sub">${t("app.suite")}</span></span>
      </button>
      <span class="ver">v2.4.1.smbowner${AUTH.portalOn() ? " · portal" : " · demo"}</span>
      <nav class="persona-switch" aria-label="Persona">${chips}</nav>
      ${tenantUI}
      <span class="spacer"></span>
      ${onApp ? `<div class="seg" role="group" aria-label="Device">
        <button aria-pressed="${r.device === "web"}" data-go="${r.persona}/web/${webEquiv(r)}">${icon("globe")} ${t("nav.web")}</button>
        <button aria-pressed="${r.device === "mobile"}" data-go="${r.persona}/mobile/${mobileEquiv(r)}">${icon("phone")} ${t("nav.mobile")}</button>
      </div>` : ""}
      <div class="seg lang" role="group" aria-label="Language">
        <button aria-pressed="true">EN</button>
        <button class="soon" aria-pressed="false" title="Lao language pack staged for the language wave — the portal & payslips already ship bilingual" data-act="lang-lo">ລາວ</button>
      </div>
      ${acctUI}
    </header>`;
  }

  /* ---------------- shared header ---------------- */
  function head(r, P, def) {
    const crumbs = `<nav class="crumbs" aria-label="Breadcrumb">
      <a data-go="${r.persona}/web/${firstScreen(P, "web")}">${P.label}</a>${icon("chevR")}<span class="here">${esc(def.title)}</span>
    </nav>`;
    const sh = `<div class="screen-head">
      <div><h1>${esc(def.title)}</h1>${def.sub ? `<p class="sub">${esc(def.sub)}</p>` : ""}</div>
      ${def.actions ? `<div class="actions">${def.actions}</div>` : ""}
    </div>`;
    return crumbs + sh;
  }

  /* ---------------- launcher ---------------- */
  function launcher() {
    const cards = PERSONA_ORDER.map(k => {
      const P = PERSONAS[k], m = PERSONA_META[k], v = PVARS[k];
      return `<article class="hub-card" data-go="${k}/web/${defScreen(k)}" style="--pc:var(${v[0]});--pd:var(${v[1]});--pb:var(${v[3]});--pl:var(${v[2]})">
        <span class="swatch">${icon(P.icon)}</span>
        <span class="who">${m.who}</span>
        <h3>${m.h}</h3>
        <p class="tag">${m.tag}</p>
        <ul>${m.pts.map(p => `<li>${p}</li>`).join("")}</ul>
        <div class="enter">
          <button data-go="${k}/web/${defScreen(k)}">${icon("globe")} Web</button>
          <button class="ghosted" data-go="${k}/mobile/${firstTab(k)}" aria-label="${P.label} mobile">${icon("phone")}</button>
        </div>
      </article>`;
    }).join("");
    const st = DATA.platformStats();
    return `${topbar({ view: "launcher" })}
    <main class="launcher screen-fade">
      <div class="hero">
        <span class="eyebrow">Adeptio Adaptive HR · Structure Blueprint v2.4.1.SmbOwner → Owner Edition UI</span>
        <h1>One backend, two people per shop,<br><em>one operator above them all.</em></h1>
        <p class="lede">A <strong>multi-tenant</strong> HR platform for the Lao small business — where the owner is also the manager, the HR and the bookkeeper. Enter a persona below to open its workspace: <strong>Staff</strong> and <strong>Owner</strong> live inside a shop; the <strong>Platform Administrator</strong> runs the whole fleet above them. Sign-in is pre-filled — or switch to <strong>open demo</strong> and walk straight in.</p>
      </div>
      <div class="hub-grid">${cards}</div>
      ${AUTHV.landingSection()}
      <div class="launch-meta">
        <span><b>3</b> personas</span>
        <span><b>${st.tenants}/${st.total}</b> tenants live</span>
        <span><b>10·3·1</b> seats / tenant</span>
        <span><b>Lao</b> NSSF + PIT payroll</span>
        <span data-act="portal-mode:${AUTH.portalOn() ? "off" : "on"}" class="meta-act" role="button" tabindex="0"><b>auth_portal</b> ${AUTH.portalOn() ? "on — open demo" : "off — arm sign-in"}</span>
        <span class="mono">Atelier Pastel · no drift</span>
      </div>
    </main>
    <footer class="footer-note">${icon("lock")} UI/UX preview for the dev team — structure & flows per Blueprint v2.4.1.SmbOwner · demo data, no backend this pass · © 2026 Adeptio.</footer>`;
  }

  /* ---------------- single-rail shell (staff · platform) ---------------- */
  function railShell(r) {
    const P = PERSONAS[r.persona];
    const def = P.web[r.screen](r.param);
    const hidden = FLAGS.hiddenScreens(DATA.state.tenantId, r.persona);
    const navHtml = P.nav.map(g => `
      <div class="group eyebrow">${g.group}</div>
      ${g.items.filter(it => !hidden.has(it.id)).map(it => {
      const cnt = typeof it.count === "function" ? it.count() : it.count;
      return `<button class="nav-item" aria-current="${r.screen === it.id}" data-go="${r.persona}/web/${it.id}">
          ${icon(it.icon)}<span class="lbl">${it.label}</span>${cnt ? `<span class="count">${cnt}</span>` : ""}</button>`;
    }).join("")}`).join("");
    const foot = r.persona === "platform"
      ? `<div class="tier-chip"><span class="led"></span><span>Cross-tenant operator</span></div><div class="note">tenant_id = null · sees resources & lifecycle, never sealed content</div>`
      : `<div class="tier-chip"><span class="led"></span><span>${esc(DATA.cur().name)}</span></div><div class="note">Free tier · ${DATA.cur().headcount} staff · in-app + email free</div>`;
    return `${topbar(r)}
    <div class="shell">
      <aside class="rail" aria-label="${P.label} navigation">
        <div class="rail-head"><span class="pin">${icon(P.icon)}</span><div><div class="t">${P.appName}</div><div class="s">${P.roleLine}</div></div></div>
        ${navHtml}
        <div class="rail-foot">${foot}</div>
      </aside>
      <main class="workspace"><div class="workspace-inner screen-fade">${head(r, P, def)}${def.body}</div></main>
    </div>`;
  }

  /* ---------------- two-tier shell (owner) ---------------- */
  function twoTierShell(r) {
    const P = PERSONAS[r.persona];
    const secId = P.sectionOf[r.screen] || "dashboard";
    const sec = P.sections.find(s => s.id === secId);
    const def = P.web[r.screen](r.param);
    const secRail = P.sections.map(s => {
      const cnt = typeof s.count === "function" ? s.count() : 0;
      return `<button class="sec-item" aria-current="${secId === s.id}" data-go="${r.persona}/web/${P.firstOf[s.id]}" title="${esc(s.title || s.label)}">
        ${icon(s.icon)}<span class="sl">${s.label}</span>${cnt ? `<span class="count">${cnt}</span>` : ""}</button>`;
    }).join("");
    let subRail = "";
    if (sec && !sec.solo) {
      const hidden = FLAGS.hiddenScreens(DATA.cur().id, "owner");
      const items = sec.sub.filter(it => !hidden.has(it.id)).map(it => {
        const cnt = typeof it.count === "function" ? it.count() : 0;
        return `<button class="nav-item" aria-current="${r.screen === it.id}" data-go="${r.persona}/web/${it.id}">
          ${icon(it.icon)}<span class="lbl">${it.label}</span>${cnt ? `<span class="count">${cnt}</span>` : ""}</button>`;
      }).join("");
      subRail = `<aside class="subrail" aria-label="${esc(sec.title)} navigation">
        <div class="sub-head"><div class="st">${sec.tag ? `<span class="mono" style="color:var(--acc-d)">${sec.tag}</span> ` : ""}${esc(sec.title || sec.label)}</div><div class="ss">Owner console</div></div>
        ${items}
        <div class="sub-foot">${esc(DATA.cur().name)} · ${DATA.cur().headcount} staff · Free tier</div>
      </aside>`;
    }
    return `${topbar(r)}
    <div class="shell two-tier">
      <aside class="sectionrail" aria-label="Owner sections"><div class="sr-head"><span class="pin">${icon(P.icon)}</span></div>${secRail}</aside>
      ${subRail}
      <main class="workspace"><div class="workspace-inner screen-fade">${head(r, P, def)}${def.body}</div></main>
    </div>`;
  }

  /* ---------------- mobile shell ---------------- */
  function mobileShell(r) {
    const P = PERSONAS[r.persona];
    const def = P.mobile[r.screen](r.param);
    const activeTab = (P.tabParent && P.tabParent[r.screen]) || r.screen;
    const tabs = P.tabs.map(tb => {
      const cnt = typeof tb.count === "function" ? tb.count() : tb.count;
      return `<button class="tab" aria-current="${activeTab === tb.id}" data-go="${r.persona}/mobile/${tb.id}">
        ${icon(tb.icon)}<span>${tb.label}${cnt ? ` <b class="tab-cnt">${cnt}</b>` : ""}</span><span class="tdot"></span></button>`;
    }).join("");
    return `${topbar(r)}
    <div class="mobile-stage">
      <div class="phone" role="region" aria-label="${P.label} mobile app">
        <div class="phone-screen">
          <span class="island"></span>
          <div class="statusbar"><span>9:41</span><span class="icons">${icon("signal")}${icon("wifi")}${icon("battery")}</span></div>
          <div class="app-head">
            ${def.back ? `<button class="back" data-go="${def.back}" aria-label="${t("common.back")}">${icon("chevL")}</button>` : ""}
            <div style="min-width:0"><div class="ah-t">${esc(def.title)}</div><div class="ah-s">${P.appName} · ${esc(DATA.cur().short)}</div></div>
            <button class="bell" aria-label="Notifications">${icon("bell")}<span class="ping"></span></button>
          </div>
          <div class="app-body screen-fade" id="ab">${def.body}</div>
          <nav class="tabbar" aria-label="Tabs">${tabs}</nav>
          <div class="homebar"><i></i></div>
        </div>
      </div>
      <aside class="stage-aside">
        <div class="card"><h4>${P.label} · mobile</h4><p>The same container-query layout as the desktop console — components measure their container, so the grid folds to fit the 384 px frame. No separate mobile codebase.</p></div>
        <div class="card"><h4>Try the web view</h4><p>Switch to <b>Web</b> (top bar) for the full ${r.persona === "owner" ? "two-tier console" : "workspace"}.</p></div>
      </aside>
    </div>`;
  }

  /* ---------------- render ---------------- */
  function render() {
    const r = route();
    document.body.dataset.persona = r.view === "app" ? r.persona : (r.view === "login" ? AUTHV.state.focus : "");
    document.body.dataset.portal = r.view === "login" ? "1" : "";
    let html;
    if (r.view === "login") html = AUTHV.portal();
    else if (r.view === "launcher") html = launcher();
    else if (r.view === "app") html = r.device === "mobile" ? mobileShell(r) : (PERSONAS[r.persona].twoTier ? twoTierShell(r) : railShell(r));
    app().innerHTML = html;
    window.scrollTo(0, 0);
    if (r.blocked) toast(r.blocked, "warn");
  }

  /* ---------------- actions ---------------- */
  function signInFrom(persona) {
    const acct = document.querySelector(`[data-acct="${persona}"]`);
    const pwd = document.querySelector(`[data-pwd="${persona}"]`);
    if (!acct || !pwd) return;
    const res = AUTH.signIn(acct.value, pwd.value);
    if (res.ok) { AUTHV.state.err = ""; go(res.ses.persona + "/web/" + defScreen(res.ses.persona)); }
    else { AUTHV.state.err = res.err; render(); }
  }

  function doAct(val) {
    if (val.startsWith("toast:")) return toast(val.slice(6), "warn");
    if (val.startsWith("locked:")) return toast(val.slice(7), "warn");
    if (val.startsWith("auth-signin:")) return signInFrom(val.split(":")[1]);
    if (val === "auth-logout") { AUTH.signOut(); AUTHV.state.err = ""; return go("launcher"); }
    if (val.startsWith("portal-mode:")) { AUTH.setPortal(val.split(":")[1] === "on"); render(); return toast(AUTH.portalOn() ? "Sign-in armed — entering a persona now asks to sign in." : "Open-demo on — walk into any persona without signing in."); }
    if (val === "lang-lo") return toast("Lao language pack ships in the language wave — the portal & payslips are already bilingual.", "warn");
    // ---- payroll lifecycle ----
    if (val === "pay-run:advance") { const r = PAYROLL.advance(); if (r.state === "close") WORK.paydayAlert(DATA.state.tenantId, r); render(); return toast("Pay run → " + r.state + (r.state === "close" ? " · posted to Books · payday alert sent" : "")); }
    if (val === "pay-run:oneclick") { const r = PAYROLL.oneClick(); WORK.paydayAlert(DATA.state.tenantId, r); render(); return toast("One-tap run complete — closed · posted to Books · payday alert sent"); }
    if (val === "pay-run:adjust") { PAYROLL.adjust(); render(); return toast("Adjustment run opened (the closed run stays immutable)"); }
    if (val.startsWith("pay-level:")) { DATA.cur().level = val.split(":")[1]; render(); return toast("Payroll level → " + DATA.cur().level); }
    // ---- cashbook ----
    if (val === "ledger:add") return ledgerAdd();
    if (val.startsWith("ledger:range:")) { LEDGER.setView(val.split(":")[2]); render(); return; }
    // ---- exports ----
    if (val === "export:payreg") return exportPayreg();
    if (val === "export:ledger") { downloadCSV("cashbook_" + DATA.state.tenantId + ".csv", LEDGER.toCSV(DATA.state.tenantId)); return toast("Cashbook exported (CSV)"); }
    if (val === "export:pl") return exportPL();
    if (val === "export:workbook") { downloadCSV("workbook_" + DATA.state.tenantId + ".csv", DW.workbook(DATA.state.tenantId)); return toast("Workbook exported — every tab in one file (CSV)"); }
    if (val === "export:vat") return exportTax("vat");
    if (val === "export:pit") return exportTax("pit");
    if (val === "export:nssf") return exportTax("nssf");
    if (val === "export:soon") return toast("PDF/XLSX export lands later — CSV works now.", "warn");
    // ---- tax centre ----
    if (val.startsWith("tax:file:")) { TAX.markFiled(DATA.state.tenantId, val.slice(9)); render(); return toast("Filed — logged tax.filed"); }
    if (val === "tax:rate-vat") return taxRateVat();
    // ---- governance: flags · approvals · db ops ----
    if (val.startsWith("flags:toggle:")) return flagToggle(val.split(":")[2]);
    if (val === "approve:register") return approveRegister();
    if (val.startsWith("approve:")) { const p = val.split(":"); APPROVALS.decide(DATA.state.tenantId, p[1], p[2]); render(); return toast("Decision recorded · " + p[2] + " (audited)"); }
    if (val === "dbops:backup") { DBOPS.backup(DATA.state.tenantId, "now"); render(); return toast("Backup taken — this tenant only"); }
    if (val === "dbops:export") { downloadCSV("tenant_" + DATA.state.tenantId + ".csv", DW.workbook(DATA.state.tenantId)); return toast("Tenant exported (workbook CSV)"); }
    if (val.startsWith("dbops:restore:")) { DBOPS.restore(DATA.state.tenantId, val.split(":")[2]); render(); return toast("Restore from " + val.split(":")[2] + " (audited)"); }
    if (val.startsWith("dbops:platform:")) { const op = val.split(":")[2]; DBOPS.platformOp(DATA.state.tenantId, op, "operator demo"); render(); return toast("Auto-snapshot taken, then " + op + " — audited (platform.db." + op + ")"); }
    // ---- §W feature wave ----
    if (val === "sched:publish") { WORK.publish(DATA.state.tenantId); render(); return toast("Roster published — staff can see their shifts"); }
    if (val === "sched:swap") { WORK.swap(DATA.state.tenantId, "Khamla → Souphaphone · Thu", false); render(); return toast("Swap request sent to Approvals (OT-checked)"); }
    if (val === "sched:claim") { WORK.claim(DATA.state.tenantId, "Open shift · Wed", false); render(); return toast("Open shift posted — claims land in Approvals"); }
    if (val === "ewa:request") return ewaRequestDemo();
    if (val.startsWith("ewa:approve:")) { PAYROLL.ewaDecide(val.split(":")[2], "approve"); render(); return toast("Advance approved"); }
    if (val.startsWith("ewa:payout:")) { PAYROLL.ewaDecide(val.split(":")[2], "payout"); render(); return toast("Advance paid out — recovered on the next payslip"); }
    if (val.startsWith("ewa:reject:")) { PAYROLL.ewaDecide(val.split(":")[2], "reject"); render(); return toast("Advance rejected"); }
    if (val.startsWith("tax:nudge:")) { WORK.taxNudge(DATA.state.tenantId, val.split(":")[2]); return toast("Compliance nudge sent · in-app (LINE pending account)"); }
    // ---- run prep: per-person adjustments → draft → commit ----
    if (val === "pay:adj-save") return paySaveDraft();
    if (val === "pay:commit") return payCommit();
  }
  function paySaveDraft() {
    const tid = DATA.state.tenantId, by = {};
    (document.querySelectorAll ? document.querySelectorAll("[data-adj]") : []).forEach(el => {
      const parts = el.getAttribute("data-adj").split(":"), uid = parts[0], field = parts[1];
      by[uid] = by[uid] || {};
      by[uid][field] = field === "remarks" ? el.value.trim() : (parseInt(String(el.value).replace(/[^0-9]/g, ""), 10) || 0);
    });
    Object.keys(by).forEach(uid => PAYROLL.setAdj(tid, uid, by[uid]));
    PAYROLL.markDraftSaved(tid); render(); toast("Saved to draft · auto-saved");
  }
  function payCommit() {
    const tid = DATA.state.tenantId;
    const d = document.querySelector('[data-sched="date"]'), tm = document.querySelector('[data-sched="time"]');
    const when = ((d && d.value) || "2026-06-25") + " " + ((tm && tm.value) || "09:00");
    const pr = PAYROLL.commitDraft(tid, when); render(); toast("Committed " + pr.runId + " · scheduled " + when);
  }
  function ewaRequestDemo() {
    const tid = DATA.state.tenantId, ppl = DATA.people(tid), m = ppl.find(p => p.you) || ppl[0];
    const cap = PAYROLL.earnedToDate(m).cap, amount = Math.round(cap * 0.6 / 10000) * 10000;
    const res = PAYROLL.ewaRequest(tid, m.id, amount);
    if (!res.ok) return toast(res.err, "warn");
    render(); toast("Advance requested · " + m.name.split(" ")[0] + " · " + amount.toLocaleString() + " ₭");
  }

  function flagToggle(fe) {
    const ses = AUTH.session(), scope = ses && ses.delegated ? "manager" : "owner";
    const tid = DATA.state.tenantId, res = FLAGS.set(tid, fe, !FLAGS.on(tid, fe), scope);
    if (!res.ok) return toast(res.err, "warn");
    render();
    toast((FLAGS.REGISTRY[fe] ? FLAGS.REGISTRY[fe].label : fe) + " → " + (FLAGS.on(tid, fe) ? "on" : "off"));
  }
  function approveRegister() {
    APPROVALS.register({ key: "doc_ack", label: "Document acknowledgement", protective: false, check: "signed" });
    APPROVALS.request(DATA.state.tenantId, "doc_ack", { who: "All staff", detail: "Acknowledge updated handbook" });
    render();
    toast("New approvable type registered by config — no new code");
  }

  /* ---- engine action helpers ---- */
  function downloadCSV(name, text) {
    try {
      const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { toast("Export isn't available in this view — open the file build.", "warn"); }
  }
  function ledgerAdd() {
    const g = (k) => { const el = document.querySelector(`[data-led="${k}"]`); return el ? el.value : ""; };
    const amount = parseInt(String(g("amount")).replace(/[^0-9]/g, ""), 10);
    if (!amount || amount <= 0) return toast("Enter an amount in ₭", "warn");
    LEDGER.add(DATA.state.tenantId, { date: "2026-06-15", kind: g("kind") || "rev", cat: (g("cat") || "").trim() || "(uncategorised)", amount, method: g("method") || "cash", tax: "exempt" });
    render(); toast("Entry added to the cashbook");
  }
  function exportPayreg() {
    const run = PAYROLL.getRun(DATA.state.tenantId);
    const rows = [["Employee", "Role", "Gross", "NSSF_ee", "NSSF_er", "Taxable", "PIT", "Net", "Cost"]]
      .concat(run.slips.map(s => [s.name, s.role, s.gross, s.ssEmp, s.ssEr, s.taxable, s.pit, s.net, s.cost]));
    downloadCSV(run.id + "_register.csv", rows.map(r => r.join(",")).join("\n"));
    toast("Payroll register exported (CSV)");
  }
  function exportPL() {
    const r = LEDGER.rollup(DATA.state.tenantId);
    const rows = [["Line", "LAK"], ["Revenue", r.revenue], ["Staff cost", -r.staffCost], ["Other expenses", -r.otherExp], ["Channel fees", -r.channelFee], ["Operating result", r.result]];
    downloadCSV("pnl_" + DATA.state.tenantId + ".csv", rows.map(x => x.join(",")).join("\n"));
    toast("P&L-lite exported (CSV)");
  }
  function exportTax(kind) {
    const tid = DATA.state.tenantId, run = PAYROLL.getRun(tid);
    let rows;
    if (kind === "pit") { rows = [["Employee", "Taxable", "PIT"]].concat(run.slips.map(s => [s.name, s.taxable, s.pit])); rows.push(["TOTAL", "", run.totals.pit]); }
    else if (kind === "nssf") { rows = [["Employee", "NSSF_ee_5.5%", "NSSF_er_6%"]].concat(run.slips.map(s => [s.name, s.ssEmp, s.ssEr])); rows.push(["TOTAL", run.totals.ssEmp, run.totals.ssEr]); }
    else { const v = TAX.vatPeriod(tid); rows = [["VAT return", "LAK"], ["Output VAT base", v.base.out], ["Input VAT base", v.base.in], ["Rate", v.rate * 100 + "%"], ["Output VAT", v.out], ["Input VAT", v.in], ["VAT payable", v.payable]]; }
    downloadCSV(kind + "_" + tid + ".csv", rows.map(r => r.join(",")).join("\n"));
    toast(kind.toUpperCase() + " exported (CSV)");
  }
  function taxRateVat() {
    const el = document.querySelector('[data-taxrate="vat"]');
    if (!el) return;
    const pct = parseFloat(el.value);
    if (isNaN(pct) || pct < 0 || pct > 30) return toast("Enter a VAT % between 0 and 30", "warn");
    TAX.setRate("vat", pct / 100); render();
    toast("VAT rate → " + pct + "% · new effective row (closed runs unchanged)");
  }

  document.addEventListener("click", (e) => {
    const sw = e.target.closest(".switch");
    if (sw) { const on = sw.getAttribute("aria-checked") === "true"; sw.setAttribute("aria-checked", String(!on)); return toast((!on ? "Enabled" : "Disabled") + " · per-tenant flag (demo)"); }
    const actEl = e.target.closest("[data-act]");
    if (actEl) { e.preventDefault(); return doAct(actEl.getAttribute("data-act")); }
    const goEl = e.target.closest("[data-go]");
    if (goEl) { e.preventDefault(); return go(goEl.getAttribute("data-go")); }
  });
  document.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target.matches && e.target.matches('[role="button"][data-go], [role="button"][data-act]')) {
      e.preventDefault();
      const g = e.target.getAttribute("data-go"), a = e.target.getAttribute("data-act");
      if (a) doAct(a); else if (g) go(g);
    }
  });
  document.addEventListener("change", (e) => {
    const ts = e.target.closest("[data-act-tenant]");
    if (ts) { DATA.setTenant(ts.value); render(); return toast("Switched to " + DATA.cur().name); }
    const ps = e.target.closest("[data-payslip]");
    if (ps) { return go("owner/web/payslips/" + ps.value); }
    const acct = e.target.closest("[data-acct]");
    if (acct) { const a = AUTH.find(acct.value); const pwd = document.querySelector(`[data-pwd="${acct.dataset.acct}"]`); if (a && pwd) pwd.value = a.pwd; }
  });

  // scroll shadow on topbar
  addEventListener("scroll", () => { document.body.dataset.scrolled = window.scrollY > 6 ? "true" : "false"; }, { passive: true });

  window.addEventListener("hashchange", render);
  render();
})();
