/* ============================================================
   ADEPTIO · platform mail server + alerts engine (Communications)
   ------------------------------------------------------------
   ONE place the whole platform sends email from. Two job kinds:
   · transactional — activation link, password reset (always on)
   · alerts        — resource-limit, KYC pending, billing (toggleable)

   The KYC & registration hub's "email channel" now reads/writes
   THIS config (REG.getChannel/setChannel/testChannel delegate here),
   so there is a SINGLE server, not two.

   Demo note: this captures + validates config and logs sends to the
   outbox/audit. Actual delivery is server-side — the Cloudflare Worker
   mail relay opens SMTP (465/587) to this host at runtime; the secret
   (App Password) lives on the Worker, never in the browser or the DB.
   In-memory; recompute-on-render. No backend this pass.
   ============================================================ */
window.MAIL = (function () {
  const TODAY = "2026-06-17";

  /* ---------------- the one SMTP server every email goes through ---------------- */
  const DEFAULT = {
    provider: "SMTP",                       // SMTP | ESP (HTTP API)
    host: "smtp.gmail.com",
    port: 465,
    security: "ssl",                        // ssl (465) · starttls (587) · none
    username: "adeptio.stage@gmail.com",    // the full Gmail address that authenticates
    from: "adeptio.stage@gmail.com",        // consumer Gmail forces From = the authenticated address
    fromName: "Adeptio HR",
    replyTo: "",
    hasSecret: true                         // App Password held server-side (never stored here)
  };
  let cfg = Object.assign({}, DEFAULT);

  // status is DERIVED, never stored stale — keeps back-compat with the old REG channel
  // (which was "connected" once host + from were present).
  function status() { return (cfg.host && cfg.from) ? "connected" : "not configured"; }
  function credentialsSet() { return !!(cfg.username && cfg.hasSecret); }
  function config() { return Object.assign({}, cfg, { status: status() }); }
  // the shape the KYC card / REG.getChannel() expect
  function asChannel() { return { provider: cfg.provider, host: cfg.host, port: cfg.port, from: cfg.from, secure: cfg.security !== "none", status: status() }; }

  function save(obj) {
    obj = obj || {};
    ["provider", "host", "from", "fromName", "replyTo", "username", "security"].forEach(k => {
      if (obj[k] !== undefined && String(obj[k]).trim() !== "") cfg[k] = String(obj[k]).trim();
    });
    if (obj.port !== undefined && String(obj.port).trim() !== "") cfg.port = parseInt(obj.port, 10) || cfg.port;
    if (obj.secret) cfg.hasSecret = true;                 // a secret was entered → held server-side
    if (obj.hasSecret !== undefined) cfg.hasSecret = !!obj.hasSecret;
    DATA.AUDIT.unshift({ fact: "comms.server_set", who: "Platform", when: TODAY, ref: cfg.provider + " · " + cfg.host + ":" + cfg.port });
    return config();
  }

  /* ---------------- Gmail / Workspace one-tap presets ---------------- */
  const PRESETS = {
    gmail:     { provider: "SMTP", host: "smtp.gmail.com",       port: 465, security: "ssl",      label: "Gmail · SSL 465" },
    gmail587:  { provider: "SMTP", host: "smtp.gmail.com",       port: 587, security: "starttls", label: "Gmail · STARTTLS 587" },
    workspace: { provider: "SMTP", host: "smtp-relay.gmail.com", port: 587, security: "starttls", label: "Workspace relay · 587" }
  };
  function applyPreset(id) {
    const p = PRESETS[id]; if (!p) return config();
    cfg.provider = p.provider; cfg.host = p.host; cfg.port = p.port; cfg.security = p.security;
    DATA.AUDIT.unshift({ fact: "comms.server_preset", who: "Platform", when: TODAY, ref: id + " · " + cfg.host + ":" + cfg.port });
    return config();
  }

  /* ---------------- the email catalogue: what this server sends ---------------- */
  // transactional = the funnel can't run without it → always on (no toggle)
  const CATALOG = [
    { key: "activation", kind: "transactional", label: "Account activation link", desc: "72-h set-password link on registration / KYC approval", icon: "userCheck" },
    { key: "password",   kind: "transactional", label: "Password reset",          desc: "Self-serve reset link for any account",                 icon: "key" },
    { key: "reslimit",   kind: "alert",         label: "Resource-limit alert",     desc: "A tenant crosses its seat / message / storage cap",     icon: "gauge",  def: true },
    { key: "kycpending", kind: "alert",         label: "KYC pending reminder",     desc: "A new shop is waiting for review",                      icon: "idcard", def: true },
    { key: "billing",    kind: "alert",         label: "Billing & licensing",      desc: "Metered-channel statements and plan changes",           icon: "wallet", def: false }
  ];
  const alerts = {};
  CATALOG.filter(c => c.kind === "alert").forEach(c => alerts[c.key] = c.def);
  const alertOn = (key) => !!alerts[key];
  function toggleAlert(key) {
    if (key in alerts) { alerts[key] = !alerts[key]; DATA.AUDIT.unshift({ fact: "comms.alert_" + (alerts[key] ? "on" : "off"), who: "Platform", when: TODAY, ref: key }); }
    return alertOn(key);
  }

  let threshold = 75;                          // notify at ≥ N% of a cap
  const getThreshold = () => threshold;
  function setThreshold(pct) {
    pct = parseInt(pct, 10);
    if (pct >= 50 && pct <= 100) { threshold = pct; DATA.AUDIT.unshift({ fact: "comms.threshold_set", who: "Platform", when: TODAY, ref: pct + "%" }); }
    return threshold;
  }

  // platform operators who receive alerts (the recipient side)
  const recipients = ["platform@adeptio.la"];

  /* ---------------- send log (newest first) — seeded so the screen reads alive ---------------- */
  const SEED = [
    { to: "vk@sabaidee.la",       subject: "Activate your Adeptio account · set password", kind: "activation", when: "2026-06-17 09:12", via: "smtp.gmail.com", state: "sent" },
    { to: "platform@adeptio.la",  subject: "Phoungern Co. — LINE quota at 76%",            kind: "reslimit",   when: "2026-06-16 22:40", via: "smtp.gmail.com", state: "sent" }
  ];
  let log = SEED.slice();
  const logList = () => log.slice();
  function record(to, subject, kind) {
    const rec = { to, subject, kind, when: TODAY + " 17:00", via: cfg.host, state: status() === "connected" ? "sent" : "queued" };
    log.unshift(rec);
    DATA.OUTBOX.unshift({ to, ch: "email", tpl: subject, when: rec.when, lang: "EN·ລາວ" });
    return rec;
  }

  // send a typed email through the server (used by REG + the alert actions)
  function send(kind, to, subject) {
    const rec = record(to, subject, kind);
    DATA.AUDIT.unshift({ fact: "comms.sent", who: "system", when: rec.when, ref: kind + " → " + to + " · via " + cfg.host });
    return rec;
  }
  function test() {
    const rec = record(cfg.from || "platform@adeptio.la", "Adeptio · mail-server test", "test");
    DATA.AUDIT.unshift({ fact: "comms.server_test", who: "Platform", when: rec.when, ref: cfg.host + ":" + cfg.port });
    return rec;
  }

  /* ---------------- resource-limit detection (drives the alert) ---------------- */
  const pct = (u, l) => l ? Math.round(u / l * 100) : 0;
  function tenantBreaches(t) {
    if (!t || t.status !== "active") return [];
    const out = [];
    if (t.seats) { const s = t.seats.staff; if (pct(s.used, s.limit) >= threshold) out.push({ metric: "seats", label: "Staff seats", used: s.used, limit: s.limit, pct: pct(s.used, s.limit) }); }
    if (t.quota) ["line", "whatsapp"].forEach(m => { const q = t.quota[m]; if (q && pct(q.used, q.limit) >= threshold) out.push({ metric: m, label: m === "line" ? "LINE messages" : "WhatsApp messages", used: q.used, limit: q.limit, pct: pct(q.used, q.limit) }); });
    if (t.storage) { const g = t.storage; if (pct(g.used, g.limit) >= threshold) out.push({ metric: "storage", label: "Storage", used: g.used, limit: g.limit, pct: pct(g.used, g.limit) }); }
    return out;
  }
  // active tenants with at least one meter at/over the threshold (for the Resources page card)
  function breachingTenants() {
    return DATA.TENANTS.filter(t => t.status === "active").map(t => ({ t, breaches: tenantBreaches(t) })).filter(x => x.breaches.length);
  }
  function alertResource(tid, metric) {
    const t = DATA.byId(tid); if (!t) return { ok: false, err: "Unknown tenant" };
    if (!alertOn("reslimit")) return { ok: false, err: "Resource-limit alerts are off — enable them in Communications" };
    const b = (metric && tenantBreaches(t).find(x => x.metric === metric)) || tenantBreaches(t)[0];
    const subject = t.name + " — " + (b ? b.label + " at " + b.pct + "%" : "resource limit reached");
    recipients.forEach(r => send("reslimit", r, subject));
    return { ok: true, subject };
  }

  function __reset() {
    cfg = Object.assign({}, DEFAULT);
    threshold = 75;
    CATALOG.filter(c => c.kind === "alert").forEach(c => alerts[c.key] = c.def);
    log = SEED.slice();
  }

  return {
    TODAY, config, asChannel, save, applyPreset, PRESETS, CATALOG,
    alertOn, toggleAlert, getThreshold, setThreshold, credentialsSet, recipients,
    log: logList, send, test, record, tenantBreaches, breachingTenants, alertResource, status, __reset
  };
})();
