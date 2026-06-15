/* ============================================================
   ADEPTIO · smoke test (node, no deps) — v2.4.1.smbowner
   Loads the plain scripts in a stubbed window, then:
   · asserts the 3 personas + demo accounts + portal frames
   · reconciles the Lao payroll vector to the kip
   · RENDERS every web + mobile screen and fails on errors,
     empty bodies, or stray "undefined" (catches missing data)
   Run:  node tools/smoke.js
   ============================================================ */
const fs = require("fs"), vm = require("vm"), path = require("path");
const root = path.join(__dirname, "..");

// minimal browser stubs (we never load app.js — no DOM render needed)
global.window = global;
global.document = { getElementById: () => ({}), addEventListener() {}, body: { dataset: {} }, querySelector: () => null, createElement: () => ({ classList: { add() {} }, appendChild() {} } ) };
global.location = { hash: "" };
global.addEventListener = () => {};

const files = [
  "js/i18n.js", "js/ui.js", "js/data.js", "js/engine/tax.js", "js/engine/payroll.js", "js/engine/ledger.js", "js/engine/reports.js", "js/engine/flags.js", "js/engine/approvals.js", "js/engine/dbops.js", "js/engine/work.js", "js/auth.js",
  "js/screens/staff.js", "js/screens/owner.js", "js/screens/platform.js",
  "js/personas.js", "js/screens/authviews.js"
];
files.forEach(f => vm.runInThisContext(fs.readFileSync(path.join(root, f), "utf8"), { filename: f }));

let fails = 0, pass = 0;
const ok = (c, m) => { if (c) { pass++; } else { fails++; console.log("  ✗ " + m); } };
const section = (s) => console.log("\n" + s);

/* ---- personas ---- */
section("Personas & registry");
["staff", "owner", "platform"].forEach(k => ok(!!PERSONAS[k], "persona present: " + k));
ok(PERSONA_ORDER.length === 3, "3 personas in order");
ok(PERSONAS.owner.twoTier === true, "owner is two-tier");
ok(DATA.byId("phoungern").level === "L0" && DATA.byId("vientianemart").level === "L0", "default compliance level = L0");
ok(PERSONAS.owner.sections.length === 6, "owner has 6 sections");

/* ---- payroll vector (blueprint BO-4) ---- */
section("Payroll vector reconciles to the kip");
const s = DATA.PAYSLIP, SS = DATA.SS;
function pit(taxable) { let p = 0; for (const [lo, hi, rate] of DATA.PIT_BRACKETS) { if (taxable > lo) p += (Math.min(taxable, hi) - lo) * rate; } return Math.round(p); }
ok(Math.round(s.ssBase * SS.ee) === s.ssEmp, "employee NSSF 5.5% = " + s.ssEmp);
ok(Math.round(s.ssBase * SS.er) === s.ssEr, "employer NSSF 6% = " + s.ssEr);
ok(pit(s.taxable) === s.pit, "PIT on " + s.taxable + " = " + s.pit);
ok(s.net === s.gross - s.ssEmp - s.pit, "net = gross − NSSF − PIT = " + s.net);
ok(s.net + s.ssEmp + s.ssEr + s.pit === s.cost, "net + NSSF(ee+er) + PIT = cost (" + s.cost + ")");

/* ---- accounting rollup ties out ---- */
section("Monthly cost/benefit ties out");
const r = DATA.ROLLUP;
ok(r.revenue - r.staffCost - r.otherExp - r.channelFee === r.result, "rev − staff − other − channel = result (" + r.result + ")");

/* ---- auth & portal ---- */
section("Auth, portal & multi-tenant");
["staff", "owner", "platform"].forEach(k => ok(AUTH.accountsFor(k).length > 0, "demo account(s) for " + k));
ok(AUTH.signIn("owner@phoungern.la", "owner123").ok, "owner sign-in works");
ok(!AUTH.signIn("owner@phoungern.la", "nope").ok, "wrong password rejected");
ok(AUTH.primaryScope(["manager"]) === "owner", "manager rides owner shell");
const portal = AUTHV.portal();
ok((portal.match(/lp-frame/g) || []).length === 3, "login portal renders 3 persona frames");
ok(DATA.TENANTS.length === 3, "3 tenants seeded");
ok(DATA.pendingKyc().length >= 1, "pending KYC in queue");
DATA.setTenant("vientianemart"); ok(DATA.cur().id === "vientianemart" && DATA.people().length > 0, "tenant switch is scoped"); DATA.setTenant("phoungern");

