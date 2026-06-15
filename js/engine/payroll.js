/* ============================================================
   ADEPTIO · payroll engine — BO-4 (calc) + BO-5 (lifecycle · leveling)
   Pure, table-driven from db_tax (DATA.PIT_BRACKETS · DATA.SS).
   Verified vector: base 6,000,000 → ssEmp 247,500 · ssEr 270,000
   · taxable 5,752,500 · pit 260,250 · net 5,492,250 · cost 6,270,000
   ============================================================ */
window.PAYROLL = (function () {
  // rates come from the effective-dated tax tables (TAX.current); DATA is the seed/fallback
  const TBL = () => (window.TAX ? TAX.current() : { ss: DATA.SS, pit: DATA.PIT_BRACKETS });
  const CAP = () => TBL().ss.cap, EE = () => TBL().ss.ee, ER = () => TBL().ss.er;
  const STATES = ["draft", "review", "approve", "pay", "file", "close"];

  // progressive PIT — each slice taxed at its own marginal rate
  function pitOn(taxable) {
    let p = 0;
    for (const [lo, hi, rate] of TBL().pit) if (taxable > lo) p += (Math.min(taxable, hi) - lo) * rate;
    return Math.round(p);
  }
  function comp(person) {
    return {
      base: person.base || 0,
      allowances: person.allowances || 0,
      ot: person.ot || 0,
      bonus: person.bonus || 0,
      ssEligible: person.ssEligible !== false,
      other: (person.other || 0) + pendingRecovery(person.id) // base other + EWA recovery clawed back next payday
    };
  }

  // BO-4 — one payslip. level L0 = net-only (no statutory math); L1+ = full.
  function computeSlip(person, level) {
    const c = comp(person);
    const gross = c.base + c.allowances + c.ot + c.bonus;
    const statutory = level !== "L0";
    let ssBase = 0, ssEmp = 0, ssEr = 0, taxable = gross, pit = 0;
    if (statutory) {
      ssBase = c.ssEligible ? Math.min(gross, CAP()) : 0;
      ssEmp = Math.round(ssBase * EE());
      ssEr = Math.round(ssBase * ER());
      taxable = gross - ssEmp;
      pit = pitOn(taxable);
    }
    const net = gross - ssEmp - pit - c.other;
    const cost = gross + ssEr;
    return {
      uid: person.id, name: person.name, role: person.role,
      base: c.base, allowances: c.allowances, ot: c.ot, bonus: c.bonus,
      gross, ssBase, ssEmp, ssEr, taxable, pit, other: c.other, net, cost,
      reconciles: (net + ssEmp + ssEr + pit + c.other) === cost
    };
  }

  // BO-4 — aggregate a tenant's roster into a run snapshot
  function computeRun(tenantId, period, level) {
    const tid = tenantId || DATA.state.tenantId;
    const lvl = level || (DATA.byId(tid) || {}).level || "L1";
    const slips = DATA.people(tid).map(p => {
      const a = getAdj(tid, p.id);
      const pp = (a.allowance || a.ot || a.misc) ? Object.assign({}, p, { allowances: (p.allowances || 0) + a.allowance, ot: (p.ot || 0) + a.ot, bonus: (p.bonus || 0) + a.misc }) : p;
      const s = computeSlip(pp, lvl); s.remarks = a.remarks || ""; return s;
    });
    const totals = slips.reduce((t, s) => {
      t.gross += s.gross; t.ssEmp += s.ssEmp; t.ssEr += s.ssEr;
      t.pit += s.pit; t.net += s.net; t.cost += s.cost; return t;
    }, { gross: 0, ssEmp: 0, ssEr: 0, pit: 0, net: 0, cost: 0 });
    totals.headcount = slips.length;
    return { period: period || "June 2026", level: lvl, slips, totals };
  }

  // BO-17 earned-to-date + BO-20 earned-wage access (EWA)
  const advances = []; // { id, uid, tid, who, amount, status[requested|approved|paid|rejected] }
  function earnedToDate(person, level) {
    const s = computeSlip(person, level || (DATA.byId(DATA.state.tenantId) || {}).level || "L2");
    const dw = person.daysWorked || 11, wd = 26, frac = dw / wd;
    return { daysWorked: dw, workdays: wd, etdGross: Math.round(s.gross * frac), etdNet: Math.round(s.net * frac), cap: Math.round(s.net * frac * 0.5) };
  }
  const getAdvances = (tid) => tid ? advances.filter(a => a.tid === tid) : advances.slice();
  function pendingRecovery(uid) { return advances.filter(a => a.uid === uid && a.status === "paid").reduce((s, a) => s + a.amount, 0); }
  function ewaRequest(tid, uid, amount) {
    const person = (DATA.people(tid) || []).find(p => p.id === uid) || DATA.me();
    const cap = earnedToDate(person).cap;
    if (!amount || amount <= 0) return { ok: false, err: "Enter an amount in ₭." };
    if (amount > cap) return { ok: false, err: "Over cap — max " + cap.toLocaleString() + " (≤ 50% of earned-to-date)." };
    const a = { id: "EWA-" + Date.now(), uid, tid, who: person.name, amount, status: "requested" };
    advances.unshift(a);
    DATA.AUDIT.unshift({ fact: "pay.advance_requested", who: person.name, when: "2026-06-15", ref: uid + " · " + amount });
    return { ok: true, a };
  }
  function ewaDecide(id, action) {
    const a = advances.find(x => x.id === id); if (!a) return;
    a.status = action === "payout" ? "paid" : action === "approve" ? "approved" : "rejected";
    DATA.AUDIT.unshift({ fact: "pay.advance_" + a.status, who: "Owner", when: "2026-06-15", ref: id });
    return a;
  }

  // run prep: per-person adjustments (allowance / OT / misc / remarks) → draft → commit (scheduled pay run)
  const _adj = {}, _pending = {}, _draftAt = {};
  function getAdj(tid, uid) { return (_adj[tid] && _adj[tid][uid]) || { allowance: 0, ot: 0, misc: 0, remarks: "" }; }
  function setAdj(tid, uid, obj) { _adj[tid] = _adj[tid] || {}; _adj[tid][uid] = Object.assign(getAdj(tid, uid), obj); }
  function hasAdj(tid, uid) { const a = getAdj(tid, uid); return !!(a.allowance || a.ot || a.misc || a.remarks); }
  function markDraftSaved(tid) { _draftAt[tid] = "2026-06-15 16:55"; DATA.AUDIT.unshift({ fact: "pay.draft_saved", who: "Owner", when: "2026-06-15", ref: (DATA.byId(tid) || {}).name || tid }); }
  const draftSavedAt = (tid) => _draftAt[tid] || null;
  const pendingPRs = (tid) => _pending[tid] || [];
  function commitDraft(tid, distributeAt) {
    const run = computeRun(tid);
    const pr = { runId: "PR-2026-06-C" + (pendingPRs(tid).length + 1), period: run.period, people: run.totals.headcount, cost: run.totals.cost, state: "scheduled", distributeAt: distributeAt || "2026-06-25 09:00" };
    _pending[tid] = _pending[tid] || []; _pending[tid].unshift(pr);
    DATA.AUDIT.unshift({ fact: "payroll.committed", who: "Owner", when: "2026-06-15", ref: pr.runId + " · distribute " + pr.distributeAt });
    return pr;
  }

  // BO-5 — lifecycle state machine (one current run per tenant)
  const runs = {};
  function getRun(tid) {
    tid = tid || DATA.state.tenantId;
    let r = runs[tid];
    if (!r) r = runs[tid] = { id: "PR-2026-06", stateIdx: 0, posted: false, adj: 0, history: [] };
    if (r.stateIdx === 0) { // draft re-snapshots live (reflects roster + current level)
      const c = computeRun(tid, "June 2026", DATA.byId(tid).level);
      r.period = c.period; r.level = c.level; r.totals = c.totals; r.slips = c.slips;
    }
    r.state = STATES[r.stateIdx];
    r.immutable = r.state === "close";
    return r;
  }
  function advance(tid) {
    tid = tid || DATA.state.tenantId;
    const r = getRun(tid);
    if (r.stateIdx < STATES.length - 1) {
      r.stateIdx++; r.state = STATES[r.stateIdx];
      r.history.push({ to: r.state, at: "2026-06-15" });
      if (r.state === "close") onClose(tid, r);
    }
    return r;
  }
  function oneClick(tid) {
    tid = tid || DATA.state.tenantId;
    const r = getRun(tid);
    r.stateIdx = STATES.length - 1; r.state = "close";
    r.history.push({ to: "close (one-tap)", at: "2026-06-15" });
    onClose(tid, r);
    return r;
  }
  function onClose(tid, r) {
    if (r.posted) return;
    r.posted = true;
    if (window.LEDGER) LEDGER.postFromRun(tid, r);
    DATA.AUDIT.unshift({ fact: "payroll.closed", who: "Somchai P.", when: "2026-06-15 16:40", ref: r.id });
  }
  function adjust(tid) { // correction: never edits the closed run — opens a new draft referencing it
    tid = tid || DATA.state.tenantId;
    const r = runs[tid];
    if (r) { r.stateIdx = 0; r.posted = false; r.adj++; r.id = "PR-2026-06-ADJ" + r.adj; DATA.AUDIT.unshift({ fact: "payroll.adjusted", who: "Somchai P.", when: "2026-06-15 16:45", ref: r.id }); }
    return getRun(tid);
  }
  function stateMeta(r) { return { steps: STATES, idx: r.stateIdx, state: r.state, immutable: r.immutable }; }
  function __reset() { for (const k in runs) delete runs[k]; advances.length = 0; [_adj, _pending, _draftAt].forEach(o => { for (const k in o) delete o[k]; }); }

  return { pitOn, comp, computeSlip, computeRun, getRun, advance, oneClick, adjust, stateMeta, STATES, CAP, EE, ER, earnedToDate, getAdvances, pendingRecovery, ewaRequest, ewaDecide, getAdj, setAdj, hasAdj, markDraftSaved, draftSavedAt, commitDraft, pendingPRs, __reset };
})();
