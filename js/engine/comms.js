/* ============================================================
   ADEPTIO · comms / announcements engine (BO-19/20)
   ------------------------------------------------------------
   One source of truth for staff-facing messages so the Manager
   Dashboard "Alerts & communication" composer, the Staff Home
   announcement banner, and the Staff Inbox all read the SAME data.

   • Announcements  — manager-created: immediate · scheduled · period
       (period = "stay shown for N days"). Carry a display window.
   • System notices — payslip ready, shift reminder, leave approved.
   • feed(tid)      — the unified inbox list (announcements + notices).
   • active(tid)    — announcements whose display window covers "today"
                      → the top-most banner on Staff Home.
   In-memory; recompute-on-render. Composing also drops a line into
   DATA.OUTBOX so the owner Messaging "Recent sends" reflects it.
   ============================================================ */
window.ANNOUNCE = (function () {
  const TODAY = "2026-06-16";
  const pad = (n) => String(n).padStart(2, "0");
  const isoOf = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  function plusDays(iso, n) { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + n); return isoOf(d); }

  // manager-created announcements, newest first (per tenant)
  const announcements = {
    phoungern: [
      { id: "AN-302", title: "Songkran roster is posted", body: "Pi Mai shifts are live — check your week and request swaps early.", kind: "period", from: "Owner", when: "2026-06-15 12:00", start: "2026-06-15", until: "2026-06-22", channel: "in-app · LINE", tone: "acc" },
      { id: "AN-301", title: "Team lunch this Friday 12:30", body: "Shop stands the team lunch — back-of-house covers the floor 12:30–13:30.", kind: "immediate", from: "Owner", when: "2026-06-14 09:00", start: "2026-06-14", until: null, channel: "in-app", tone: "" }
    ],
    vientianemart: [
      { id: "AN-310", title: "Stock-take Saturday morning", body: "All hands 08:00 Saturday for the monthly count.", kind: "period", from: "Owner", when: "2026-06-14 10:00", start: "2026-06-14", until: "2026-06-21", channel: "in-app", tone: "acc" }
    ]
  };

  // system notices that reach a staff member (shared by Home + Inbox)
  const notices = {
    phoungern: [
      { id: "MS-401", icon: "banknote", title: "Your June payslip is ready", sub: "Tap to see the breakdown", channel: "in-app", when: "2026-06-14 18:04", tone: "ok", go: "staff/web/pay" },
      { id: "MS-402", icon: "calendar", title: "Shift reminder — tomorrow 09:00", sub: "Floor · Main shop", channel: "LINE", when: "2026-06-14 07:30", tone: "", go: "staff/web/schedule" },
      { id: "MS-403", icon: "check", title: "Leave approved · 22–24 Jun", sub: "Annual leave · 3 days", channel: "in-app", when: "2026-06-12 16:20", tone: "", go: "staff/web/leave" }
    ],
    vientianemart: [
      { id: "MS-410", icon: "banknote", title: "Your June payslip is ready", sub: "Tap to see the breakdown", channel: "in-app", when: "2026-06-14 18:04", tone: "ok", go: "staff/web/pay" }
    ]
  };

  let seq = 320;
  const list = (tid) => announcements[tid || DATA.state.tenantId] || [];

  // a "period" window covers today; "scheduled" with a future start is upcoming; "immediate"/no-until shows once posted
  function isActive(a) {
    if (a.start && a.start > TODAY) return false;            // scheduled for the future → not on the banner yet
    if (a.until && a.until < TODAY) return false;            // period elapsed
    return true;
  }
  const active = (tid) => list(tid).filter(isActive);
  const isScheduled = (a) => a.start && a.start > TODAY;

  function statusLabel(a) {
    if (isScheduled(a)) return "scheduled · " + CAL.fmtShort(a.start);
    if (a.kind === "period" && a.until) return "showing until " + CAL.fmtShort(a.until);
    return "live now";
  }

  // manager composes: kind = immediate | scheduled | period
  function add(tid, o) {
    o = o || {};
    if (!o.title || !o.title.trim()) return { ok: false, err: "Write the announcement message first" };
    const kind = o.kind || "immediate";
    let start = TODAY, until = null, when = TODAY + " 09:00";
    if (kind === "scheduled") { if (!o.date) return { ok: false, err: "Pick the date to publish" }; start = o.date; when = o.date + " 09:00"; }
    else if (kind === "period") { const days = Math.max(1, parseInt(o.days, 10) || 7); until = plusDays(TODAY, days); }
    const id = "AN-" + (++seq);
    const rec = { id, title: o.title.trim(), body: (o.body || "").trim(), kind, from: "Owner", when, start, until, channel: o.channel || "in-app · LINE", tone: kind === "period" ? "acc" : "" };
    (announcements[tid] = announcements[tid] || []).unshift(rec);
    DATA.OUTBOX.unshift({ to: "All staff", ch: "in-app", tpl: "Announcement · " + rec.title, when: when, lang: "EN·ລາວ" });
    DATA.AUDIT.unshift({ fact: "comms.announced", who: "Owner", when: TODAY + " 09:50", ref: kind + " · " + rec.title });
    return { ok: true, rec };
  }
  function remove(tid, id) { const a = announcements[tid] || []; announcements[tid] = a.filter(x => x.id !== id); return { ok: true }; }

  // unified inbox feed: announcements (as messages) + system notices, newest first
  function feed(tid) {
    tid = tid || DATA.state.tenantId;
    const ann = list(tid).map(a => ({ id: a.id, icon: "megaphone", title: a.title, sub: a.body || a.from, channel: a.channel, when: a.when, tone: a.tone, kind: a.kind, go: "staff/web/inbox" }));
    const ns = (notices[tid] || []).slice();
    return ann.concat(ns).sort((x, y) => (x.when < y.when ? 1 : -1));
  }
  const unread = (tid) => feed(tid).length;

  function __reset() {
    seq = 320;
    // drop any manager-composed extras (id > seed range), keep seeds
    Object.keys(announcements).forEach(tid => { announcements[tid] = announcements[tid].filter(a => a.id <= "AN-310"); });
  }

  return { list, active, isActive, isScheduled, statusLabel, add, remove, feed, unread, __reset };
})();