/* ---- payroll ENGINE (BO-4/5/6) ---- */
section("Payroll engine — BO-4 calc");
PAYROLL.__reset(); LEDGER.__reset();
const es = PAYROLL.computeSlip({ id: "X", name: "Test", base: 6000000 }, "L1");
ok(es.ssEmp === 247500 && es.ssEr === 270000 && es.taxable === 5752500 && es.pit === 260250 && es.net === 5492250 && es.cost === 6270000, "engine vector exact (6,000,000 → net 5,492,250)");
ok(es.reconciles, "engine slip reconciles (net+NSSF+PIT=cost)");
const l0 = PAYROLL.computeSlip({ id: "X", base: 6000000 }, "L0");
ok(l0.ssEmp === 0 && l0.pit === 0 && l0.net === l0.gross && l0.cost === l0.gross, "L0 cash: statutory math off");
const cr = PAYROLL.computeRun("phoungern", "June 2026", "L2");
ok(cr.totals.headcount === 21, "run covers full roster (21)");
ok(cr.slips.every(s => s.reconciles), "every slip in the run reconciles");
ok(cr.totals.net + cr.totals.ssEmp + cr.totals.ssEr + cr.totals.pit === cr.totals.cost, "run totals reconcile to the kip");

section("Payroll engine — BO-5 lifecycle");
PAYROLL.__reset();
ok(PAYROLL.getRun("phoungern").state === "draft", "run starts in draft");
PAYROLL.advance("phoungern"); ok(PAYROLL.getRun("phoungern").state === "review", "advance → review");
PAYROLL.oneClick("phoungern");
const rc = PAYROLL.getRun("phoungern");
ok(rc.state === "close" && rc.immutable, "one-tap → closed & immutable");
const payLines = LEDGER.all("phoungern").filter(e => e.source === "payroll");
ok(payLines.length === 2 && payLines.every(e => e.locked), "close posts 2 LOCKED payroll lines to the cashbook");
ok(DATA.AUDIT.some(a => a.fact === "payroll.closed"), "close writes payroll.closed audit fact");

section("Cashbook + rollup — BO-6");
LEDGER.__reset();
ok(LEDGER.all("phoungern").filter(e => e.kind === "rev").reduce((s, e) => s + e.amount, 0) === 91000000, "phoungern cashbook seeds to 91,000,000 revenue");
const before = LEDGER.all("phoungern").length;
LEDGER.add("phoungern", { date: "2026-06-15", kind: "rev", cat: "Test sale", amount: 1000000, method: "cash", tax: "exempt" });
ok(LEDGER.all("phoungern").length === before + 1, "ledger add appends an entry");
ok(LEDGER.sums(LEDGER.ranged("phoungern", "month")).count > 0, "month range returns entries with sums");
const roll = LEDGER.rollup("phoungern");
ok(roll.revenue === LEDGER.all("phoungern").filter(e => e.kind === "rev").reduce((s, e) => s + e.amount, 0), "rollup revenue = Σ cashbook revenue (replay)");
ok(roll.staffCost === PAYROLL.computeRun("phoungern").totals.cost, "rollup staff cost = LIVE run cost (the payroll↔books linkage)");
ok(roll.revenue - roll.staffCost - roll.otherExp - roll.channelFee === roll.result, "rollup P&L ties out");
PAYROLL.__reset(); LEDGER.__reset();

