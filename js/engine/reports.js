/* ============================================================
   ADEPTIO · dw_reports projector — BO-8
   DERIVED reporting layer: rebuilds the cost/benefit picture by
   replay from the operational stores — revenue + other-expense
   from the cashbook (LEDGER), staff cost from payroll (PAYROLL).
   Nothing here is a source of truth; it can be rebuilt any time.
   ============================================================ */
window.DW = (function () {
  // canonical month rollup (the BO-8 formula) — current live month
  function monthly(tid) {
    tid = tid || DATA.state.tenantId;
    const r = LEDGER.rollup(tid);
    r.headcount = PAYROLL.computeRun(tid).totals.headcount;
    return r;
  }

  // 6-month series — past months derived from the live month by a ramp; June = live exact.
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
  const RAMP = [0.86, 0.90, 0.94, 0.97, 0.99, 1.00];
  function series(tid) {
    tid = tid || DATA.state.tenantId;
    const cur = monthly(tid);
    return MONTHS.map((m, i) => {
      const f = RAMP[i];
      const revenue = Math.round(cur.revenue * f);
      const staffCost = Math.round(cur.staffCost * f);
      const otherExp = Math.round(cur.otherExp * f);
      const result = revenue - staffCost - otherExp - cur.channelFee;
      return {
        month: m, revenue, staffCost, otherExp, result,
        margin: revenue ? result / revenue : 0,
        costPerHead: cur.headcount ? Math.round(staffCost / cur.headcount) : 0,
        live: i === MONTHS.length - 1
      };
    });
  }

  // one workbook — a tab (CSV section) per report
  function workbook(tid) {
    tid = tid || DATA.state.tenantId;
    const t = DATA.byId(tid), cur = monthly(tid), ser = series(tid), run = PAYROLL.computeRun(tid);
    const S = (a) => a.map(r => r.map(c => /[",\n]/.test(String(c)) ? '"' + String(c).replace(/"/g, '""') + '"' : c).join(",")).join("\n");
    const out = [];
    out.push("# " + t.name + " — Adeptio workbook (" + run.period + ", level " + run.level + ")");
    out.push("\n=== Sheet: P&L-lite ===\n" + S([
      ["Line", "LAK"], ["Revenue", cur.revenue], ["Staff cost", -cur.staffCost],
      ["Other expenses", -cur.otherExp], ["Channel fees", -cur.channelFee], ["Operating result", cur.result],
      ["Margin %", Math.round(cur.margin * 100)], ["Staff / revenue %", Math.round(cur.staffRatio * 100)], ["Cost per head", cur.costPerHead]
    ]));
    out.push("\n=== Sheet: Revenue vs staff cost (6 mo) ===\n" + S(
      [["Month", "Revenue", "StaffCost", "OtherExp", "Result"]].concat(ser.map(s => [s.month, s.revenue, s.staffCost, s.otherExp, s.result]))));
    out.push("\n=== Sheet: Margin & cost-per-head ===\n" + S(
      [["Month", "Margin%", "CostPerHead"]].concat(ser.map(s => [s.month, Math.round(s.margin * 100), s.costPerHead]))));
    out.push("\n=== Sheet: Payroll register ===\n" + S(
      [["Employee", "Role", "Gross", "NSSF_ee", "NSSF_er", "Taxable", "PIT", "Net", "Cost"]]
        .concat(run.slips.map(s => [s.name, s.role, s.gross, s.ssEmp, s.ssEr, s.taxable, s.pit, s.net, s.cost]))
        .concat([["TOTAL", "", run.totals.gross, run.totals.ssEmp, run.totals.ssEr, "", run.totals.pit, run.totals.net, run.totals.cost]])));
    out.push("\n=== Sheet: Cashbook ===\n" + LEDGER.toCSV(tid));
    return out.join("\n");
  }

  return { monthly, series, workbook };
})();
