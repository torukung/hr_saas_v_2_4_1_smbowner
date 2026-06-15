/* ============================================================
   ADEPTIO · tax engine — BO-7
   Effective-dated tables (db_tax) seeded from DATA. Computes
   PIT + NSSF (from the payroll run), VAT (output − input from the
   ledger), Profit Tax (sole) or CIT (company) + dividend WHT.
   Entity-aware + leveling-gated calendar with mark-filed.
   Editing a rate adds a NEW effective row — closed runs keep theirs.
   ============================================================ */
window.TAX = (function () {
  const TODAY = "2026-06-15";
  const pct = x => +(x * 100).toFixed(2); // avoid float artifacts (0.07*100 = 7.0000…01)

  // newest-last; current() = latest effective on/before TODAY
  const tables = [{
    from: "2020-01-01",
    ss: { ee: DATA.SS.ee, er: DATA.SS.er, cap: DATA.SS.cap },
    pit: DATA.PIT_BRACKETS.map(b => b.slice()),
    vat: 0.10,
    pt: { production: 0.01, commerce: 0.02, services: 0.03 },
    cit: 0.20,
    dividend: 0.10
  }];

  function current() { let cur = tables[0]; for (const t of tables) if (t.from <= TODAY) cur = t; return cur; }
  function history() { return tables.slice(); }
  function setRate(path, value) {
    const next = JSON.parse(JSON.stringify(current())); next.from = TODAY;
    if (path === "vat") next.vat = value;
    else if (path === "cit") next.cit = value;
    else if (path.indexOf("pt.") === 0) next.pt[path.slice(3)] = value;
    tables.push(next);
    DATA.AUDIT.unshift({ fact: "tax.table_edited", who: "Owner", when: TODAY, ref: path + " = " + pct(value) + "%" });
    return next;
  }

  /* ---- period computations ---- */
  const pitPeriod = (tid) => PAYROLL.computeRun(tid).totals.pit;
  function nssfPeriod(tid) { const t = PAYROLL.computeRun(tid).totals; return t.ssEmp + t.ssEr; }
  function vatPeriod(tid) {
    const list = LEDGER.all(tid), rate = current().vat;
    const out = list.filter(e => e.tax === "vat_out").reduce((s, e) => s + e.amount, 0);
    const inp = list.filter(e => e.tax === "vat_in").reduce((s, e) => s + e.amount, 0);
    return { base: { out, in: inp }, out: Math.round(out * rate), in: Math.round(inp * rate), payable: Math.round((out - inp) * rate), rate };
  }
  function profitTaxPeriod(tid) {
    const t = DATA.byId(tid), biz = t.biz || "services", rate = current().pt[biz];
    return { biz, rate, monthly: Math.round((t.month ? t.month.revenue : 0) * rate), annual: Math.round((t.month ? t.month.revenue : 0) * 12 * rate) };
  }
  function citPeriod(tid) {
    const rate = current().cit, annualProfit = Math.max(0, LEDGER.rollup(tid).result * 12);
    return { rate, base: annualProfit, annual: Math.round(annualProfit * rate) };
  }

  /* ---- entity-aware applicable taxes ---- */
  function applicable(tid) {
    const t = DATA.byId(tid);
    const rows = [
      { key: "pit", name: "PIT (withholding)", basis: "Salary after NSSF", rate: "0–25%", minLevel: "L1" },
      { key: "nssf", name: "NSSF", basis: "Earnings to ₭4.5M cap", rate: "6% + 5.5%", minLevel: "L1" },
      { key: "vat", name: "VAT", basis: "Output − input", rate: pct(current().vat) + "%", minLevel: "L2" }
    ];
    if (t.entity === "sole") rows.push({ key: "pt", name: "Profit Tax (sole)", basis: "Gross revenue · " + (t.biz || "services"), rate: "1 / 2 / 3%", minLevel: "L3" });
    else {
      rows.push({ key: "cit", name: "CIT (company)", basis: "Net profit", rate: pct(current().cit) + "%", minLevel: "L3" });
      rows.push({ key: "div", name: "Dividend WHT", basis: "Distributions", rate: pct(current().dividend) + "%", minLevel: "L3" });
    }
    return rows;
  }

  /* ---- calendar (computed + status) + mark-filed ---- */
  const filed = {};
  function calendar(tid) {
    const t = DATA.byId(tid), lvl = t.level, F = filed[tid] || (filed[tid] = {});
    const items = [
      { key: "pit-2026-06", type: "PIT withholding", basis: "Employee salary after NSSF", due: "2026-06-20", amount: pitPeriod(tid), need: lvl >= "L1", cadence: "monthly" },
      { key: "nssf-2026-06", type: "NSSF contribution", basis: "Earnings to ₭4.5M cap", due: "2026-06-20", amount: nssfPeriod(tid), need: lvl >= "L1", cadence: "monthly" },
      { key: "vat-2026-q2", type: "VAT return", basis: "Output − input VAT", due: "2026-07-15", amount: vatPeriod(tid).payable, need: lvl >= "L2", cadence: "quarterly" }
    ];
    if (t.entity === "sole") items.push({ key: "pt-2026", type: "Profit Tax (sole)", basis: "Gross revenue (annual)", due: "2027-03-31", amount: profitTaxPeriod(tid).annual, need: lvl >= "L3", cadence: "annual" });
    else items.push({ key: "cit-2026", type: "CIT (company)", basis: "Net profit (annual est.)", due: "2027-03-31", amount: citPeriod(tid).annual, need: lvl >= "L3", cadence: "annual" });
    return items.map(i => ({ ...i, status: F[i.key] ? "filed" : (i.need ? "due" : "locked") }));
  }
  function markFiled(tid, key) { (filed[tid] || (filed[tid] = {}))[key] = true; DATA.AUDIT.unshift({ fact: "tax.filed", who: "Owner", when: TODAY, ref: key }); }
  const isFiled = (tid, key) => !!(filed[tid] && filed[tid][key]);
  function __reset() { tables.length = 1; for (const k in filed) delete filed[k]; }

  return { current, history, setRate, pitPeriod, nssfPeriod, vatPeriod, profitTaxPeriod, citPeriod, applicable, calendar, markFiled, isFiled, TODAY, __reset };
})();