/* ---- tax centre — BO-7 ---- */
section("Tax centre — BO-7");
TAX.__reset(); PAYROLL.__reset(); LEDGER.__reset();
const tcal = TAX.calendar("phoungern");
const tot7 = PAYROLL.computeRun("phoungern").totals;
ok(tcal.find(p => p.key === "pit-2026-06").amount === tot7.pit, "PIT period = run PIT");
ok(tcal.find(p => p.key === "nssf-2026-06").amount === tot7.ssEmp + tot7.ssEr, "NSSF period = ee + er");
const v7 = TAX.vatPeriod("phoungern");
ok(v7.payable === Math.round((v7.base.out - v7.base.in) * 0.10), "VAT = 10% × (output − input) from ledger");
ok(TAX.applicable("phoungern").some(a => a.key === "cit") && !TAX.applicable("phoungern").some(a => a.key === "pt"), "company → CIT, not Profit Tax");
ok(TAX.applicable("vientianemart").some(a => a.key === "pt") && !TAX.applicable("vientianemart").some(a => a.key === "cit"), "sole → Profit Tax, not CIT");
ok(TAX.calendar("vientianemart").some(p => p.type.indexOf("Profit Tax") === 0), "sole tenant calendar lists Profit Tax");
TAX.markFiled("phoungern", "pit-2026-06");
ok(TAX.calendar("phoungern").find(p => p.key === "pit-2026-06").status === "filed", "mark filed flips status");
ok(DATA.AUDIT.some(a => a.fact === "tax.filed"), "filing writes tax.filed audit fact");
const before7 = TAX.history().length;
TAX.setRate("vat", 0.07);
ok(TAX.history().length === before7 + 1 && TAX.current().vat === 0.07, "rate edit adds an effective row; current() updates");
// immutability — a closed run is frozen; later level change can't rewrite it
DATA.byId("phoungern").level = "L2";
PAYROLL.__reset(); PAYROLL.oneClick("phoungern");
const closedCost = PAYROLL.getRun("phoungern").totals.cost;
DATA.byId("phoungern").level = "L0";
ok(PAYROLL.getRun("phoungern").totals.cost === closedCost, "closed run frozen — level change doesn't rewrite it");
ok(PAYROLL.computeRun("phoungern").totals.cost !== closedCost, "a fresh L0 run differs (so the freeze matters)");
ok(TAX.calendar("phoungern").find(p => p.key === "vat-2026-q2").status === "locked", "VAT locked below L2");
DATA.byId("phoungern").level = "L0";
TAX.__reset(); PAYROLL.__reset(); LEDGER.__reset();

/* ---- dw_reports — BO-8 ---- */
section("dw_reports projector — BO-8");
TAX.__reset(); PAYROLL.__reset(); LEDGER.__reset();
const m8 = DW.monthly("phoungern");
const revL = LEDGER.all("phoungern").filter(e => e.kind === "rev").reduce((s, e) => s + e.amount, 0);
const expL = LEDGER.all("phoungern").filter(e => e.kind === "exp" && e.source !== "payroll").reduce((s, e) => s + e.amount, 0);
ok(m8.revenue === revL && revL === 91000000, "monthly revenue replays from cashbook (= 91,000,000)");
ok(m8.otherExp === expL && expL === 17300000, "other-exp = Σ cashbook non-payroll expense (= 17,300,000)");
ok(m8.staffCost === PAYROLL.computeRun("phoungern").totals.cost, "staff cost = payroll run cost (live)");
ok(m8.revenue - m8.staffCost - m8.otherExp - m8.channelFee === m8.result, "monthly result ties out (hand-calc)");
const s8 = DW.series("phoungern");
ok(s8.length === 6 && s8[5].live, "series spans 6 months, June live");
ok(s8[5].revenue === m8.revenue && s8[5].staffCost === m8.staffCost, "June series = live monthly");
DATA.byId("phoungern").level = "L0"; const beforeStaff = DW.monthly("phoungern").staffCost;
DATA.byId("phoungern").level = "L2";
ok(DW.monthly("phoungern").staffCost !== beforeStaff, "leveling changes staff cost in the rollup");
DATA.byId("phoungern").level = "L0";
PAYROLL.oneClick("phoungern");
ok(DW.monthly("phoungern").otherExp === expL, "posted payroll lines don't double-count as other-exp");
const wb = DW.workbook("phoungern");
ok(/Sheet: P&L-lite/.test(wb) && /Sheet: Revenue vs staff/.test(wb) && /Sheet: Margin/.test(wb) && /Sheet: Payroll register/.test(wb) && /Sheet: Cashbook/.test(wb), "workbook bundles all tabs");
TAX.__reset(); PAYROLL.__reset(); LEDGER.__reset();

