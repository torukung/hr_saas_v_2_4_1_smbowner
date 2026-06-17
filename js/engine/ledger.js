/* ============================================================
   ADEPTIO · cashbook ledger — BO-6
   Per-tenant entries · manual add · day/week/month views ·
   auto-post on payroll close (Salaries + Employer NSSF, locked) ·
   monthly cost/benefit rollup (revenue monthly + LIVE staff cost
   from PAYROLL). CSV export. In-memory (no backend this pass).
   ============================================================ */
window.LEDGER = (function () {
  const store = {};
  let view = "month"; // day | week | month

  function init(tid) {
    if (!store[tid]) {
      store[tid] = (DATA.LEDGER[tid] || []).map((e, i) => Object.assign({ id: "L" + tid + i, tenant: tid, source: "manual", locked: false }, e));
    }
    return store[tid];
  }
  const all = (tid) => init(tid).slice().sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : 0);

  function add(tid, e) {
    init(tid);
    store[tid].unshift(Object.assign({ id: "L" + Date.now(), tenant: tid, source: "manual", locked: false }, e));
    DATA.AUDIT.unshift({ fact: "ledger.added", who: "Owner", when: "2026-06-15", ref: (e.kind === "rev" ? "+" : "−") + UI.kip(e.amount).replace("₭ ", "") });
  }

  // payroll close → two locked expense lines (gross + employer NSSF = staff cost)
  function postFromRun(tid, run) {
    init(tid);
    // avoid duplicates if re-posted
    store[tid] = store[tid].filter(e => !(e.source === "payroll" && e.run === run.id));
    const d = "2026-06-15";
    store[tid].unshift({ id: "Lpay-er-" + run.id, tenant: tid, date: d, kind: "exp", cat: "Employer NSSF (6%)", amount: run.totals.ssEr, method: "transfer", tax: "exempt", source: "payroll", run: run.id, locked: true });
    store[tid].unshift({ id: "Lpay-" + run.id, tenant: tid, date: d, kind: "exp", cat: "Salaries (gross)", amount: run.totals.gross, method: "transfer", tax: "exempt", source: "payroll", run: run.id, locked: true });
    DATA.AUDIT.unshift({ fact: "ledger.posted", who: "system", when: "2026-06-15 16:40", ref: "staff cost ← " + run.id });
  }

  function inRange(date, v) {
    if (v === "month") return date >= "2026-06-01" && date <= "2026-06-30";
    if (v === "week") return date >= "2026-06-09";
    return date >= "2026-06-14"; // day (latest)
  }
  function ranged(tid, v) { return all(tid).filter(e => inRange(e.date, v || view)); }
  function sums(list) {
    const rev = list.filter(e => e.kind === "rev").reduce((s, e) => s + e.amount, 0);
    const exp = list.filter(e => e.kind === "exp").reduce((s, e) => s + e.amount, 0);
    return { rev, exp, net: rev - exp, count: list.length };
  }
  const setView = (v) => { view = v; };
  const getView = () => view;
  const hasPayrollLines = (tid) => init(tid).some(e => e.source === "payroll");

  // monthly P&L — REPLAYED: revenue + other-expense from the cashbook, staff cost LIVE from payroll
  function rollup(tid) {
    tid = tid || DATA.state.tenantId;
    const list = all(tid);
    const revenue = list.filter(e => e.kind === "rev").reduce((s, e) => s + e.amount, 0);
    const otherExp = list.filter(e => e.kind === "exp" && e.source !== "payroll").reduce((s, e) => s + e.amount, 0);
    const channelFee = ((DATA.byId(tid) || {}).month || {}).channelFee || 0;
    const run = PAYROLL.computeRun(tid);
    const staffCost = run.totals.cost;
    const result = revenue - staffCost - otherExp - channelFee;
    return {
      revenue, staffCost, otherExp, channelFee,
      result, margin: revenue ? result / revenue : 0,
      staffRatio: revenue ? staffCost / revenue : 0,
      costPerHead: run.totals.headcount ? Math.round(staffCost / run.totals.headcount) : 0,
      level: run.level
    };
  }

  // top expense categories this month (cashbook, descending)
  function topExpenses(tid, n) {
    const m = {};
    ranged(tid, "month").filter(e => e.kind === "exp").forEach(e => { m[e.cat] = (m[e.cat] || 0) + e.amount; });
    return Object.keys(m).map(cat => ({ cat, amount: m[cat] })).sort((a, b) => b.amount - a.amount).slice(0, n || 5);
  }

  // ---- recurring / scheduled expenses (waiting to be posted to the cashbook) ----
  const recur = {};
  function initRecur(tid) {
    if (!recur[tid]) recur[tid] = (DATA.RECUR_EXPENSES[tid] || []).map((e, i) => Object.assign({ id: "RX" + tid + i, tenant: tid, posted: false }, e));
    return recur[tid];
  }
  const recurring = (tid) => initRecur(tid).slice().sort((a, b) => a.next < b.next ? -1 : a.next > b.next ? 1 : 0);
  function advance(iso, freq) {
    const d = new Date(iso);
    if (freq === "weekly") d.setDate(d.getDate() + 7);
    else if (freq === "yearly") d.setFullYear(d.getFullYear() + 1);
    else d.setMonth(d.getMonth() + 1);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function postRecurring(tid, id) {
    const r = initRecur(tid).find(x => x.id === id); if (!r) return { ok: false };
    const today = (window.CAL && CAL.TODAY) || "2026-06-16";
    add(tid, { date: today, kind: "exp", cat: r.cat, amount: r.amount, method: r.method || "transfer", tax: r.tax || "exempt" });
    r.next = advance(r.next, r.freq);
    DATA.AUDIT.unshift({ fact: "expense.posted", who: "Owner", when: today + " 09:30", ref: r.name + " · " + UI.kip(r.amount).replace("₭ ", "") + " (" + r.freq + ")" });
    return { ok: true, r };
  }
  function setRecurringFreq(tid, id, freq) {
    const r = initRecur(tid).find(x => x.id === id); if (!r) return { ok: false };
    r.freq = freq;
    DATA.AUDIT.unshift({ fact: "expense.scheduled", who: "Owner", when: "2026-06-16 09:30", ref: r.name + " → " + freq });
    return { ok: true, r };
  }
  function addRecurring(tid, obj) {
    if (!obj || !obj.name || !obj.amount) return { ok: false, err: "Name and amount are required" };
    initRecur(tid);
    recur[tid].unshift(Object.assign({ id: "RX" + Date.now(), tenant: tid, posted: false, next: "2026-07-01", method: "transfer", tax: "exempt", cat: obj.name }, obj));
    DATA.AUDIT.unshift({ fact: "expense.scheduled", who: "Owner", when: "2026-06-16 09:30", ref: obj.name + " · " + (obj.freq || "monthly") });
    return { ok: true };
  }

  function toCSV(tid) {
    const rows = [["Date", "Type", "Category", "Method", "Amount (LAK)", "Source"]]
      .concat(all(tid).map(e => [e.date, e.kind, e.cat, e.method, e.amount, e.source]));
    return rows.map(r => r.map(c => /[",\n]/.test(String(c)) ? '"' + String(c).replace(/"/g, '""') + '"' : c).join(",")).join("\n");
  }
  function __reset() { for (const k in store) delete store[k]; for (const k in recur) delete recur[k]; view = "month"; }

  return { init, all, add, postFromRun, ranged, sums, rollup, toCSV, setView, getView, hasPayrollLines, topExpenses, recurring, postRecurring, setRecurringFreq, addRecurring, __reset };
})();
