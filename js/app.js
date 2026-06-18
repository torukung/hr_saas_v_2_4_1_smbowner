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
    if (h === "register" || h === "register/done") return { view: "register", done: h === "register/done" }; // public — bypasses the wall (KYC on = full flow · off = instant no-KYC)
    if (h === "activate" || h.indexOf("activate/") === 0) return { view: "activate", token: decodeURIComponent(h.split("/")[1] || "") }; // public set-password link — bypasses the wall
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
    if (persona === "platform" && scr === "registrations" && window.REG && !REG.kycOn()) scr = firstScreen(P, dev); // KYC feature off → hide the hub
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

    const sesAvatar = (onApp && cur === "staff" && window.PROFILE && DATA.me()) ? PROFILE.avatar(DATA.me().id) : avatar(ses ? ses.name : "");
    const acctUI = ses
      ? `<span class="avatar-btn session" title="${esc(ses.email)} · ${esc(ses.role)} · present person, from profile">${sesAvatar}</span>
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
    const regKyc = window.REG && REG.kycOn();
    const registerCard = `<article class="hub-card" data-go="register" style="--pc:var(--brand);--pd:var(--brand-deep);--pb:var(--brand-bg);--pl:#D6D9EA">
        <span class="swatch">${icon("idcard")}</span>
        <span class="who">NEW SHOP · ${regKyc ? "KYC" : "INSTANT"}</span>
        <h3>Register your shop</h3>
        <p class="tag">${regKyc ? "Self-serve sign-up — ID + selfie" : "Self-serve sign-up — instant access"}</p>
        <ul>${regKyc
        ? `<li>Company · email · phone · language</li><li>ID card + owner selfie (KYC)</li><li>Platform activates → password email</li>`
        : `<li>Company · email · phone · language</li><li>No ID check — instant</li><li>Access link emailed (email = username)</li>`}</ul>
        <div class="enter"><button data-go="register">${icon("userPlus")} Start registration</button></div>
      </article>`;
    const st = DATA.platformStats();
    return `${topbar({ view: "launcher" })}
    <main class="launcher screen-fade">
      <div class="hero">
        <span class="eyebrow">Adeptio Adaptive HR · Structure Blueprint v2.4.1.SmbOwner → Owner Edition UI</span>
        <h1>One backend, two people per shop,<br><em>one operator above them all.</em></h1>
        <p class="lede">A <strong>multi-tenant</strong> HR platform for the Lao small business — where the owner is also the manager, the HR and the bookkeeper. Enter a persona below to open its workspace: <strong>Staff</strong> and <strong>Owner</strong> live inside a shop; the <strong>Platform Administrator</strong> runs the whole fleet above them. Sign-in is pre-filled — or switch to <strong>open demo</strong> and walk straight in.</p>
      </div>
      <div class="hub-grid">${cards}${registerCard}</div>
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

  // Rail head — Staff shows the present person (photo · name · position from profile) as an
  // SFDC-style clickable menu (Personal data · Time → profile); other personas keep the app-name head.
  function railHead(r, P) {
    if (r.persona === "staff" && window.PROFILE && DATA.me()) {
      const uid = DATA.me().id, me = DATA.me(), prof = PROFILE.get(uid);
      return `<div class="rail-head">
        <details class="pf-menu railmenu">
          <summary class="rp-row" title="Profile menu">
            ${PROFILE.avatar(uid)}
            <div class="rp-id"><div class="rp-name">${esc(me.name)}</div><div class="rp-role">${esc(prof.position)}</div></div>
            ${icon("chevD", "rp-chev")}
          </summary>
          <div class="pf-menu-pop sfdc">
            <div class="sfdc-card">${PROFILE.avatar(uid, { lg: true })}<div class="sfdc-meta"><div class="sfdc-name">${esc(me.name)}</div><div class="sfdc-sub">${esc(prof.email)}</div></div></div>
            <a class="pf-mi" data-go="staff/web/me/personal">${icon("user")} Personal data</a>
            <a class="pf-mi" data-go="staff/web/me/time">${icon("clock")} Time</a>
          </div>
        </details>
      </div>`;
    }
    return `<div class="rail-head"><span class="pin">${icon(P.icon)}</span><div><div class="t">${P.appName}</div><div class="s">${P.roleLine}</div></div></div>`;
  }

  /* ---------------- single-rail shell (staff · platform) ---------------- */
  function railShell(r) {
    const P = PERSONAS[r.persona];
    const def = P.web[r.screen](r.param);
    const hidden = FLAGS.hiddenScreens(DATA.state.tenantId, r.persona);
    const navHtml = P.nav.map(g => `
      <div class="group eyebrow">${g.group}</div>
      ${g.items.filter(it => !hidden.has(it.id) && (typeof it.when !== "function" || it.when())).map(it => {
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
        ${railHead(r, P)}
        ${navHtml}
        <div class="rail-foot">${foot}</div>
      </aside>
      <main class="workspace"><div class="workspace-inner screen-fade">${head(r, P, def)}${def.body}</div></main>
    </div>`;
  }

  /* ---------------- two-tier shell (owner) ---------------- */
  function twoTierShell(r) {
    const P = PERSONAS[r.persona];
    const secId = P.sectionOf[r.screen] || (P.sections[0] && P.sections[0].id);
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
    const tabs = P.tabs.filter(tb => typeof tb.when !== "function" || tb.when()).map(tb => {
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
  let lastRouteKey = null;
  function render() {
    const r = route();
    document.body.dataset.persona = r.view === "app" ? r.persona : (r.view === "login" ? AUTHV.state.focus : "");
    document.body.dataset.portal = (r.view === "login" || r.view === "register" || r.view === "activate") ? "1" : "";
    let html;
    if (r.view === "login") html = AUTHV.portal();
    else if (r.view === "register") html = AUTHV.registerPage(r.done);
    else if (r.view === "activate") html = AUTHV.activatePage(r.token);
    else if (r.view === "launcher") html = launcher();
    else if (r.view === "app") html = r.device === "mobile" ? mobileShell(r) : (PERSONAS[r.persona].twoTier ? twoTierShell(r) : railShell(r));
    // day-summary popup overlays the owner web console wherever the team grid lives (dashboard or full calendar)
    if (r.view === "app" && r.persona === "owner" && r.device === "web" && window.CAL && CAL.state.dayOpen) html += CAL.dayPanel(DATA.state.tenantId);
    app().innerHTML = html;
    // only jump to the top on a real navigation (route change) — in-place re-renders
    // (calendar day clicks, tab switches, tenant switch) keep the scroll position stable
    const routeKey = [r.view, r.persona, r.device, r.screen, r.param].join("|");
    if (routeKey !== lastRouteKey) { window.scrollTo(0, 0); lastRouteKey = routeKey; }
    if (r.blocked) {
      // Keep the address bar honest with what we actually rendered (the signed-in
      // persona's landing). replaceState updates the URL without firing hashchange,
      // so there's no re-render and no redirect loop.
      const fixed = "#/" + r.persona + "/" + r.device + "/" + r.screen;
      if (location.hash !== fixed && window.history && history.replaceState) history.replaceState(null, "", fixed);
      toast(r.blocked, "warn");
    }
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
    // ---- staff punch (demo) — honest stub; live attendance engine (db_time) is a later pass ----
    if (val === "staff:punch") return toast("Selfie captured · punch queued ✓ — the server stamps the official time on sync. (Live attendance engine lands in a later pass.)");
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
    if (val.startsWith("approve:")) { const p = val.split(":"); APPROVALS.decide(DATA.state.tenantId, p[1], p[2]); render(); return toast("Decision recorded · " + p[2] + " (audited)"); }
    // ---- approvals inbox view (group by team / type · remembered) ----
    if (val.startsWith("appr:mode:")) { APPROVALS.setView({ mode: val.split(":")[2], tab: null, sub: null, saved: false }); return render(); }
    if (val.startsWith("appr:tab:")) { APPROVALS.setView({ tab: val.slice("appr:tab:".length), sub: null, saved: false }); return render(); }
    if (val.startsWith("appr:sub:")) { APPROVALS.setView({ sub: val.slice("appr:sub:".length), saved: false }); return render(); }
    if (val === "appr:save") { APPROVALS.setView({ saved: true }); render(); return toast("Inbox view saved — remembered next time"); }
    // ---- manager & admin seats ----
    if (val === "access:add") return toast("Invite a manager/admin — sends an email invite (wired in a later pass)", "warn");
    // ---- staff dashboard builder (SFDC-style: catalog · place · resize) ----
    if (val.startsWith("staffdash:add:")) { const ok = STAFFDASH.add(DATA.state.tenantId, val.slice("staffdash:add:".length)); render(); return toast(ok ? "Widget added to the staff dashboard" : "Couldn't place that widget — no room", ok ? "" : "warn"); }
    if (val.startsWith("staffdash:remove:")) { STAFFDASH.remove(DATA.state.tenantId, val.slice("staffdash:remove:".length)); render(); return toast("Widget removed"); }
    if (val.startsWith("staffdash:move:")) { const p = val.split(":"); const ok = STAFFDASH.move(DATA.state.tenantId, p[2], +p[3], +p[4]); render(); if (!ok) toast("Can't move there — the edge or another widget is in the way", "warn"); return; }
    if (val.startsWith("staffdash:resize:")) { const p = val.split(":"); const ok = STAFFDASH.resize(DATA.state.tenantId, p[2], +p[3], +p[4]); render(); if (!ok) toast("Can't resize — no room or limit reached", "warn"); return; }
    if (val === "staffdash:catalog:open") { STAFFDASH.toggleCatalog(true); return render(); }
    if (val === "staffdash:catalog:close") { STAFFDASH.toggleCatalog(false); return render(); }
    if (val === "staffdash:reset") { STAFFDASH.reset(DATA.state.tenantId); render(); return toast("Staff dashboard reset to default"); }
    if (val === "dbops:backup") { DBOPS.backup(DATA.state.tenantId, "now"); render(); return toast("Backup taken — this tenant only"); }
    if (val === "dbops:export") { downloadCSV("tenant_" + DATA.state.tenantId + ".csv", DW.workbook(DATA.state.tenantId)); return toast("Tenant exported (workbook CSV)"); }
    if (val.startsWith("dbops:restore:")) { DBOPS.restore(DATA.state.tenantId, val.split(":")[2]); render(); return toast("Restore from " + val.split(":")[2] + " (audited)"); }
    if (val.startsWith("dbops:platform:")) { const op = val.split(":")[2]; DBOPS.platformOp(DATA.state.tenantId, op, "operator demo"); render(); return toast("Auto-snapshot taken, then " + op + " — audited (platform.db." + op + ")"); }
    // ---- §W feature wave ----
    if (val === "sched:publish") { WORK.publish(DATA.state.tenantId); render(); return toast("Roster published — staff can see their shifts"); }
    if (val === "sched:swap") { WORK.swap(DATA.state.tenantId, "Tinar → Souphaphone · Thu", false); render(); return toast("Swap request sent to Approvals (OT-checked)"); }
    if (val === "sched:claim") { WORK.claim(DATA.state.tenantId, "Open shift · Wed", false); render(); return toast("Open shift posted — claims land in Approvals"); }
    /* ---- jobs schedule & shifts (SCHED) ---- */
    if (val.startsWith("sched:nav:")) { SCHED.nav(val.split(":")[2]); return render(); }
    if (val === "sched:today") { SCHED.toToday(); return render(); }
    if (val.startsWith("sched:tmpl:")) { const id = val.split(":")[2]; SCHED.setTemplate(DATA.state.tenantId, id); render(); return toast("Roster template → " + (SCHED.TEMPLATES[id] ? SCHED.TEMPLATES[id].label : id)); }
    /* ---- shift configuration: periods · users groups · shift groups ---- */
    if (val === "sched:addperiod") return schedAddPeriod();
    if (val.startsWith("sched:rmperiod:")) { const r = SCHED.removePeriod(DATA.state.tenantId, val.split(":")[2]); render(); return toast(r.ok ? "Shift period removed" : r.err, r.ok ? "" : "warn"); }
    if (val === "sched:addgroup") return schedAddGroup();
    if (val.startsWith("sched:rmgroup:")) { const r = SCHED.removeGroup(DATA.state.tenantId, val.split(":")[2]); render(); return toast(r.ok ? "Users group removed" : r.err, r.ok ? "" : "warn"); }
    if (val === "sched:addsg") return schedAddShiftGroup();
    if (val.startsWith("sched:rmsg:")) { SCHED.removeShiftGroup(DATA.state.tenantId, val.split(":")[2]); render(); return toast("Shift group removed (and unassigned from any days)"); }
    /* ---- calendar assignment ---- */
    if (val === "sched:assignmode:on") { SCHED.setAssignMode(true); return render(); }
    if (val === "sched:assignmode:off") { SCHED.setAssignMode(false); return render(); }
    if (val === "sched:assignsel") return schedAssignSel();
    if (val.startsWith("sched:dayadd:")) return schedDayAdd(val.slice("sched:dayadd:".length));
    if (val.startsWith("sched:dayremove:")) { const p = val.split(":"); SCHED.dayRemoveShift(DATA.state.tenantId, p[2], p[3]); render(); return toast("Shift removed from this day"); }
    if (val.startsWith("sched:dayreset:")) { SCHED.dayReset(DATA.state.tenantId, val.slice("sched:dayreset:".length)); render(); return toast("Day reset to the default rota"); }
    if (val.startsWith("sched:edit-close")) { SCHED.closeEdit(); return render(); }
    if (val.startsWith("sched:edit:")) { SCHED.openEdit(val.slice("sched:edit:".length)); return render(); }
    if (val.startsWith("sched:day:")) { SCHED.setSelDate(val.slice("sched:day:".length)); return render(); }
    if (val.startsWith("sched:pick:")) { SCHED.pickDay(val.slice("sched:pick:".length)); return render(); }
    if (val === "sched:swap-open") { SCHED.openSwap(true); return render(); }
    if (val === "sched:swap-close") { SCHED.openSwap(false); return render(); }
    if (val === "sched:clearsel") { SCHED.clearSel(); return render(); }
    if (val === "sched:swap-submit") return schedSwapSubmit();
    if (val === "ewa:request") return ewaRequestDemo();
    if (val.startsWith("ewa:approve:")) { PAYROLL.ewaDecide(val.split(":")[2], "approve"); render(); return toast("Advance approved"); }
    if (val.startsWith("ewa:payout:")) { PAYROLL.ewaDecide(val.split(":")[2], "payout"); render(); return toast("Advance paid out — recovered on the next payslip"); }
    if (val.startsWith("ewa:reject:")) { PAYROLL.ewaDecide(val.split(":")[2], "reject"); render(); return toast("Advance rejected"); }
    if (val.startsWith("tax:nudge:")) { WORK.taxNudge(DATA.state.tenantId, val.split(":")[2]); return toast("Compliance nudge sent · in-app (LINE pending account)"); }
    // ---- run prep: per-person adjustments → draft → commit ----
    if (val === "pay:adj-save") return paySaveDraft();
    if (val === "pay:commit") return payCommit();
    // ---- registration + KYC ----
    if (val === "register:submit") return registerSubmit();
    if (val.startsWith("activate:setpw:")) return activateSetPw(val.slice("activate:setpw:".length));
    if (val === "mail:quicksecret") return mailQuickSecret();
    if (val.startsWith("kyc:feature:")) { REG.setKyc(val.split(":")[2] === "on"); render(); return toast("KYC & registration " + (REG.kycOn() ? "enabled" : "disabled · related menus hidden") + " platform-wide"); }
    if (val.startsWith("kyc:activate:")) { REG.activate(val.split(":")[2]); render(); return toast("Activated — confirmation email sent via " + REG.getChannel().provider); }
    if (val.startsWith("kyc:reject:")) { REG.reject(val.split(":")[2], "not verified"); render(); return toast("Registration rejected (reason logged)"); }
    if (val.startsWith("kyc:disable:")) { REG.disable(val.split(":")[2]); render(); return toast("Registration disabled"); }
    if (val === "kyc:autodisable") { REG.setAutoDisable(!REG.autoDisable().on); render(); return toast("Auto-disable " + (REG.autoDisable().on ? "on" : "off")); }
    if (val === "kyc:channel-save") return kycChannelSave();
    if (val === "kyc:channel-test") { REG.testChannel(); render(); return toast("Test email queued via " + REG.getChannel().host); }
    // ---- platform mail server + alerts (Communications) ----
    if (val === "mail:save") return mailSave();
    if (val === "mail:test") { MAIL.test(); render(); return toast("Test email queued via " + MAIL.config().host); }
    if (val.startsWith("mail:preset:")) { MAIL.applyPreset(val.split(":")[2]); render(); return toast("Preset applied · " + MAIL.config().host + ":" + MAIL.config().port); }
    if (val.startsWith("mail:alert-toggle:")) { const k = val.slice("mail:alert-toggle:".length), on = MAIL.toggleAlert(k); render(); return toast("Alert " + (on ? "enabled" : "disabled") + " · " + k); }
    if (val.startsWith("mail:threshold:")) { MAIL.setThreshold(val.split(":")[2]); render(); return toast("Resource-limit alerts at " + MAIL.getThreshold() + "% of cap"); }
    if (val.startsWith("mail:alert:")) { const p = val.split(":"); const r = MAIL.alertResource(p[3], p[2]); render(); return toast(r.ok ? "Limit alert sent · " + r.subject : r.err, r.ok ? "" : "warn"); }
    if (val.startsWith("profile:")) return profileAct(val);

    /* ---- calendar · leave ---- */
    if (val.startsWith("cal:nav:")) { syncLeaveType(); CAL.closeDay(); CAL.nav(val.split(":")[2]); return render(); }
    if (val === "cal:today") { syncLeaveType(); CAL.closeDay(); CAL.state.y = 2026; CAL.state.m = 5; return render(); }
    if (val.startsWith("cal:day:")) { CAL.openDay(val.slice("cal:day:".length)); return render(); }
    if (val === "cal:day-close") { CAL.closeDay(); return render(); }
    if (val.startsWith("cal:callin:")) { const u = val.slice("cal:callin:".length), p = DATA.people().find(x => x.id === u); return toast("Call-in request sent to " + (p ? p.name.split(" ")[0] : "staff") + " · in-app (LINE pending account)"); }
    if (val === "cal:addholiday") return holidayAdd();
    if (val === "leave:open") { CAL.openLeave(true); return render(); }
    if (val === "leave:close") { CAL.openLeave(false); return render(); }
    if (val === "leave:clear") { syncLeaveType(); CAL.clearSel(); return render(); }
    if (val.startsWith("leave:pick:")) { syncLeaveType(); CAL.toggleDate(val.slice("leave:pick:".length)); return render(); }
    if (val === "leave:submit") return leaveSubmit();

    /* ---- attendance fix-request (staff → manager approval) ---- */
    if (val === "att:fix-open") { CAL.openFix(true); return render(); }
    if (val === "att:fix-close") { CAL.openFix(false); return render(); }
    if (val.startsWith("att:fix-pick:")) { stashFixNote(); CAL.pickFix(val.slice("att:fix-pick:".length)); return render(); }
    if (val === "att:fix-evidence") { stashFixNote(); CAL.attachFix(); return render(); }
    if (val === "att:fix-submit") return attFixSubmit();

    /* ---- company announcements (manager → staff Home + Inbox) ---- */
    if (val === "ann:add") return annAdd();
    if (val.startsWith("ann:remove:")) { ANNOUNCE.remove(DATA.state.tenantId, val.split(":")[2]); render(); return toast("Announcement removed"); }

    /* ---- scheduled / recurring expenses (payroll dashboard) ---- */
    if (val.startsWith("expense:post:")) { const r = LEDGER.postRecurring(DATA.state.tenantId, val.split(":")[2]); render(); return toast(r.ok ? "Posted to cashbook · next date rolled forward" : "Could not post", r.ok ? "" : "warn"); }
    if (val.startsWith("expense:freq:")) { const p = val.split(":"); LEDGER.setRecurringFreq(DATA.state.tenantId, p[2], p[3]); render(); return toast("Schedule → " + p[3]); }
    if (val === "expense:add") return expenseAdd();
  }
  function expenseAdd() {
    const g = (k) => { const el = document.querySelector(`[data-rx="${k}"]`); return el ? el.value.trim() : ""; };
    const amount = parseInt(g("amount").replace(/[^0-9]/g, ""), 10) || 0;
    const res = LEDGER.addRecurring(DATA.state.tenantId, { name: g("name"), amount, freq: g("freq") || "monthly", cat: g("name") });
    if (!res.ok) return toast(res.err, "warn");
    render(); toast("Scheduled expense added · " + g("name"));
  }
  function schedSwapSubmit() {
    const to = document.querySelector('[data-swapto]'), note = document.querySelector('[data-swapnote]');
    const res = SCHED.requestSwap(DATA.state.tenantId, DATA.me().id, SCHED.selected(), to ? to.value : "", note ? note.value.trim() : "");
    if (!res.ok) return toast(res.err, "warn");
    render(); toast("Swap sent for your manager's approval");
  }
  /* ---- shift configuration form readers ---- */
  function schedAddPeriod() {
    const g = (k) => { const el = document.querySelector(`[data-sp="${k}"]`); return el ? el.value.trim() : ""; };
    const res = SCHED.addPeriod(DATA.state.tenantId, { label: g("label"), start: g("start"), end: g("end"), cap: g("cap") });
    if (!res.ok) return toast(res.err, "warn");
    render(); toast("Shift period added · " + g("label"));
  }
  function schedAddGroup() {
    const name = document.querySelector('[data-ug="label"]');
    const ms = document.querySelector('[data-ug="members"]');
    const members = ms ? [...ms.selectedOptions].map(o => o.value) : [];
    const res = SCHED.addGroup(DATA.state.tenantId, { label: name ? name.value.trim() : "", members });
    if (!res.ok) return toast(res.err, "warn");
    render(); toast("Users group added · " + members.length + " member" + (members.length !== 1 ? "s" : ""));
  }
  function schedAddShiftGroup() {
    const g = (k) => { const el = document.querySelector(`[data-sg="${k}"]`); return el ? el.value : ""; };
    const res = SCHED.addShiftGroup(DATA.state.tenantId, { label: g("label").trim(), periodId: g("period"), groupId: g("group") });
    if (!res.ok) return toast(res.err, "warn");
    render(); toast("Shift group created — now assignable on the calendar");
  }
  function schedAssignSel() {
    const sel = document.querySelector('[data-sg-assign]');
    const res = SCHED.assignDays(DATA.state.tenantId, SCHED.selected(), sel ? sel.value : "");
    if (!res.ok) return toast(res.err, "warn");
    SCHED.clearSel(); render(); toast("Assigned to " + res.n + " day" + (res.n !== 1 ? "s" : ""));
  }
  function schedDayAdd(k) {
    const sel = document.querySelector('[data-sg-add]');
    const res = SCHED.dayAddShift(DATA.state.tenantId, k, sel ? sel.value : "");
    if (!res.ok) return toast(res.err, "warn");
    render(); toast("Shift added to " + CAL.fmtShort(k));
  }
  function stashFixNote() { const el = document.querySelector("[data-fixnote]"); if (el && window.CAL) CAL.state.fixNote = el.value; }
  function attFixSubmit() {
    const note = document.querySelector("[data-fixnote]"), hadEvidence = CAL.state.fixEvidence;
    const res = CAL.submitFix(DATA.state.tenantId, DATA.me().id, CAL.state.fixDate, note ? note.value.trim() : "");
    if (!res.ok) return toast(res.err, "warn");
    render(); toast("Fix request sent to your manager · Approvals" + (hadEvidence ? " · evidence attached" : ""));
  }
  function annAdd() {
    const g = (k) => { const el = document.querySelector(`[data-ann="${k}"]`); return el ? el.value : ""; };
    const res = ANNOUNCE.add(DATA.state.tenantId, { title: g("title"), body: g("body"), kind: g("kind") || "immediate", date: g("date"), days: g("days") });
    if (!res.ok) return toast(res.err, "warn");
    render(); toast("Announcement posted — live on staff Home + Inbox");
  }
  function syncLeaveType() { const t = document.querySelector && document.querySelector("[data-leavetype]"); if (t) CAL.state.type = t.value; }
  function leaveSubmit() {
    syncLeaveType();
    const note = document.querySelector && document.querySelector("[data-leavenote]");
    const res = CAL.requestLeave(DATA.me().id, CAL.state.type, CAL.selected(), note ? note.value.trim() : "");
    if (!res.ok) return toast(res.err, "warn");
    CAL.openLeave(false); render();
    toast("Leave requested · " + res.rec.type + " · " + res.rec.days + " day" + (res.rec.days > 1 ? "s" : "") + " → sent for approval");
  }
  function holidayAdd() {
    const g = (k) => { const el = document.querySelector(`[data-hol="${k}"]`); return el ? el.value.trim() : ""; };
    const res = CAL.addHoliday(g("date"), g("name"), g("scope") || "company");
    if (!res.ok) return toast(res.err, "warn");
    render(); toast("Holiday added · " + g("name") + " (audited)");
  }
  function profileAct(val) {
    const p = val.split(":"), op = p[1], uid = p[2];
    if (op === "photo") { PROFILE.setPhoto(uid); render(); return toast("Profile photo uploaded — now shows on this person's icon (demo)"); }
    if (op === "edit") { PROFILE.setEditing(uid + ":" + p[3]); return render(); }
    if (op === "cancel") { PROFILE.setEditing(null); return render(); }
    if (op === "save") {
      const obj = {};
      (document.querySelectorAll ? document.querySelectorAll("[data-pf]") : []).forEach(el => { obj[el.getAttribute("data-pf")] = el.value; });
      PROFILE.set(uid, obj); PROFILE.setEditing(null); render(); toast("Saved · people.updated (audited)");
    }
  }
  function registerSubmit() {
    const g = (k) => { const el = document.querySelector(`[data-reg="${k}"]`); return el ? el.value.trim() : ""; };
    if (!g("company") || !g("email")) return toast("Company and email are required", "warn");
    if (g("email2") && g("email") !== g("email2")) return toast("The two email addresses don't match", "warn");
    const form = { company: g("company"), owner: g("owner") || "(owner)", email: g("email"), phone: g("phone"), lang: g("lang") || "lo", entity: g("entity") || "sole", biz: g("biz") || "services" };
    if (window.REG && REG.kycOn()) {
      const reg = AUTHV.state.reg, both = !!(reg.idUrl && reg.selfieUrl);
      REG.submit(Object.assign(form, { idType: "National ID card", match: both ? "strong" : "review" }));
      reg.idUrl = reg.idName = reg.selfieUrl = reg.selfieName = null; // clear for the next applicant
    } else {
      REG.registerInstant(form); // no-KYC → instant active + access-link email
    }
    go("register/done");
  }
  function kycChannelSave() {
    const g = (k) => { const el = document.querySelector(`[data-ch="${k}"]`); return el ? el.value.trim() : ""; };
    REG.setChannel({ provider: g("provider") || "SMTP", host: g("host"), port: parseInt(g("port"), 10) || 465, from: g("from") });
    render(); toast("Email channel saved · " + REG.getChannel().status);
  }
  function mailSave() {
    const g = (k) => { const el = document.querySelector(`[data-ms="${k}"]`); return el ? el.value.trim() : ""; };
    MAIL.save({ provider: g("provider"), host: g("host"), port: g("port"), security: g("security"), username: g("username"), from: g("from"), fromName: g("fromName"), replyTo: g("replyTo"), secret: g("secret") });
    render(); toast(MAIL.config().ready ? "Mail server saved · ready to send ✓" : "Mail server saved · " + MAIL.config().status);
  }
  // admin first-page (or Communications) inline App Password entry — held in memory only
  function mailQuickSecret() {
    const el = document.querySelector("[data-msq]"), v = el ? el.value.trim() : "";
    if (!v) return toast("Paste the 16-character Gmail App Password first.", "warn");
    MAIL.save({ secret: v });
    render(); toast("Gmail App Password saved (in memory) — mail server ready ✓");
  }
  // activation link → set password → create the account, then sign straight in to prove it works
  function activateSetPw(token) {
    const pwd = (document.querySelector('[data-setpw="pwd"]') || {}).value || "";
    const pwd2 = (document.querySelector('[data-setpw="pwd2"]') || {}).value || "";
    if (!pwd || pwd.length < 6) return toast("Choose a password of at least 6 characters.", "warn");
    if (pwd !== pwd2) return toast("The two passwords don't match.", "warn");
    const res = REG.setPassword(token, pwd);
    if (!res.ok) return toast(res.err, "warn");
    const si = AUTH.signIn(res.email, pwd);
    if (si.ok) { AUTHV.state.err = ""; toast("Welcome, " + String(res.name || "").split(" ")[0] + " — your account is ready."); return go(res.persona + "/web/" + defScreen(res.persona)); }
    AUTHV.state.focus = res.persona; toast("Account created — sign in with " + res.email); return go("login");
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
    // A pure-cosmetic demo switch (no wired action) flips visually. A switch WITH a
    // data-act must fall through to its handler — don't shadow it (that silently
    // broke the Functions flag board + the platform KYC auto-disable toggle).
    const sw = e.target.closest(".switch");
    if (sw && !sw.hasAttribute("data-act")) { const on = sw.getAttribute("aria-checked") === "true"; sw.setAttribute("aria-checked", String(!on)); return toast((!on ? "Enabled" : "Disabled") + " · per-tenant flag (demo)"); }
    const actEl = e.target.closest("[data-act]");
    if (actEl) { e.preventDefault(); return doAct(actEl.getAttribute("data-act")); }
    const goEl = e.target.closest("[data-go]");
    if (goEl) { e.preventDefault(); return go(goEl.getAttribute("data-go")); }
    // Honest fallback: an unwired primary button is a demo stub, not a silent dead-end.
    const dead = e.target.closest(".btn, .ch-btn");
    if (dead && !dead.disabled) { e.preventDefault(); const label = (dead.textContent || "").trim().replace(/\s+/g, " "); return toast((label ? "“" + label + "” — " : "") + "preview button; this action is wired in a later pass.", "warn"); }
  });
  // ---- staff-dashboard builder: drag to move / drag corner to resize (buttons are the fallback) ----
  (function () {
    let st = null;
    function geom(grid) {
      const r = grid.getBoundingClientRect(), cs = getComputedStyle(grid);
      const cols = parseInt(grid.style.getPropertyValue("--cols")) || 4;
      const colGap = parseFloat(cs.columnGap) || 12, rowGap = parseFloat(cs.rowGap) || 12;
      const rowH = parseFloat(cs.gridAutoRows) || 120;
      return { cols, cw: (r.width - colGap * (cols - 1)) / cols + colGap, ch: rowH + rowGap };
    }
    document.addEventListener("pointerdown", (e) => {
      const grid = e.target.closest("[data-dbx]"); if (!grid) return;
      if (e.target.closest("button")) return; // let the on-card buttons act
      const rz = e.target.closest("[data-resize]"), mv = e.target.closest("[data-drag]");
      const kind = rz ? "resize" : mv ? "move" : null; if (!kind) return;
      const id = (rz || mv).getAttribute(rz ? "data-resize" : "data-drag"); if (!id) return;
      const w = STAFFDASH.get(DATA.state.tenantId, id), el = grid.querySelector('.dbx-widget[data-wid="' + id + '"]');
      if (!w || !el) return;
      st = { kind, id, grid, g: geom(grid), sx: e.clientX, sy: e.clientY, o: { x: w.x, y: w.y, w: w.w, h: w.h }, el, live: null };
      el.classList.add("dragging"); grid.classList.add("dbx-live");
      try { el.setPointerCapture(e.pointerId); } catch (_) {}
      e.preventDefault();
    });
    document.addEventListener("pointermove", (e) => {
      if (!st) return;
      const dx = Math.round((e.clientX - st.sx) / st.g.cw), dy = Math.round((e.clientY - st.sy) / st.g.ch);
      const COLS = STAFFDASH.COLS, MAXH = STAFFDASH.MAXH;
      let x, y, w, h;
      if (st.kind === "move") { w = st.o.w; h = st.o.h; x = Math.max(0, Math.min(COLS - w, st.o.x + dx)); y = Math.max(0, st.o.y + dy); }
      else { x = st.o.x; y = st.o.y; w = Math.max(1, Math.min(COLS - st.o.x, st.o.w + dx)); h = Math.max(1, Math.min(MAXH, st.o.h + dy)); }
      const valid = !STAFFDASH.collides(DATA.state.tenantId, st.id, { x, y, w, h });
      st.live = { x, y, w, h, valid };
      st.el.style.gridColumn = (x + 1) + "/span " + w;
      st.el.style.gridRow = (y + 1) + "/span " + h;
      st.el.classList.toggle("invalid", !valid);
    });
    function endDrag() {
      if (!st) return; const s = st; st = null;
      s.el.classList.remove("dragging", "invalid"); s.grid.classList.remove("dbx-live");
      if (s.live && s.live.valid && (s.live.x !== s.o.x || s.live.y !== s.o.y || s.live.w !== s.o.w || s.live.h !== s.o.h)) STAFFDASH.setRect(DATA.state.tenantId, s.id, s.live);
      render();
    }
    document.addEventListener("pointerup", endDrag);
    document.addEventListener("pointercancel", endDrag);
  })();

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (window.CAL && CAL.state.dayOpen) { e.preventDefault(); CAL.closeDay(); return render(); }
      if (window.CAL && CAL.state.fixOpen) { e.preventDefault(); CAL.openFix(false); return render(); }
      if (window.CAL && CAL.state.leaveOpen) { e.preventDefault(); CAL.openLeave(false); return render(); }
      if (window.SCHED && SCHED.state.editDate) { e.preventDefault(); SCHED.closeEdit(); return render(); }
    }
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
    // KYC ID/selfie upload — update only that dropzone in place (don't re-render: keep the typed fields)
    const fin = e.target.closest("[data-regfile]");
    if (fin && window.AUTHV) {
      const kind = fin.getAttribute("data-regfile"), f = fin.files && fin.files[0];
      if (f) {
        const url = URL.createObjectURL(f);
        if (kind === "id") { AUTHV.state.reg.idUrl = url; AUTHV.state.reg.idName = f.name; }
        else { AUTHV.state.reg.selfieUrl = url; AUTHV.state.reg.selfieName = f.name; }
        const inner = document.querySelector(`[data-dropinner="${kind}"]`);
        if (inner) inner.innerHTML = AUTHV.dropInner(kind);
      }
      return;
    }
    const acct = e.target.closest("[data-acct]");
    if (acct) { const a = AUTH.find(acct.value); const pwd = document.querySelector(`[data-pwd="${acct.dataset.acct}"]`); if (a && pwd) pwd.value = a.pwd; }
  });

  // scroll shadow on topbar
  addEventListener("scroll", () => { document.body.dataset.scrolled = window.scrollY > 6 ? "true" : "false"; }, { passive: true });

  // navigation closes any open modal / mobile sub-flow (so a back arrow returns to the parent, not the form)
  window.addEventListener("hashchange", () => { if (window.CAL && CAL.closeDay) { CAL.closeDay(); CAL.openFix(false); CAL.openLeave(false); } render(); });
  render();
})();