/* ---- governance — BO-24 feature flags ---- */
section("Feature flags — BO-24");
FLAGS.__reset();
ok(FLAGS.on("phoungern", "scheduling") === true, "scheduling on by default");
ok(FLAGS.hiddenScreens("phoungern", "owner").has("advances"), "EWA off by default → Advances hidden");
FLAGS.set("phoungern", "scheduling", false, "owner");
ok(FLAGS.hiddenScreens("phoungern", "owner").has("scheduling"), "scheduling off → owner Scheduling hidden");
ok(FLAGS.hiddenScreens("phoungern", "staff").has("schedule"), "scheduling off → staff Schedule hidden");
ok(FLAGS.on("vientianemart", "scheduling") === true, "per-tenant: Vientiane scheduling still on");
ok(FLAGS.set("phoungern", "ewa", true, "manager").ok === false, "manager blocked from owner-only EWA flag");
ok(FLAGS.set("phoungern", "scheduling", true, "manager").ok === true, "manager may toggle an operational flag");
ok(DATA.AUDIT.some(a => a.fact === "flag.set"), "flag flip is audited");
FLAGS.__reset();

/* ---- governance — BO-26 approvals ---- */
section("Approval engine — BO-26");
APPROVALS.__reset();
const inboxN = APPROVALS.pending("phoungern");
ok(inboxN >= 5, "seeded approvals inbox");
ok(APPROVALS.inbox("phoungern").some(i => i.grade === "flag"), "a worker-protecting check is flagged, not blocked");
const apId = APPROVALS.inbox("phoungern")[0].id;
APPROVALS.decide("phoungern", apId, "approved", "ok");
ok(APPROVALS.pending("phoungern") === inboxN - 1, "decide removes the item from pending");
ok(DATA.AUDIT.some(a => a.fact.indexOf("approve.") === 0), "decision is audited");
const typesBefore = Object.keys(APPROVALS.TYPES).length;
APPROVALS.register({ key: "doc_ack", label: "Doc ack" });
ok(Object.keys(APPROVALS.TYPES).length === typesBefore + 1, "register adds a new approvable type by config (no new code)");
APPROVALS.__reset();

/* ---- governance — BO-25 db ops ---- */
section("Per-tenant DB ops — BO-25");
DBOPS.__reset();
const n0 = DBOPS.list("phoungern").length;
DBOPS.backup("phoungern", "now");
ok(DBOPS.list("phoungern").length === n0 + 1, "owner backup appends a snapshot");
const beforeOp = DBOPS.list("phoungern").length;
DBOPS.platformOp("phoungern", "reset", "test");
ok(DBOPS.list("phoungern").length === beforeOp + 1 && DBOPS.list("phoungern")[0].kind === "snapshot", "platform op auto-snapshots first");
ok(DATA.AUDIT.some(a => a.fact === "platform.db.reset"), "platform op audited (platform.db.reset)");
ok(DBOPS.list("vientianemart").length >= 1, "per-tenant isolation: B has its own backup lane");
DBOPS.__reset(); FLAGS.__reset(); APPROVALS.__reset();

/* ---- §W feature wave — BO-15..23 ---- */
section("Feature wave — BO-15..23");
FLAGS.__reset(); PAYROLL.__reset(); APPROVALS.__reset(); WORK.__reset();
const meP = DATA.people("phoungern").find(p => p.you);
const etd = PAYROLL.earnedToDate(meP);
ok(etd.cap === Math.round(etd.etdNet * 0.5), "BO-17 EWA cap = 50% of earned-to-date");
ok(etd.etdNet > 0 && etd.etdNet < PAYROLL.computeSlip(meP, "L2").net, "BO-17 earned-to-date is a fraction of full net");
ok(PAYROLL.ewaRequest("phoungern", meP.id, etd.cap + 1000000).ok === false, "BO-20 EWA over-cap rejected");
const okr = PAYROLL.ewaRequest("phoungern", meP.id, Math.round(etd.cap * 0.5));
ok(okr.ok === true, "BO-20 EWA within cap accepted");
PAYROLL.ewaDecide(okr.a.id, "payout");
ok(PAYROLL.pendingRecovery(meP.id) === okr.a.amount, "BO-20 paid advance → pending recovery");
const slipAfter = PAYROLL.computeSlip(meP, "L2");
ok(slipAfter.reconciles && slipAfter.other >= okr.a.amount, "BO-20 recovery deducts on next slip & still reconciles");
PAYROLL.__reset();
ok(WORK.isPublished("phoungern") === false, "BO-15 roster starts unpublished");
WORK.publish("phoungern"); ok(WORK.isPublished("phoungern") === true, "BO-15 publish marks roster published");
const ap0 = APPROVALS.pending("phoungern");
WORK.swap("phoungern", "A→B", false); ok(APPROVALS.pending("phoungern") === ap0 + 1, "BO-16 swap creates an approval");
ok(WORK.swap("phoungern", "C→D breaks OT", true).grade === "flag", "BO-16 OT-breaking swap is flagged, not blocked");
const ob0 = DATA.OUTBOX.length;
WORK.paydayAlert("phoungern", { period: "June 2026" }); WORK.taxNudge("phoungern", "pit-2026-06");
ok(DATA.OUTBOX.length === ob0 + 2, "BO-19/22 payday alert + tax nudge queued to outbox");
ok(DATA.AUDIT.some(a => a.fact === "comms.sent"), "BO-19/22 alert/nudge audited as comms.sent");
FLAGS.set("phoungern", "labourcost", false, "owner");
ok(FLAGS.on("phoungern", "labourcost") === false, "BO-23 labour-cost tile is flag-gated");
FLAGS.__reset(); PAYROLL.__reset(); APPROVALS.__reset(); WORK.__reset();

