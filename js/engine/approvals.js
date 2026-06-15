/* ============================================================
   ADEPTIO · approval engine — BO-26
   ONE primitive behind every §A flow: request → checks → decision
   → outcome + audit. Worker-protecting checks (geofence/OT/punch)
   set grade = flag — they never block, they route to review.
   A new approvable type is config (register), not new code.
   ============================================================ */
window.APPROVALS = (function () {
  const TYPES = {
    leave:    { label: "Leave request", scope: "owner", protective: false, check: "balance" },
    ot:       { label: "Overtime", scope: "owner", protective: true, check: "≤3h/day · ≤45h/mo" },
    swap:     { label: "Shift swap", scope: "owner", protective: true, check: "OT guardrail" },
    claim:    { label: "Open-shift claim", scope: "owner", protective: true, check: "OT guardrail" },
    punchfix: { label: "Punch / geofence", scope: "owner", protective: true, check: "geofence" },
    ewa:      { label: "Earned-wage access", scope: "owner", protective: false, check: "≤50% earned-to-date" },
    expense:  { label: "Expense / cash entry", scope: "owner", protective: false, check: "policy" }
  };
  const seed = () => ([
    { id: "AP-245", type: "claim", who: "Noy Phaketh", detail: "Open shift · Wed", grade: "ok", state: "pending" },
    { id: "AP-244", type: "ot", who: "Khamphan Sayasith", detail: "OT 4h · within cap", grade: "ok", state: "pending" },
    { id: "AP-243", type: "swap", who: "Khamla → Souphaphone", detail: "Thu 18 · OT ok", grade: "ok", state: "pending" },
    { id: "AP-242", type: "punchfix", who: "Daophet Many", detail: "Clock-in 50 m out · weak GPS", grade: "flag", state: "pending" },
    { id: "AP-241", type: "leave", who: "Souphaphone Keo", detail: "Annual · 2 days · 18 Jun", grade: "ok", state: "pending" }
  ]);
  const store = {};
  function box(tid) { tid = tid || DATA.state.tenantId; if (!store[tid]) store[tid] = (tid === "phoungern" ? seed() : []); return store[tid]; }
  const inbox = (tid) => box(tid).filter(i => i.state === "pending");
  const pending = (tid) => inbox(tid).length;
  const get = (tid, id) => box(tid).find(i => i.id === id);

  function decide(tid, id, decision, reason) {
    const it = get(tid, id);
    if (!it || it.state !== "pending") return { ok: false };
    it.state = decision; it.reason = reason || "";
    DATA.AUDIT.unshift({ fact: "approve." + it.type, who: "Owner", when: "2026-06-15", ref: id + " · " + decision });
    return { ok: true, it };
  }
  // request → run checks; a failed PROTECTIVE check flags (never blocks); others may auto-reject
  function request(tid, type, payload) {
    const t = TYPES[type] || {};
    payload = payload || {};
    const failed = !!payload.fails;
    const grade = (t.protective && failed) ? "flag" : "ok";
    const it = { id: "AP-" + Date.now(), type, who: payload.who || "—", detail: payload.detail || "", grade, state: "pending" };
    box(tid).unshift(it);
    DATA.AUDIT.unshift({ fact: "approve.request", who: "system", when: "2026-06-15", ref: type + (grade === "flag" ? " · flagged (not blocked)" : "") });
    return it;
  }
  function register(def) {
    TYPES[def.key] = { label: def.label, scope: def.scope || "owner", protective: !!def.protective, check: def.check || "—" };
    DATA.AUDIT.unshift({ fact: "approve.type_registered", who: "Owner", when: "2026-06-15", ref: def.key });
    return TYPES[def.key];
  }
  function __reset() { for (const k in store) delete store[k]; }

  return { TYPES, inbox, pending, get, decide, request, register, __reset };
})();
