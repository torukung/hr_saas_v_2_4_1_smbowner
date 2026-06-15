/* ============================================================
   ADEPTIO · auth views (v2.4.1.smbowner)
   The persona page lands first; entering a persona raises the wall.
   One pre-filled, color-coded frame per persona (Staff · Owner ·
   Platform), Sign-in ↔ Open-demo toggle, printed demo credentials.
   ============================================================ */
window.AUTHV = (function () {
  const { icon } = UI;
  const state = { focus: "owner", err: "" };

  const PV = {
    staff: ["--staff", "--staff-d", "--staff-ln", "--staff-bg"],
    owner: ["--owner", "--owner-d", "--owner-ln", "--owner-bg"],
    platform: ["--platform", "--platform-d", "--platform-ln", "--platform-bg"]
  };

  function frame(pk) {
    const P = PERSONAS[pk], m = PERSONA_META[pk], v = PV[pk];
    const accts = AUTH.accountsFor(pk), def = AUTH.defaultAccount(pk);
    return `<div class="lp-frame ${state.focus === pk ? "focus" : ""}" style="--pc:var(${v[0]});--pd:var(${v[1]});--pl:var(${v[2]});--pb:var(${v[3]})">
      <div class="lp-head">
        <span class="swatch">${icon(P.icon)}</span>
        <div><b>${P.label}</b><span>${m.who}</span></div>
      </div>
      <label class="lp-l">Account</label>
      <select class="input" data-acct="${pk}" aria-label="${P.label} account">
        ${accts.map(a => `<option value="${a.email}" ${a.email === def.email ? "selected" : ""}>${a.email}${a.delegated ? " · delegated" : ""}</option>`).join("")}
      </select>
      <label class="lp-l">Password <span class="muted" style="text-transform:none;letter-spacing:0">· pre-filled</span></label>
      <input class="input" type="text" value="${def.pwd}" data-pwd="${pk}" aria-label="${P.label} password" spellcheck="false">
      <button class="btn lp-go" data-act="auth-signin:${pk}">${icon("key")} Sign in as ${P.label}</button>
    </div>`;
  }

  function seedStrip() {
    return `<details class="seed-strip">
      <summary>${icon("key")} Demo credentials — pre-filled per persona (click a frame's Sign in)</summary>
      <div class="seed-grid">
        ${AUTH.ACCOUNTS.map(a => `<div><b>${PERSONAS[a.persona].label}${a.delegated ? " · mgr" : ""}</b><div class="mono">${a.email}</div><div class="mono">pwd <span class="pwd">${a.pwd}</span></div></div>`).join("")}
      </div>
    </details>`;
  }

  /* full-screen login wall */
  function portal() {
    const err = state.err;
    return `<div class="login-stage"><div class="login-wrap">
      <div class="login-card">
        <div class="lg-head">
          <span class="logo-mark lg">A</span>
          <div><div class="lg-word">Adeptio <span>Owner Edition</span></div><div class="lg-sub">Sign in · three personas · multi-tenant</div></div>
          <span class="spacer"></span>
          <button class="lf-link" data-go="launcher">${icon("chevL")} Persona page</button>
          <button class="lf-link" data-act="portal-mode:off" title="Skip the wall — explore without signing in">${icon("eye")} Open demo</button>
        </div>
        ${err ? `<div class="lg-note bad">${icon("alert")} ${UI.esc(err)}</div>`
        : `<div class="lg-note ok">${icon("check")} Demo credentials are pre-filled — pick a persona and click <b>Sign in</b>. Owner has two tenants to switch between.</div>`}
        <p class="lp-hint">Two personas serve a shop — <b>Staff</b> and <b>Owner</b>; a third, <b>Platform Administrator</b>, runs the whole fleet above them.</p>
        <div class="lp-grid">
          ${PERSONA_ORDER.map(frame).join("")}
        </div>
      </div>
      <div class="login-foot">
        ${seedStrip()}
        <div class="lf-row">
          <span class="mono" style="font-size:10.3px;color:var(--muted)">v2.4.1.smbowner</span>
          <span class="muted" style="font-size:10.3px">·</span>
          <span class="muted" style="font-size:10.3px">Demo data only — no backend this pass</span>
        </div>
      </div>
    </div></div>`;
  }

  /* sign-in section under the persona cards on the landing page */
  function landingSection() {
    const ses = AUTH.session();
    if (ses) {
      const pk = AUTH.primaryScope(ses.scopes);
      return `<section class="landing-auth"><div class="la-session">
        ${UI.avatar(ses.name)}
        <div><b>${UI.esc(ses.name)}</b><div class="small muted">${UI.esc(ses.email)} · ${UI.esc(ses.role)}</div></div>
        <span class="spacer"></span>
        <button class="btn" data-go="${pk}/web/${pk === "owner" ? "dashboard" : pk === "platform" ? "overview" : "today"}">${icon("globe")} Open workspace</button>
        <button class="btn ghost" data-act="auth-logout">${icon("logout")} Sign out</button>
      </div></section>`;
    }
    if (!AUTH.portalOn()) {
      return `<section class="landing-auth"><div class="la-off">
        ${icon("eye")}
        <p><b>Open-demo mode</b> — the wall is down. Click any persona card above to walk straight in; sign-in, sessions and credentials stay live underneath. Arm the front door to demo the login ritual.</p>
        <span class="spacer"></span>
        <button class="btn ghost" data-act="portal-mode:on">${icon("key")} Arm sign-in</button>
      </div></section>`;
    }
    return `<section class="landing-auth">
      <div class="la-head">
        <div><span class="eyebrow acc">Front door</span><h2>Sign in — pick your persona</h2></div>
        <div class="la-links">
          <button class="lf-link" data-act="portal-mode:off">${icon("eye")} Open demo instead</button>
        </div>
      </div>
      <div class="lp-grid">${PERSONA_ORDER.map(frame).join("")}</div>
      <div class="la-foot">${seedStrip()}</div>
    </section>`;
  }

  return { state, portal, landingSection, seedStrip };
})();
