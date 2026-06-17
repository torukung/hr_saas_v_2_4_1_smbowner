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
  function sendConfirmation(r) { // password delivery / email confirmation via the channel
    DATA.OUTBOX.unshift({ to: r.owner + " <" + r.email + ">", ch: "email", tpl: "Activate your account · set password (72-h link)", when: TODAY + " 17:00", lang: "EN·ລາວ" });
    DATA.AUDIT.unshift({ fact: "auth.invite", who: "system", when: TODAY, ref: r.email + " · via " + getChannel().provider });
  }
  // random temporary password (no ambiguous chars)
  function genPassword() { const c = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"; let p = ""; for (let i = 0; i < 10; i++) p += c[Math.floor(Math.random() * c.length)]; return p; }
  // no-KYC instant registration (KYC feature off): auto-activate + email an access link · username = email · random password
  function registerInstant(form) {
    if (!list) seed();
    const id = "REG-" + (480 + list.length), pwd = genPassword();
    const r = Object.assign({ id, submitted: TODAY, status: "active", match: "n/a", deadline: deadlineFrom(TODAY), noKyc: true, tempPwd: pwd }, form);
    list.unshift(r);
    DATA.AUDIT.unshift({ fact: "registration.instant", who: form.owner || "applicant", when: TODAY, ref: id + " · " + (form.company || "") + " · no-KYC" });
    DATA.OUTBOX.unshift({ to: form.email, ch: "email", tpl: "Your Adeptio access link · username " + form.email + " · temporary password", when: TODAY + " 17:00", lang: "EN·ລາວ" });
    DATA.AUDIT.unshift({ fact: "auth.invite", who: "system", when: TODAY, ref: form.email + " · instant access (no-KYC) via " + getChannel().provider });
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
  function __reset() { list = null; autoDisableOn = true; autoDisableDays = 7; kycEnabled = false; Object.assign(channel, { provider: "SMTP", host: "smtp.adeptio.la", port: 465, from: "noreply@adeptio.la", secure: true, status: "connected" }); if (window.MAIL) MAIL.__reset(); }

  return { TODAY, all, pending, get, counts, submit, registerInstant, activate, reject, disable, sendConfirmation, getChannel, setChannel, testChannel, autoDisable, setAutoDisable, kycOn, setKyc, __reset };
})();
