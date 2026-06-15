/* ============================================================
   ADEPTIO · feature flags — BO-24
   Core features are always on (no toggle). Every other feature is
   a per-tenant switch; owner toggles all, manager an operational
   subset. Off = hide menu + pause engine, DATA RETAINED. Audited.
   ============================================================ */
window.FLAGS = (function () {
  // optional features: scope = who may toggle · hides = menu ids to hide per persona when off
  const REGISTRY = {
    geofence:   { label: "Geofence on punch", scope: "manager", def: true },
    selfie:     { label: "Selfie capture", scope: "manager", def: true },
    scheduling: { label: "Scheduling / roster", scope: "manager", def: true, hides: { owner: ["scheduling"], staff: ["schedule"] } },
    shiftswap:  { label: "Shift swap & open-shift", scope: "manager", def: true },
    etd:        { label: "Earned-to-date tracker", scope: "manager", def: true },
    nudges:     { label: "Compliance-calendar nudges", scope: "manager", def: true },
    labourcost: { label: "Live labour-cost tile", scope: "manager", def: true },
    ewa:        { label: "Earned-wage access (EWA)", scope: "owner", def: false, hides: { owner: ["advances"] } },
    onetap:     { label: "One-tap payroll run", scope: "owner", def: true },
    line:       { label: "LINE channel", scope: "owner", def: false },
    whatsapp:   { label: "WhatsApp channel", scope: "owner", def: false },
    cloudbackup:{ label: "Weekly cloud backup & reports", scope: "owner", def: false }
  };
  const ORDER = Object.keys(REGISTRY);
  const CORE = [
    ["punch", "Clock in/out · attendance"], ["leave", "Leave request & balance"],
    ["payroll", "Payroll core · NSSF + PIT"], ["accounting", "Cashbook + tax centre"],
    ["identity", "Identity · access & security"], ["audit", "Audit log + backup"]
  ];

  const state = {}; // tid → { feature: bool }   (db_tenant.flags)
  function f(tid) {
    tid = tid || DATA.state.tenantId;
    if (!state[tid]) { state[tid] = {}; ORDER.forEach(k => state[tid][k] = REGISTRY[k].def); }
    return state[tid];
  }
  function on(tid, feature) { return REGISTRY[feature] ? !!f(tid)[feature] : true; }
  function set(tid, feature, val, callerScope) {
    const reg = REGISTRY[feature];
    if (!reg) return { ok: false, err: "Unknown feature." };
    if (reg.scope === "owner" && callerScope === "manager") return { ok: false, err: "Owner-only flag — a manager can't change this." };
    f(tid)[feature] = !!val;
    DATA.AUDIT.unshift({ fact: "flag.set", who: callerScope === "manager" ? "Manager" : "Owner", when: "2026-06-15", ref: feature + " = " + (val ? "on" : "off") });
    return { ok: true };
  }
  // screen ids to hide for a persona because their feature is off (data retained underneath)
  function hiddenScreens(tid, persona) {
    const s = new Set();
    ORDER.forEach(k => { if (!on(tid, k) && REGISTRY[k].hides && REGISTRY[k].hides[persona]) REGISTRY[k].hides[persona].forEach(id => s.add(id)); });
    return s;
  }
  function __reset() { for (const k in state) delete state[k]; }

  return { REGISTRY, ORDER, CORE, on, set, hiddenScreens, __reset };
})();
