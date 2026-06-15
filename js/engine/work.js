/* ============================================================
   ADEPTIO · work engine — §W BO-15/16 (scheduling · swap) +
   BO-19/22 alerts (payday · tax nudge).
   Swap/claim run on the ONE approval engine (BO-26) — a swap that
   breaks the Lao OT guardrail is flagged, never auto-applied.
   Alerts queue to the comms outbox (in-app + email free; LINE/WA
   metered, pending account — BO-9/10 deferred).
   ============================================================ */
window.WORK = (function () {
  const published = {};
  const templates = ["Weekday · 09:00–18:00 ×6", "Weekend · 10:00–20:00 ×8", "Festival (Songkran) ×4"];

  function week(tid) { tid = tid || DATA.state.tenantId; return DATA.SHIFTS.map(s => ({ day: s.day, assigned: s.assigned, open: s.open, published: !!published[tid] })); }
  const isPublished = (tid) => !!published[tid || DATA.state.tenantId];
  function publish(tid) { tid = tid || DATA.state.tenantId; published[tid] = true; DATA.AUDIT.unshift({ fact: "schedule.published", who: "Owner", when: "2026-06-15", ref: "week roster" }); }

  // swap / open-shift claim → approval engine, OT-guarded (protective check → flag, never block)
  function swap(tid, detail, breaksOT) { return APPROVALS.request(tid, "swap", { who: detail || "Shift swap", detail: breaksOT ? "breaks OT guardrail" : "OT ok", fails: !!breaksOT }); }
  function claim(tid, who, breaksOT) { return APPROVALS.request(tid, "claim", { who: who || "Open-shift claim", detail: breaksOT ? "breaks OT guardrail" : "open shift", fails: !!breaksOT }); }

  // BO-19 payday alert · BO-22 tax nudge → comms outbox + audit
  function paydayAlert(tid, run) {
    DATA.OUTBOX.unshift({ to: "All staff", ch: "in-app", tpl: "Payslip ready · " + (run ? run.period : ""), when: "2026-06-15 16:40", lang: "EN·ລາວ" });
    DATA.AUDIT.unshift({ fact: "comms.sent", who: "system", when: "2026-06-15", ref: "payday alert · in-app (+email)" });
  }
  function taxNudge(tid, period, amount) {
    DATA.OUTBOX.unshift({ to: "Owner", ch: "in-app", tpl: "Tax due · " + period, when: "2026-06-15", lang: "EN·ລາວ" });
    DATA.AUDIT.unshift({ fact: "comms.sent", who: "system", when: "2026-06-15", ref: "tax nudge · " + period });
  }
  function __reset() { for (const k in published) delete published[k]; }

  return { week, isPublished, publish, swap, claim, paydayAlert, taxNudge, templates, __reset };
})();
