/* ============================================================
   ADEPTIO · auth views (v2.4.1.smbowner)
   The persona page lands first; entering a persona raises the wall.
   One pre-filled, color-coded frame per persona (Staff · Owner ·
   Platform), Sign-in ↔ Open-demo toggle, printed demo credentials.
   ============================================================ */
window.AUTHV = (function () {
  const { icon } = UI;
  const state = { focus: "owner", err: "", reg: { idUrl: null, idName: null, selfieUrl: null, selfieName: null } };

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

  /* ID / selfie dropzone inner — placeholder, or preview once a file is chosen */
  function dropInner(kind) {
    const r = state.reg, url = kind === "id" ? r.idUrl : r.selfieUrl, name = kind === "id" ? r.idName : r.selfieName;
    if (url) return `<img src="${url}" alt="${kind === "id" ? "ID" : "Selfie"} preview" style="width:100%;height:230px;object-fit:cover;display:block">
      <div style="position:absolute;bottom:0;left:0;right:0;display:flex;align-items:center;gap:8px;background:linear-gradient(0deg,rgba(20,24,52,.82),transparent);color:#fff;padding:22px 14px 12px;font-size:13px;font-weight:600">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#74e0a3" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${UI.esc(name || "")}</span></div>`;
    const ic = kind === "id"
      ? `<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#3a4db0" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2.5"/><circle cx="8" cy="11" r="2.2"/><path d="M5.5 16c.6-1.6 2-2.4 2.5-2.4s1.9.8 2.5 2.4"/><path d="M14.5 9.5h4M14.5 12.5h4M14.5 15.5h2.5"/></svg>`
      : `<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#3a4db0" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`;
    return `<div style="height:100%;min-height:230px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px;text-align:center">
      <div style="width:62px;height:62px;border-radius:16px;background:#eef0fb;display:flex;align-items:center;justify-content:center">${ic}</div>
      <div><div style="font-size:15px;font-weight:700;color:#2c3047">${kind === "id" ? "ID card photo" : "Owner selfie"}</div><div style="font-size:13px;color:#8a8fa3;margin-top:3px">${kind === "id" ? "Tap to upload front of ID" : "Tap to take a selfie"}</div></div></div>`;
  }

  // shared indigo brand/trust rail (left column of the register flow)
  function regRail(kyc) {
    const badge = (svg, txt) => `<div style="display:flex;align-items:center;gap:12px"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9fc2ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${svg}</svg><span style="font-size:13.5px;color:rgba(255,255,255,.8)">${txt}</span></div>`;
    const step = (n, txt) => `<div style="display:flex;align-items:center;gap:14px"><div style="width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.25);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;flex-shrink:0">${n}</div><div style="font-size:14.5px;color:rgba(255,255,255,.9)">${txt}</div></div>`;
    const lock = `<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>`;
    const subtitle = kyc ? "Register your shop · KYC" : "Register your shop · instant";
    const desc = kyc
      ? "Set up payroll, attendance and leave for your team — verified, compliant with Lao PDR Profit Tax, and ready the same day."
      : "Set up payroll, attendance and leave for your team — sign up in minutes, no ID check, and start the same day.";
    const steps = kyc
      ? step(1, "Submit your details &amp; identity") + step(2, "We verify your ID + selfie") + step(3, "Get your secure password link by email")
      : step(1, "Submit your shop details") + step(2, "We create your account instantly") + step(3, "Your access link is emailed right away");
    const badges = kyc
      ? badge(lock, `Bank-grade <b style="font-weight:700;color:#fff">AES-256</b> encryption`) + badge(`<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>`, `Every KYC access is <b style="font-weight:700;color:#fff">audited</b>`) + badge(`<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5"/><path d="M3 12c0 1.7 4 3 9 3s9-1.3 9-3"/>`, `Documents sealed in <b style="font-weight:700;color:#fff">db_registration</b>`)
      : badge(lock, `Bank-grade <b style="font-weight:700;color:#fff">AES-256</b> encryption`) + badge(`<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>`, `Access link emailed in <b style="font-weight:700;color:#fff">seconds</b>`) + badge(`<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>`, `Your <b style="font-weight:700;color:#fff">email</b> is your username`);
    return `<aside style="width:42%;max-width:560px;min-width:340px;position:relative;overflow:hidden;background:linear-gradient(160deg,#2a2f6b 0%,#384aa6 60%,#3a4db0 100%);color:#fff;padding:54px 52px;display:flex;flex-direction:column;justify-content:space-between">
      <div style="position:absolute;width:420px;height:420px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.14),transparent 70%);top:-140px;right:-120px;animation:regFloat 9s ease-in-out infinite"></div>
      <div style="position:absolute;width:300px;height:300px;border-radius:50%;background:radial-gradient(circle,rgba(120,196,255,.18),transparent 70%);bottom:-100px;left:-80px;animation:regFloat 11s ease-in-out infinite"></div>
      <div style="position:relative;z-index:1">
        <div style="display:flex;align-items:center;gap:14px">
          <div style="width:50px;height:50px;border-radius:15px;background:rgba(255,255,255,.16);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:24px;border:1px solid rgba(255,255,255,.22)">A</div>
          <div><div style="font-weight:800;font-size:19px;letter-spacing:-.02em">Adeptio <span style="font-weight:500;opacity:.78">Owner Edition</span></div><div style="font-size:13px;opacity:.7;margin-top:1px">${subtitle}</div></div>
        </div>
        <h1 style="font-size:36px;line-height:1.12;letter-spacing:-.03em;font-weight:800;margin:54px 0 14px">Register your shop<br>in minutes.</h1>
        <p style="font-size:16px;line-height:1.6;color:rgba(255,255,255,.82);margin:0;max-width:380px">${desc}</p>
        <p style="font-size:15px;line-height:1.6;color:rgba(180,200,255,.92);margin:10px 0 0;max-width:380px;font-family:'Noto Sans Lao',sans-serif">ລົງທະບຽນຮ້ານຄ້າຂອງທ່ານພາຍໃນ​ໄ​ມ່ກີ່ນາທີ — ${kyc ? "ປອດໄພ ແລະ ຖືກຕ້ອງຕາມກົດໝາຍ." : "ບໍ່ຕ້ອງກວດ ID — ໄດ້ລິ້ງເຂົ້າໃຊ້ທາງອີເມວທັນທີ."}</p>
      </div>
      <div style="position:relative;z-index:1">
        <div style="font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.55);margin-bottom:16px">What happens next</div>
        <div style="display:flex;flex-direction:column;gap:14px">${steps}</div>
        <div style="height:1px;background:rgba(255,255,255,.16);margin:26px 0 20px"></div>
        <div style="display:flex;flex-direction:column;gap:13px">${badges}</div>
      </div>
    </aside>`;
  }

  /* public registration page — KYC self-serve sign-up (blueprint §2 · BO-12), Claude-design rework */
  function registerPage(done) {
    const kyc = window.REG && REG.kycOn();
    const ch = window.REG ? REG.getChannel() : { provider: "SMTP" };
    const css = `<style>
      .reg-root *{box-sizing:border-box}
      .reg-root{position:fixed;inset:0;display:flex;overflow:auto;z-index:50;background:#f6f4ef;color:#1b1e34;font-family:'Plus Jakarta Sans','Manrope',system-ui,sans-serif}
      .reg-in{width:100%;padding:14px 16px;font-size:15px;font-family:inherit;border:1px solid #e3e4ef;border-radius:13px;background:#fff;color:#1b1e34;transition:.18s}
      .reg-in::placeholder{color:#a7abbe}
      .reg-in:focus,.reg-sel:focus{outline:none;border-color:#3a4db0;box-shadow:0 0 0 4px rgba(58,77,176,.12)}
      .reg-lab{display:block;font-size:14px;font-weight:600;color:#2c3047;margin-bottom:8px}
      .reg-drop{position:relative;display:block;cursor:pointer;border:1.5px dashed #cfd2e6;border-radius:18px;background:linear-gradient(180deg,#fbfbfe,#f6f6fb);min-height:230px;overflow:hidden;transition:.18s}
      .reg-drop:hover{border-color:#3a4db0;background:#f3f4fd}
      .reg-cta{width:100%;border:none;cursor:pointer;background:linear-gradient(180deg,#43539e,#3a4db0);color:#fff;font-family:inherit;font-size:16.5px;font-weight:700;padding:18px;border-radius:15px;display:flex;align-items:center;justify-content:center;gap:10px;box-shadow:0 12px 28px -10px rgba(58,77,176,.6);transition:.18s}
      .reg-cta:hover{transform:translateY(-2px);box-shadow:0 18px 34px -10px rgba(58,77,176,.7)}
      .reg-link{display:inline-flex;align-items:center;gap:6px;color:#3a4db0;font-weight:600;font-size:14px;text-decoration:none;cursor:pointer;background:none;border:1px solid #e3e4ef;padding:9px 14px;border-radius:10px;white-space:nowrap}
      @keyframes regFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
      @keyframes regIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
      @media (max-width:880px){.reg-root{flex-direction:column}.reg-root aside{width:100%!important;max-width:none!important;min-width:0!important}}
    </style>`;

    if (done) {
      return `${css}<div class="reg-root">${regRail(kyc)}
      <main style="flex:1;overflow-y:auto;display:flex;align-items:center;justify-content:center;padding:48px 40px">
        <div style="width:100%;max-width:520px;text-align:center;animation:regIn .5s ease both">
          <div style="width:74px;height:74px;border-radius:50%;background:#e9f5ec;border:1px solid #cfe8d6;display:flex;align-items:center;justify-content:center;margin:0 auto 22px">
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#2f9e5e" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg></div>
          <h2 style="font-size:27px;font-weight:800;letter-spacing:-.02em;margin:0">${kyc ? "Registration submitted" : "Account created"}</h2>
          <p style="font-size:15px;color:#6b7088;line-height:1.7;margin:12px 0 0">${kyc
        ? `Your shop is registered and <b style="color:#1b1e34">pending review</b>. A Platform Administrator verifies your ID + selfie, activates you, then emails a <b style="color:#1b1e34">72-hour link to set your password</b> — sent via <span style="font-family:ui-monospace,monospace;color:#3a4db0">${UI.esc(ch.provider)}</span>. Nothing is operational until you're activated.`
        : `Your account is <b style="color:#1b1e34">live</b>. We've emailed your <b style="color:#1b1e34">access link</b> — your <b style="color:#1b1e34">username is your email</b>, with a temporary password to change on first sign-in. Sent via <span style="font-family:ui-monospace,monospace;color:#3a4db0">${UI.esc(ch.provider)}</span>.`}</p>
          <div style="display:flex;gap:10px;justify-content:center;margin-top:26px">
            <button class="reg-link" data-go="launcher"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg> Back to start</button>
            <button class="reg-cta" style="width:auto;padding:11px 20px;font-size:14.5px;box-shadow:none" data-go="register">Register another shop</button>
          </div>
        </div>
      </main></div>`;
    }

    const labF = (lab, inner) => `<div><label class="reg-lab">${lab}</label>${inner}</div>`;
    const inp = (k, attrs) => `<input data-reg="${k}" class="reg-in" ${attrs}>`;
    const sel = (k, opts) => `<div style="position:relative"><select data-reg="${k}" class="reg-in reg-sel" style="appearance:none;cursor:pointer">${opts.map(o => `<option value="${o[0]}">${o[1]}</option>`).join("")}</select><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9296ab" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="position:absolute;right:15px;top:50%;transform:translateY(-50%);pointer-events:none"><path d="m6 9 6 6 6-6"/></svg></div>`;
    const secHd = (n, lab) => `<div style="display:flex;align-items:center;gap:12px;margin-bottom:18px"><span style="width:26px;height:26px;border-radius:8px;background:#eef0fb;color:#3a4db0;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;flex-shrink:0">${n}</span><span style="font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#3a4db0">${lab}</span><span style="flex:1;height:1px;background:#ececf3"></span></div>`;
    const drop = (kind) => `<label class="reg-drop" data-regdrop="${kind}">
        <input type="file" accept="image/*"${kind === "selfie" ? ' capture="user"' : ""} data-regfile="${kind}" style="position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%">
        <div style="position:absolute;top:14px;left:14px;display:flex;align-items:center;gap:5px;background:#eef0fb;color:#3a4db0;font-size:11px;font-weight:700;padding:5px 9px;border-radius:8px;z-index:2"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Secure</div>
        <div data-dropinner="${kind}">${dropInner(kind)}</div></label>`;

    return `${css}<div class="reg-root">${regRail(kyc)}
    <main style="flex:1;overflow-y:auto;max-height:100vh;display:flex;justify-content:center;padding:48px 40px 64px">
      <div style="width:100%;max-width:760px;animation:regIn .5s ease both">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:24px">
          <div><h2 style="font-size:27px;font-weight:800;letter-spacing:-.02em;margin:0">Create your account</h2><p style="font-size:14.5px;color:#6b7088;margin:6px 0 0">Self-serve sign-up — takes about 3 minutes.</p></div>
          <button class="reg-link" data-go="launcher"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg> Persona page</button>
        </div>
        <div style="display:flex;align-items:center;gap:12px;background:#e9f5ec;border:1px solid #cfe8d6;color:#236244;border-radius:14px;padding:14px 18px;margin-bottom:30px">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
          <span style="font-size:14px;line-height:1.45;font-weight:500">${kyc ? "We verify your ID + selfie, activate your account, then email a password link. Nothing is shared." : "No ID check needed — submit your details and we email your access link right away. Your email is your username."}</span></div>

        ${secHd(1, "Business details")}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px 22px;margin-bottom:34px">
          <div style="grid-column:1 / -1">${labF("Company / shop name", inp("company", 'type="text" placeholder="e.g. Pakse Bakery"'))}</div>
          ${labF("Entity type", sel("entity", [["sole", "Sole trader (Profit Tax)"], ["company", "Company (Profit Tax)"], ["partnership", "Partnership"]]))}
          ${labF("Business type", sel("biz", [["services", "Services (3%)"], ["commerce", "Trade / retail (3%)"], ["production", "Manufacturing (3%)"]]))}
          ${labF("Country", `<input class="reg-in" value="Lao PDR" style="background:#fbfbfd" readonly>`)}
          ${labF("Language", sel("lang", [["lo", "ລາວ (Lao)"], ["en", "English"], ["th", "ไທย (Thai)"]]))}
        </div>

        ${secHd(2, "Owner &amp; contact")}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px 22px;margin-bottom:34px">
          ${labF(`Owner name <span style="color:#9296ab;font-weight:500">(as on ID)</span>`, inp("owner", 'type="text" placeholder="Your full name"'))}
          ${labF("Email", inp("email", 'type="email" placeholder="you@shop.la"'))}
          ${labF("Phone", inp("phone", 'type="tel" placeholder="+856 20 …"'))}
          ${labF("Confirm email", inp("email2", 'type="email" placeholder="you@shop.la"'))}
        </div>

        ${kyc ? `<div style="display:flex;align-items:center;gap:12px;margin-bottom:8px"><span style="width:26px;height:26px;border-radius:8px;background:#eef0fb;color:#3a4db0;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;flex-shrink:0">3</span><span style="font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#3a4db0">Identity verification</span><span style="flex:1;height:1px;background:#ececf3"></span></div>
        <div style="display:flex;align-items:center;gap:7px;margin:0 0 18px 38px;color:#8a8fa3;font-size:12.5px"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg><span>Encrypted &amp; never shared · JPG or PNG · max 5&nbsp;MB</span></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:22px;margin-bottom:36px">${drop("id")}${drop("selfie")}</div>` : ""}

        <button type="button" class="reg-cta" data-act="register:submit"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg> ${kyc ? "Submit registration" : "Create my account"}</button>
        <p style="text-align:center;font-size:12.5px;color:#9296ab;margin:18px 0 0;line-height:1.5">${kyc ? `Demo only · KYC images are mocked. Sealed in <b style="color:#6b7088;font-weight:600">db_registration</b>; viewing is audited.` : `Demo only · no ID stored — your access link is emailed instantly via the platform channel.`}</p>
        <p style="text-align:center;font-size:13px;color:#6b7088;margin:14px 0 0">Already registered? <button class="reg-link" style="border:none;padding:0;background:none" data-go="login">Log in</button></p>
      </div>
    </main></div>`;
  }

  return { state, portal, landingSection, seedStrip, registerPage, dropInner };
})();