/* ---- run prep: adjustments · draft · commit (per-person preview) ---- */
section("Run prep — adjustments · draft · commit");
PAYROLL.__reset();
const rp = DATA.people("phoungern").find(p => p.you);
const baseGross = PAYROLL.computeRun("phoungern").totals.gross;
PAYROLL.setAdj("phoungern", rp.id, { allowance: 500000, ot: 0, misc: 0, remarks: "shift bonus" });
ok(PAYROLL.getAdj("phoungern", rp.id).allowance === 500000, "setAdj/getAdj roundtrip");
ok(PAYROLL.hasAdj("phoungern", rp.id) === true, "hasAdj true after edit");
ok(PAYROLL.computeRun("phoungern").totals.gross === baseGross + 500000, "adjustment folds into run gross");
PAYROLL.markDraftSaved("phoungern");
ok(!!PAYROLL.draftSavedAt("phoungern"), "draft marked auto-saved (timestamp)");
ok(DATA.AUDIT.some(a => a.fact === "pay.draft_saved"), "draft save audited");
const pr = PAYROLL.commitDraft("phoungern", "2026-06-26 10:00");
ok(pr.runId && pr.period && pr.people === 21 && pr.cost > 0 && pr.state === "scheduled" && pr.distributeAt === "2026-06-26 10:00", "commit → pending PR has run-id/period/people/cost/state/distribute");
ok(PAYROLL.pendingPRs("phoungern").length === 1, "pending PR listed");
ok(DATA.AUDIT.some(a => a.fact === "payroll.committed"), "commit audited (payroll.committed)");
PAYROLL.__reset();

/* ---- render every screen ---- */
section("Every screen renders (no errors · non-empty · no stray 'undefined')");
function ids(P) {
  if (P.twoTier) { const a = []; P.sections.forEach(sec => sec.solo ? a.push(sec.id) : sec.sub.forEach(it => a.push(it.id))); return a; }
  return P.nav.flatMap(g => g.items.map(it => it.id));
}
["staff", "owner", "platform"].forEach(k => {
  const P = PERSONAS[k];
  ids(P).forEach(id => {
    ok(typeof P.web[id] === "function", "[" + k + "] web fn: " + id);
    try { const d = P.web[id](); const b = (d && d.body) || ""; ok(d && d.title && b.length > 40 && !/undefined|NaN|\[object|\.\d{6,}/.test(b), "[" + k + "] web renders clean: " + id); }
    catch (e) { ok(false, "[" + k + "] web ERROR " + id + ": " + e.message); }
  });
  // mobile screens that must exist: every tab, plus tabParent ids that are real mobile screens
  const mids = P.tabs.map(t => t.id).concat(Object.keys(P.tabParent || {}).filter(id => typeof P.mobile[id] === "function"));
  mids.forEach(id => {
    ok(typeof P.mobile[id] === "function", "[" + k + "] mobile fn: " + id);
    try { const d = P.mobile[id](); const b = (d && d.body) || ""; ok(d && d.title && b.length > 20 && !/undefined|NaN|\[object|\.\d{6,}/.test(b), "[" + k + "] mobile renders clean: " + id); }
    catch (e) { ok(false, "[" + k + "] mobile ERROR " + id + ": " + e.message); }
  });
});

console.log("\n" + (fails ? "✗ " + fails + " failed, " : "✓ ") + pass + " passed.");
process.exit(fails ? 1 : 0);
