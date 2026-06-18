/* ============================================================
   ADEPTIO · registration + KYC engine (blueprint §2 · BO-11/12)
   Public self-serve register → pending → Platform activates →
   password/activation email via the configured channel. Pending
   rows auto-disable past their deadline. One hub manages it all.
   ============================================================ */
window.REG = (function () {
  const TODAY = "2026-06-15";
  // pre-register comms channel — password delivery / email confirmation
  const channel = { provider: "SMTP", host: "smtp.adeptio.la", port: 465, from: "noreply@adeptio.la", secure: true, status: "connected" };
  let autoDisableOn = true, autoDisableDays = 7;
  let list = null;
  // master platform feature — when OFF, self-serve registration + KYC review + all related menus are disabled. Default OFF.
  let kycEnabled = false;
  const kycOn = () => kycEnabled;
  function setKyc(on) { kycEnabled = !!on; DATA.AUDIT.unshift({ fact: "platform.kyc_" + (kycEnabled ? "on" : "off"), who: "Platform", when: TODAY, ref: "KYC & registration " + (kycEnabled ? "enabled" : "disabled") + " platform-wide" }); return kycEnabled; }

  function deadlineFrom(d) { const dt = new Date(d + "T12:00:00"); dt.setDate(dt.getDate() + autoDisableDays); return dt.toISOString().slice(0, 10); }
  function seed() {
    list = DATA.REGISTRATIONS.map(r => Object.assign({ lang: "lo", entity: "sole", biz: "services", deadline: deadlineFrom(r.submitted) }, r));
    // near-deadline pending + an expired pending (demonstrates auto-disable)
    list.unshift({ id: "REG-0475", company: "Pakse Bakery", owner: "Khamphout Sengaloun", email: "khamphout@paksebakery.la", phone: "+856 20 99 1xx 442", submitted: "2026-06-15", status: "pending", idType: "National ID card", match: "strong", lang: "lo", entity: "sole", biz: "commerce", deadline: "2026-06-22" });
    list.push({ id: "REG-0468", company: "Nong Khai Trading", owner: "(no selfie)", email: "n/a@—", phone: "—", submitted: "2026-06-02", status: "pending", idType: "—", match: "review", lang: "en", entity: "company", biz: "commerce", deadline: "2026-06-09" });
  }
  function applyAutoDisable() {
    if (!autoDisableOn || !list) return;
    list.forEach(r => {
      if (r.status === "pending" && r.deadline < TODAY) {
        r.status = "disabled";
        if (!r._dz) { r._dz = true; DATA.AUDIT.unshift({ fact: "kyc.auto_disabled", who: "system", when: TODAY, ref: r.id + " · past " + r.deadline }); }
      }
    });
  }
  function all() { if (!list) seed(); applyAutoDisable(); return list.slice(); }
  const pending = () => all().filter(r => r.status === "pending");
  const get = (id) => all().find(r => r.id === id);
  const counts = () => { const a = all(); return { pending: a.filter(r => r.status === "pending").length, active: a.filter(r => r.status === "active").length, disabled: a.filter(r => r.status === "disabled").length, rejected: a.filter(r => r.status === "rejected").length, total: a.length }; };

  function submit(form) {
    if (!list) seed();
    const id = "REG-" + (480 + list.length);
    const r = Object.assign({ id, submitted: TODAY, status: "pending", match: "review", deadline: deadlineFrom(TODAY) }, form);
    list.unshift(r);
    DATA.AUDIT.unshift({ fact: "kyc.registered", who: form.owner || "applicant", when: TODAY, ref: id + " · " + (form.company || "") });
    return r;
  }
  /* ---------------- activation tokens (the 72-h set-password link) ----------------
     Each activation issues a single-use token. The email carries #/activate/<token>;
     opening it lands on the set-password page, which creates the real login account
     and a live tenant, then marks the token used. Tokens live in memory (sealed; a
     real build keeps them in db_registration). */
  const TOKENS = {};
  let lastIssued = null;
  function genToken() { const c = "abcdefghijkmnpqrstuvwxyz0123456789"; let s = ""; for (let i = 0; i < 28; i++) s += c[Math.floor(Math.random() * c.length)]; return s; }
  function addDays(iso, n) { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
  function issueToken(r) {
    const token = genToken();
    TOKENS[token] = {
      token, regId: r.id, email: r.email, name: r.owner, company: r.company,
      persona: "owner", scopes: ["owner"], role: "Owner",
      entity: r.entity, biz: r.biz, lang: r.lang, noKyc: !!r.noKyc,
      issued: TODAY, expires: addDays(TODAY, 3), used: false
    };
    r.token = token; r.activateBy = TOKENS[token].expires;
    lastIssued = TOKENS[token];
    return token;
  }
  const linkOf = (token) => "#/activate/" + token;        // the working in-app route
  function tokenInfo(token) {
    const rec = TOKENS[token];
    if (!rec) return { state: "invalid", rec: null };
    if (rec.used) return { state: "used", rec };
    if (rec.expires < TODAY) return { state: "expired", rec };
    return { state: "valid", rec };
  }
  // the final step of "create a new account": the owner sets their password → a real
  // sign-in-able account + a fresh live tenant; the token is then spent.
  function setPassword(token, pwd) {
    const info = tokenInfo(token);
    if (info.state !== "valid") return { ok: false, err: info.state === "used" ? "This link has already been used — try signing in." : info.state === "expired" ? "This link has expired. Ask the operator to re-send it." : "This activation link isn't valid." };
    if (!pwd || String(pwd).length < 6) return { ok: false, err: "Choose a password of at least 6 characters." };
    const rec = info.rec, r = get(rec.regId);
    const tenant = DATA.createTenant({ company: rec.company, owner: rec.name, entity: rec.entity, biz: rec.biz, lang: rec.lang });
    if (r) { r.tenant = tenant; r.status = "active"; r.activated = true; }
    const account = window.AUTH ? AUTH.addAccount({ email: rec.email, pwd: String(pwd), name: rec.name, persona: "owner", scopes: ["owner"], tenant, role: "Owner" }) : null;
    rec.used = true; rec.usedAt = TODAY;
    DATA.AUDIT.unshift({ fact: "auth.password_set", who: rec.email, when: TODAY, ref: rec.regId + " · activation complete" });
    DATA.AUDIT.unshift({ fact: "auth.account_created", who: "system", when: TODAY, ref: rec.email + " · owner · tenant " + tenant });
    return { ok: true, account, tenant, persona: "owner", email: rec.email, name: rec.name };
  }

  function sendConfirmation(r) { // issue the link + send it through the ONE platform mail server
    const token = r.token || issueToken(r);
    const subject = r.noKyc ? "Your Adeptio access link · set your password" : "Activate your account · set your password (72-h link)";
    if (window.MAIL) MAIL.send("activation", r.owner + " <" + r.email + ">", subject);
    else DATA.OUTBOX.unshift({ to: r.owner + " <" + r.email + ">", ch: "email", tpl: subject, when: TODAY + " 17:00", lang: "EN·ລາວ" });
    DATA.AUDIT.unshift({ fact: "auth.invite", who: "system", when: TODAY, ref: r.email + " · set-password link via " + getChannel().provider });
    return token;
  }
  // random temporary password (no ambiguous chars)
  function genPassword() { const c = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"; let p = ""; for (let i = 0; i < 10; i++) p += c[Math.floor(Math.random() * c.length)]; return p; }
  // no-KYC instant registration (KYC feature off): active immediately + email the
  // set-password link (username = email). Same link mechanism as the KYC path.
  function registerInstant(form) {
    if (!list) seed();
    const id = "REG-" + (480 + list.length), pwd = genPassword();
    const r = Object.assign({ id, submitted: TODAY, status: "active", match: "n/a", deadline: deadlineFrom(TODAY), noKyc: true, tempPwd: pwd }, form);
    list.unshift(r);
    DATA.AUDIT.unshift({ fact: "registration.instant", who: form.owner || "applicant", when: TODAY, ref: id + " · " + (form.company || "") + " · no-KYC" });
    sendConfirmation(r); // issues token + emails the set-password access link via the platform server
    return r;
  }
  function activate(id) { const r = get(id); if (!r) return; r.status = "active"; DATA.AUDIT.unshift({ fact: "kyc.activated", who: "Platform", when: TODAY, ref: id }); sendConfirmation(r); return r; }
  function reject(id, reason) { const r = get(id); if (!r) return; r.status = "rejected"; r.reason = reason || "not verified"; DATA.AUDIT.unshift({ fact: "kyc.rejected", who: "Platform", when: TODAY, ref: id + " · " + r.reason }); return r; }
  function disable(id) { const r = get(id); if (!r) return; r.status = "disabled"; DATA.AUDIT.unshift({ fact: "kyc.disabled", who: "Platform", when: TODAY, ref: id }); return r; }

  // The platform mail server (MAIL engine) is the single source of truth. These
  // delegate to it so the KYC card and the Communications page edit ONE config;
  // the local `channel` is only a fallback if MAIL hasn't loaded.
  function getChannel() { return window.MAIL ? MAIL.asChannel() : channel; }
  function setChannel(obj) {
    if (window.MAIL) { MAIL.save(obj); return; }
    Object.assign(channel, obj); channel.status = (channel.host && channel.from) ? "connected" : "not configured";
    DATA.AUDIT.unshift({ fact: "comms.channel_set", who: "Platform", when: TODAY, ref: channel.provider + " · " + channel.host });
  }
  function testChannel() {
    if (window.MAIL) { MAIL.test(); return; }
    DATA.OUTBOX.unshift({ to: channel.from, ch: "email", tpl: "Channel test · " + channel.host, when: TODAY + " 17:05", lang: "EN" });
    DATA.AUDIT.unshift({ fact: "comms.channel_test", who: "Platform", when: TODAY, ref: channel.host });
  }

  const autoDisable = () => ({ on: autoDisableOn, days: autoDisableDays });
  function setAutoDisable(on, days) { autoDisableOn = !!on; if (days) autoDisableDays = days; DATA.AUDIT.unshift({ fact: "kyc.autodisable_" + (on ? "on" : "off"), who: "Platform", when: TODAY, ref: autoDisableDays + "d" }); }
  function __reset() { list = null; autoDisableOn = true; autoDisableDays = 7; kycEnabled = false; for (const k in TOKENS) delete TOKENS[k]; lastIssued = null; Object.assign(channel, { provider: "SMTP", host: "smtp.adeptio.la", port: 465, from: "noreply@adeptio.la", secure: true, status: "connected" }); if (window.MAIL) MAIL.__reset(); }

  return { TODAY, all, pending, get, counts, submit, registerInstant, activate, reject, disable, sendConfirmation, getChannel, setChannel, testChannel, autoDisable, setAutoDisable, kycOn, setKyc, issueToken, linkOf, tokenInfo, setPassword, lastIssued: () => lastIssued, __reset };
})();
