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
  "js/i18n.js", "js/ui.js", "js/data.js", "js/engine/tax.js", "js/engine/payroll.js", "js/engine/ledger.js", "js/engine/reports.js", "js/engine/flags.js", "js/engine/approvals.js", "js/engine/dbops.js", "js/engine/work.js", "js/engine/registration.js", "js/engine/profile.js", "js/engine/calendar.js", "js/engine/schedule.js", "js/engine/comms.js", "js/engine/staffdash.js", "js/auth.js",
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
ok(PERSONAS.owner.sections.length === 5, "owner has 5 sections (dashboard folded into Staff Manager)");

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
ok(cr.totals.headcount === DATA.people("phoungern").length && cr.totals.headcount === 14, "run covers full roster (14 = seat allocation)");
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
ok(pr.runId && pr.period && pr.people === 14 && pr.cost > 0 && pr.state === "scheduled" && pr.distributeAt === "2026-06-26 10:00", "commit → pending PR has run-id/period/people/cost/state/distribute");
ok(PAYROLL.pendingPRs("phoungern").length === 1, "pending PR listed");
ok(DATA.AUDIT.some(a => a.fact === "payroll.committed"), "commit audited (payroll.committed)");
PAYROLL.__reset();

/* ---- registration + KYC — REG engine ---- */
section("Registration + KYC — REG engine");
REG.__reset();
ok(REG.counts().pending >= 2, "seeded pending registrations");
ok(REG.all().some(r => r.id === "REG-0468" && r.status === "disabled"), "expired pending auto-disabled (on)");
const nr = REG.submit({ company: "Test Shop", owner: "Test Owner", email: "t@test.la", phone: "+856", lang: "lo", entity: "sole", biz: "services" });
ok(REG.get(nr.id).status === "pending", "submit → pending registration");
ok(DATA.AUDIT.some(a => a.fact === "kyc.registered"), "submit audited (kyc.registered)");
const obR = DATA.OUTBOX.length;
REG.activate(nr.id);
ok(REG.get(nr.id).status === "active", "activate → active");
ok(DATA.OUTBOX.length === obR + 1, "activate emails a set-password link (outbox)");
ok(DATA.AUDIT.some(a => a.fact === "kyc.activated") && DATA.AUDIT.some(a => a.fact === "auth.invite"), "activate audits kyc.activated + auth.invite");
const pidR = REG.pending()[0].id, npR = REG.pending().length;
REG.reject(pidR, "bad"); ok(REG.get(pidR).status === "rejected" && REG.pending().length === npR - 1, "reject removes from pending");
REG.__reset(); REG.setAutoDisable(false);
ok(REG.get("REG-0468").status === "pending", "auto-disable OFF → stale stays pending");
REG.setAutoDisable(true); REG.setChannel({ host: "smtp.gmail.com", from: "noreply@adeptio.la" });
ok(REG.getChannel().host === "smtp.gmail.com" && REG.getChannel().status === "connected", "channel save updates host + status");
ok(DATA.pendingKyc().length === REG.pending().length, "DATA.pendingKyc delegates to REG");
// register page — KYC ON variant: full design with ID/selfie dropzones + sections
REG.__reset(); REG.setKyc(true);
const regKyc = AUTHV.registerPage();
ok(/Create your account/.test(regKyc) && /Business details/.test(regKyc) && /Identity verification/.test(regKyc), "register (KYC on): Business · Owner · Identity sections");
ok(/data-reg="company"/.test(regKyc) && /data-reg="email2"/.test(regKyc) && /data-regfile="id"/.test(regKyc) && /data-regfile="selfie"/.test(regKyc) && /register:submit/.test(regKyc), "register (KYC on): fields + ID/selfie dropzones wired");
ok(/Register your shop/.test(regKyc) && /Plus Jakarta Sans/.test(regKyc), "register: indigo brand rail + design font");
ok(/pending review/.test(AUTHV.registerPage(true)), "register (KYC on) done = pending review");
ok(/ID card photo/.test(AUTHV.dropInner("id")) && /Owner selfie/.test(AUTHV.dropInner("selfie")), "dropInner placeholders");
AUTHV.state.reg.idUrl = "blob:test"; AUTHV.state.reg.idName = "id.jpg";
ok(/blob:test/.test(AUTHV.dropInner("id")) && /id\.jpg/.test(AUTHV.dropInner("id")), "dropInner shows preview + filename once uploaded");
AUTHV.state.reg.idUrl = null; AUTHV.state.reg.idName = null;
// register page — KYC OFF variant: no-KYC (no ID/selfie), instant access
REG.setKyc(false);
const regNo = AUTHV.registerPage();
ok(/Create your account/.test(regNo) && !/Identity verification/.test(regNo) && !/data-regfile=/.test(regNo), "register (KYC off): no-KYC variant — no ID/selfie");
ok(/data-reg="company"/.test(regNo) && /register:submit/.test(regNo) && /email is your username/.test(regNo), "register (KYC off): submits + 'email is your username' copy");
ok(/Account created/.test(AUTHV.registerPage(true)) && /username is your email/.test(AUTHV.registerPage(true)), "register (KYC off) done = account created + access link");
// no-KYC instant registration → active + emailed access link (email = username, random password)
REG.__reset();
const inst = REG.registerInstant({ company: "Quick Shop", owner: "Q Owner", email: "q@quick.la", phone: "+856", lang: "lo", entity: "sole", biz: "services" });
ok(inst.status === "active" && inst.noKyc === true && typeof inst.tempPwd === "string" && inst.tempPwd.length >= 8, "no-KYC register → instant active + random temp password");
ok(DATA.OUTBOX.some(o => o.to === "q@quick.la" && /access link|username/i.test(o.tpl)) && DATA.AUDIT.some(a => a.fact === "registration.instant"), "no-KYC register emails the access link (username = email)");
// KYC master feature flag — default OFF, gates the platform nav + overview
REG.__reset();
ok(REG.kycOn() === false, "KYC feature defaults OFF");
const regNav = PERSONAS.platform.nav[0].items.find(i => i.id === "registrations");
ok(typeof regNav.when === "function" && regNav.when() === false, "platform KYC nav item gated by REG.kycOn (hidden when off)");
ok(/kyc-master off/.test(SCR_PLATFORM.web.overview().body) && /data-act="kyc:feature:on"/.test(SCR_PLATFORM.web.overview().body) && /Registration disabled/.test(SCR_PLATFORM.web.overview().body), "overview shows the master toggle (off) + hides the KYC queue");
REG.setKyc(true);
ok(REG.kycOn() === true && regNav.when() === true, "setKyc(true) enables the feature + reveals the nav item");
ok(/kyc-master on/.test(SCR_PLATFORM.web.overview().body) && /data-act="kyc:feature:off"/.test(SCR_PLATFORM.web.overview().body) && /KYC queue/.test(SCR_PLATFORM.web.overview().body), "overview (on) shows KYC queue + toggle-off");
ok(DATA.AUDIT.some(a => a.fact === "platform.kyc_on"), "KYC enable is audited");
REG.__reset();

/* ---- people profile — PROFILE engine ---- */
section("People profile — PROFILE engine");
PROFILE.__reset();
const pid2 = DATA.me().id;
const pr2 = PROFILE.get(pid2);
ok(pr2.empId === pid2 && !!pr2.position && !!pr2.department, "profile merges base from the person record");
PROFILE.set(pid2, { mobile: "+856 20 555 0000", emgName: "Test Kin" });
ok(PROFILE.get(pid2).mobile === "+856 20 555 0000" && PROFILE.get(pid2).emgName === "Test Kin", "set persists overrides");
ok(DATA.AUDIT.some(a => a.fact === "people.updated"), "edit audited (people.updated)");
ok(Object.keys(PROFILE.SCHEMA).length >= 3, "schema has general/personal/job sections");
ok(SCR_OWNER.web.people().body.indexOf("people-profile/") > -1, "roster rows link to the profile");
["general", "personal", "job", "time", "compensation", "documents"].forEach(s => {
  const d = SCR_OWNER.web["people-profile"](pid2 + "/" + s);
  ok(d && d.body && d.body.length > 80 && !/undefined|NaN|\[object|\.\d{6,}/.test(d.body), "profile section renders clean: " + s);
});
ok(SCR_OWNER.web["people-profile"](pid2 + "/personal").body.indexOf("profile:edit:") > -1, "personal section has Edit affordance");
PROFILE.setEditing(pid2 + ":personal");
ok(SCR_OWNER.web["people-profile"](pid2 + "/personal").body.indexOf("data-pf=") > -1, "edit mode renders inputs");
PROFILE.__reset();

/* ---- calendar — CAL engine (leave · team absence · holidays) ---- */
section("Calendar — CAL engine (leave · team absence · holidays)");
DATA.setTenant("phoungern"); CAL.__reset();
ok(CAL.LEAVE_TYPES.length >= 6 && CAL.leaveType("sick").tone === "sick", "leave catalogue present (sick tone)");
ok(!!CAL.holidayOn("2026-06-01"), "seeded Lao holiday on 1 Jun");
const hN = CAL.HOLIDAYS.length;
ok(CAL.addHoliday("2026-06-20", "Boun Test").ok && !!CAL.holidayOn("2026-06-20") && CAL.HOLIDAYS.length === hN + 1, "addHoliday adds + findable");
ok(!CAL.addHoliday("2026-06-20", "dup").ok, "duplicate holiday rejected");
ok(DATA.AUDIT.some(a => a.fact === "holiday.added"), "holiday.added audited");
CAL.state.y = 2026; CAL.state.m = 5;
CAL.nav("next"); ok(CAL.state.m === 6, "nav next → July");
CAL.nav("prev"); ok(CAL.state.m === 5, "nav prev → June");
const meCal = DATA.me(), lvN = DATA.LEAVE_REQS.length, apN = APPROVALS.pending("phoungern");
CAL.openLeave(true); CAL.clearSel(); CAL.toggleDay(17); CAL.toggleDay(18);
ok(CAL.selected().length === 2, "two days selected");
const rl = CAL.requestLeave(meCal.id, "annual", CAL.selected(), "trip");
ok(rl.ok && rl.rec.days === 2 && rl.rec.from === "2026-06-17" && rl.rec.to === "2026-06-18", "requestLeave builds record (from/to/days)");
ok(DATA.LEAVE_REQS.length === lvN + 1 && DATA.LEAVE_REQS[0].status === "pending", "request added as pending");
ok(APPROVALS.pending("phoungern") === apN + 1, "request lands in approvals");
ok(DATA.AUDIT.some(a => a.fact === "leave.requested"), "leave.requested audited");
ok(!CAL.requestLeave(meCal.id, "annual", [], "").ok, "empty selection rejected");
const tmS = CAL.teamMonth("phoungern", 2026, 5);
ok(tmS.rows.length === DATA.people("phoungern").length && tmS.days.length === 30, "teamMonth: row per person × 30 days");
ok(tmS.rows.every(r => r.cells.length === 30), "every row has a cell per day");
const kinds = new Set(); tmS.rows.forEach(r => r.cells.forEach(c => kinds.add(c.k)));
ok(kinds.has("off") && kinds.has("work") && (kinds.has("leave") || kinds.has("sick")) && kinds.has("holiday"), "cells cover off/work/leave/holiday kinds");
ok(/leave:pick:/.test(CAL.monthPicker()) && !/undefined|NaN|\[object/.test(CAL.monthPicker()), "month picker renders clean + interactive");
ok(/tcal-c/.test(CAL.teamGrid("phoungern")) && !/undefined|NaN|\[object/.test(CAL.teamGrid("phoungern")), "team grid renders clean");
const oc = SCR_OWNER.web.calendar();
ok(oc.title.indexOf("Team Absence") > -1 && /cal:addholiday/.test(oc.body) && /tcal/.test(oc.body), "owner calendar screen: grid + add-holiday");
// day-summary popup — click a date → on shift · on leave · callable
CAL.__reset();
ok(/data-act="cal:day:2026-06-16"/.test(CAL.teamGrid("phoungern")), "team grid date columns are clickable (cal:day:<iso>)");
const dsW = CAL.daySummary("phoungern", "2026-06-16");
ok(dsW.onShift.length + dsW.away.length + dsW.callable.length === DATA.people("phoungern").length, "daySummary buckets cover everyone (on shift + leave + callable = headcount)");
ok(dsW.onShift.length > 0, "a working day has staff on shift");
const dsH = CAL.daySummary("phoungern", "2026-06-01"); // Lao public holiday (Children's Day)
ok(!!dsH.hol && dsH.onShift.length === 0 && dsH.away.length === 0 && dsH.callable.length === DATA.people("phoungern").length, "public holiday: nobody on shift, whole team callable");
ok(CAL.dayPanel("phoungern") === "", "dayPanel is empty when no day is open");
CAL.openDay("2026-06-16");
const dp = CAL.dayPanel("phoungern");
ok(/dp-modal/.test(dp) && /dp-backdrop/.test(dp) && /cal:day-close/.test(dp) && !/undefined|NaN|\[object/.test(dp), "dayPanel renders clean modal with close + backdrop");
ok(/On shift/.test(dp) && /Available to call in/.test(dp) && /cal:callin:/.test(dp), "dayPanel shows the three buckets + call-in action");
CAL.closeDay();
ok(CAL.dayPanel("phoungern") === "" && CAL.state.dayOpen === null, "closeDay clears the popup");
CAL.openLeave(true);
const sl = SCR_STAFF.web.leave();
ok(/data-leavetype/.test(sl.body) && /leave:submit/.test(sl.body) && /mcal/.test(sl.body), "staff leave open = type select + picker + submit");
CAL.openLeave(false);
const sl2 = SCR_STAFF.web.leave();
ok(/leave:open/.test((sl2.actions || "") + sl2.body) && sl2.body.indexOf("My requests") > -1, "staff leave closed = request button + my requests");
const meSec = SCR_STAFF.web.me("personal");
ok(/General Information/.test(meSec.body) && /Personal Data/.test(meSec.body) && /Documents/.test(meSec.body), "staff Me shows grouped sections incl Documents");
ok(meSec.body.indexOf("profile:edit:") === -1, "staff Me is read-only (no edit affordance)");
ok(/Account & security/.test(meSec.body) && !/Password/.test(meSec.body), "staff Me has an Account tab (security moved out of profile sections)");
const meAcct = SCR_STAFF.web.me("account");
ok(/Password/.test(meAcct.body) && /This device/.test(meAcct.body), "staff Me · Account section shows sign-in & security");
ok(PERSONAS.owner.sections.find(s => s.id === "staffmgr").sub.some(it => it.id === "calendar"), "owner nav has Team calendar");
ok(PERSONAS.staff.nav.flatMap(g => g.items.map(i => i.id)).indexOf("documents") === -1, "staff nav: standalone Documents removed");
// Time Off (SF-style) enhancements
CAL.__reset(); CAL.toggleDate("2026-06-17"); CAL.toggleDate("2026-06-19");
ok(CAL.selected().length === 2, "toggleDate selects by ISO");
const ss = CAL.selSummary();
ok(ss.from === "2026-06-17" && ss.to === "2026-06-19" && ss.days === 2 && ss.returning === "2026-06-20", "selSummary: from/to/days/return");
const pick2 = CAL.monthPicker({ months: 2 });
ok((pick2.match(/mcal-month/g) || []).length === 2, "month picker renders two months");
ok(/<td class="mc[^"]*\b(appr|pend)\b/.test(pick2), "picker shows booked leave (approved/pending coloring)");
ok(/<table class="mtbl"/.test(pick2) && /data-act="leave:pick:2026-/.test(pick2), "calendar renders as a table with ISO day picks");
CAL.__reset();
const lvLanding = SCR_STAFF.web.leave().body;
ok(/Balances/.test(lvLanding) && /Public holidays/.test(lvLanding) && /mcal-month/.test(lvLanding), "leave landing: calendar + balances + holidays");
ok((lvLanding.match(/mcal-month/g) || []).length === 3, "leave calendar shows 3 months");
ok(lvLanding.indexOf("Balances") < lvLanding.indexOf("Calendar"), "balances/holidays sit above the calendar");
CAL.openLeave(true);
const lvOpen = SCR_STAFF.web.leave().body;
ok(/Create absence/.test(lvOpen) && /Time type/.test(lvOpen) && /your manager will see this/.test(lvOpen), "create-absence: type dropdown + comment-to-manager");
CAL.openLeave(false);
CAL.toggleDate("2026-06-23"); CAL.requestLeave(DATA.me().id, "annual", CAL.selected(), "family trip");
ok(SCR_OWNER.web.leave().body.indexOf("family trip") > -1, "owner Leave surfaces the staff comment");
// attendance (staff self-history, last 3 months, table calendar)
const uidA = DATA.me().id, asum = CAL.attSummary(uidA);
ok(asum.present > 0 && asum.onTime >= 0 && asum.onTime <= 100, "attSummary: present count + on-time %");
const arecs = CAL.attRecords(uidA, 14);
ok(arecs.length === 14 && arecs.every(r => r.in && r.out && r.st && r.date), "attRecords: 14 dated rows with in/out/status");
ok(arecs[0].date > arecs[arecs.length - 1].date, "attRecords are most-recent-first");
ok(arecs.every(r => r.date <= CAL.TODAY), "attRecords never include the future");
const acal = CAL.attCalendar(uidA);
ok((acal.match(/<table class="mtbl"/g) || []).length === 3, "attendance calendar = 3 months (back)");
ok(/att-present/.test(acal) && /att-late/.test(acal), "attendance days colored by type");
ok(!/data-act="leave:pick/.test(acal), "attendance calendar is read-only (no day picks)");
const attScr = SCR_STAFF.web.attendance();
ok(/On-time rate/.test(attScr.body) && /Clock records/.test(attScr.body) && /att-present/.test(attScr.body), "attendance screen: KPIs + 3-mo calendar + clock records");

/* ---- Staff job list (17 Jun): comms · pop-ups · payslip top-3 · profile photo ---- */
section("Staff job list — announcements · pop-ups · payslip · profile");
ANNOUNCE.__reset(); CAL.__reset(); DATA.setTenant("phoungern");
// 3 + 6 — shared announcements feed (Home + Inbox), manager composer
ok(ANNOUNCE.feed("phoungern").length >= 3 && ANNOUNCE.active("phoungern").length >= 1, "comms feed + active announcements seeded");
const annN = ANNOUNCE.list("phoungern").length;
const addImm = ANNOUNCE.add("phoungern", { title: "Town hall 3pm", kind: "immediate" });
ok(addImm.ok && ANNOUNCE.list("phoungern").length === annN + 1 && ANNOUNCE.active("phoungern").some(a => a.title === "Town hall 3pm"), "immediate announcement posts + goes live");
ok(!ANNOUNCE.add("phoungern", { title: "" }).ok, "empty announcement rejected");
const addSch = ANNOUNCE.add("phoungern", { title: "Future notice", kind: "scheduled", date: "2026-07-01" });
ok(addSch.ok && ANNOUNCE.isScheduled(addSch.rec) && !ANNOUNCE.active("phoungern").some(a => a.id === addSch.rec.id), "scheduled (future) announcement is NOT on the banner yet");
const addPer = ANNOUNCE.add("phoungern", { title: "This week only", kind: "period", days: 5 });
ok(addPer.ok && addPer.rec.until && /showing until/.test(ANNOUNCE.statusLabel(addPer.rec)), "period announcement carries a display window");
ok(DATA.OUTBOX.some(o => /Town hall/.test(o.tpl)) && DATA.AUDIT.some(a => a.fact === "comms.announced"), "composing logs to outbox + audit");
ANNOUNCE.remove("phoungern", addImm.rec.id);
ok(!ANNOUNCE.list("phoungern").some(a => a.id === addImm.rec.id), "announcement remove works");
ANNOUNCE.__reset();
const home = SCR_STAFF.web.today().body;
ok(/Company announcements/.test(home) && /staff\/web\/inbox/.test(home), "staff Home: announcement banner + Notices link to Inbox");
const inboxBody = SCR_STAFF.web.inbox().body;
ok(/All messages/.test(inboxBody) && /Songkran|payslip/i.test(inboxBody), "staff Inbox renders the shared feed");
const dashBody = SCR_OWNER.web.dashboard().body;
ok(/Alerts &(amp;)? communication/.test(dashBody) && /data-act="ann:add"/.test(dashBody) && /Immediate alert/.test(dashBody), "Manager Dashboard has the alerts/communication composer");
// 2 — create-absence is a frame pop-up
CAL.openLeave(true);
ok(/dp-modal/.test(SCR_STAFF.web.leave().body) && /Create absence/.test(SCR_STAFF.web.leave().body), "create-absence is now a frame pop-up (modal)");
CAL.openLeave(false);
// 5 — payslip Top-3 frame
const payBody = SCR_STAFF.web.pay().body;
ok(/This month · expected/.test(payBody) && /Gross/.test(payBody) && /OT/.test(payBody) && /May 2026/.test(payBody) && /April 2026/.test(payBody), "payslip Top-3: current expected (Gross/OT/…) + previous 2 months");
// 4 — attendance fix-request pop-up
ok(CAL.fixableRecords(DATA.me().id).every(r => r.st === "late" || r.st === "absent"), "fixable records = only late/absent (non-green)");
CAL.openFix(true);
const attFix = SCR_STAFF.web.attendance().body;
ok(/dp-modal/.test(attFix) && /att:fix-submit/.test(attFix) && /Attach evidence/.test(attFix), "attendance fix is a pop-up with evidence + explanation");
const apBefore = APPROVALS.pending("phoungern");
const fixable = CAL.fixableRecords(DATA.me().id), fpick = fixable[0] || { date: "2026-06-12" };
CAL.pickFix(fpick.date);
const fres = CAL.submitFix("phoungern", DATA.me().id, fpick.date, "GPS was weak, I was on site");
ok(fres.ok && APPROVALS.pending("phoungern") === apBefore + 1 && DATA.AUDIT.some(a => a.fact === "attendance.fix_requested"), "fix submit → manager approval + audit");
ok(!CAL.submitFix("phoungern", DATA.me().id, fpick.date, "").ok, "fix submit rejects empty explanation");
CAL.openFix(false);
// 1 + 7 — menu rename + profile photo + click-menu
ok(PERSONAS.staff.nav.flatMap(g => g.items).find(x => x.id === "me").label === "Profile", "staff menu renamed to Profile");
ok(SCR_STAFF.web.me().title === "Profile", "staff Profile screen title");
ok(/Personal Data/.test(SCR_STAFF.web.me().body) && /pf-menu/.test(SCR_STAFF.web.me().body), "Profile header carries a click-menu");
ok(!/ photo"/.test(PROFILE.avatar("PG-010")), "no photo before upload → initials avatar");
PROFILE.setPhoto("PG-010");
ok(/avatar\s+photo/.test(PROFILE.avatar("PG-010")) && DATA.AUDIT.some(a => a.fact === "people.photo"), "manager upload → photo avatar + audit");
ok(/Change photo|Upload photo/.test(SCR_OWNER.web["people-profile"]("PG-010").body), "owner people-profile has photo upload (manager)");
PROFILE.__reset();
// mobile parity — fix-request sub-screen + payslip Top-3
CAL.__reset(); DATA.setTenant("phoungern");
CAL.openFix(true);
const wFix = SCR_STAFF.web.attendance().body;
ok(/dp-modal/.test(wFix) && /att:fix-submit/.test(wFix), "web fix modal still renders after the fixFormInner refactor");
const mFix = SCR_STAFF.mobile.attendance();
ok(mFix.back === "staff/mobile/attendance" && /att:fix-submit/.test(mFix.body) && /att:fix-close/.test(mFix.body) && /fix-row/.test(mFix.body), "mobile fix-request = pushed sub-screen with the shared form");
CAL.openFix(false);
const mAtt = SCR_STAFF.mobile.attendance();
ok(mAtt.back === "staff/mobile/more" && /att:fix-open/.test(mAtt.body) && /heatcal/.test(mAtt.body), "mobile attendance (closed) = heatcal + Request-a-fix button");
const mPay = SCR_STAFF.mobile.pay().body;
ok(/This month · expected/.test(mPay) && /Gross/.test(mPay) && /May 2026/.test(mPay) && /April 2026/.test(mPay) && /June payslip/.test(mPay) && !/Next pay/.test(mPay), "mobile pay = Top-3 + payslip table, no Next-pay KPI");
CAL.__reset();
// Clock rename + sidebar person identity (rail head built in app.js — assert its data source here)
ok(PERSONAS.staff.nav.flatMap(g => g.items).find(x => x.id === "clock").label === "Clock in/out", "Clock nav renamed to 'Clock in/out'");
ok(SCR_STAFF.web.clock().title === "Clock in/out" && /Clock in\/out/.test(SCR_STAFF.web.today().body), "Clock screen title + Today card say 'Clock in/out'");
const meProf = PROFILE.get(DATA.me().id);
ok(!!(DATA.me().name && meProf.position && meProf.email), "rail person identity (name · position · email) resolvable from profile");

/* ---- Manager section (v2 · 17 Jun): teams · approvals tabs · Manager&Admin · Accounting · widget board ---- */
section("Manager section — teams · approvals tabs · widget board");
DATA.setTenant("phoungern");
// 5 — Books → Accounting
ok(PERSONAS.owner.sections.find(s => s.id === "accounting").label === "Accounting", "section rail label Books → Accounting");
ok(PERSONAS.owner.tabs.find(t => t.id === "books").label === "Accounting", "mobile tab Books → Accounting");
// 4 — Access → Manager & Admin
ok(PERSONAS.owner.sections.find(s => s.id === "staffmgr").sub.find(it => it.id === "access").label === "Manager & Admin", "Access nav → Manager & Admin");
const accScr = SCR_OWNER.web.access();
ok(accScr.title === "Manager & Admin" && (accScr.body.match(/Open seat/g) || []).length === 2 && /access:add/.test(accScr.body) && /from registration/.test(accScr.body), "Manager & Admin: 1 admin + 2 open seats");
// 2 — People grouped by team
const mteams = DATA.teamsFor("phoungern");
ok(mteams.length >= 2 && mteams.every(t => t.members.length > 0) && DATA.people("phoungern").every(p => p.team), "every person has a team; roster groups into teams");
ok(mteams.map(t => t.members.length).reduce((a, b) => a + b, 0) === DATA.people("phoungern").length, "team grouping covers the whole roster");
// roster matches the platform seat allocation (people = used seats, by role)
const phSeats = DATA.byId("phoungern").seats, phByAccess = DATA.people("phoungern").reduce((m, p) => { m[p.access] = (m[p.access] || 0) + 1; return m; }, {});
ok((phByAccess.staff || 0) === phSeats.staff.used && (phByAccess.manager || 0) === phSeats.manager.used && (phByAccess.owner || 0) === phSeats.admin.used, "roster by role matches seats used (staff/manager/admin)");
ok(DATA.people("phoungern").length === phSeats.staff.used + phSeats.manager.used + phSeats.admin.used && DATA.byId("phoungern").headcount === DATA.people("phoungern").length, "headcount = total seats used (people match the allowance)");
ok(phSeats.staff.limit > phSeats.staff.used && phSeats.manager.limit > phSeats.manager.used && phSeats.admin.limit > phSeats.admin.used, "seat limits carry headroom above used");
const peBody = SCR_OWNER.web.people().body;
ok(/team-card/.test(peBody) && /team-member/.test(peBody) && /people-profile\//.test(peBody), "People screen: team cards + members linking to profiles");
// 1 + 3 — Approvals: register removed, priority summary + two-level tabs
APPROVALS.__resetView();
const apScr = SCR_OWNER.web.approvals();
ok(!/Register new type/.test((apScr.actions || "") + apScr.body) && !/approve:register/.test((apScr.actions || "") + apScr.body), "Approvals: 'Register new type' option + logic removed");
ok(/appr-summary/.test(apScr.body) && /On shift/.test(apScr.body) && /Overtime/.test(apScr.body) && /Leave/.test(apScr.body) && /Others/.test(apScr.body), "Approvals summary prioritised: shift · overtime · leave · others");
ok(/data-act="appr:mode:team"/.test(apScr.body) && /data-act="appr:mode:type"/.test(apScr.body) && /appr:tab:/.test(apScr.body) && /appr:sub:/.test(apScr.body), "Approvals: by-team / by-type tabs + sub-tabs");
ok(APPROVALS.catOf("ot") === "overtime" && APPROVALS.catOf("swap") === "shift" && APPROVALS.catOf("leave") === "leave" && APPROVALS.catOf("ewa") === "others", "approval category mapping");
APPROVALS.setView({ mode: "team" });
ok(/Management|Floor service|Kitchen/.test(SCR_OWNER.web.approvals().body), "by-team mode shows team tabs");
APPROVALS.__resetView();
// "All messages" leftmost tab, distinct colour, default-selected (never lands on an empty tab)
const apAll = SCR_OWNER.web.approvals().body;
ok(/<div class="appr-tabs"><button class="appr-tab all on"[^>]*data-act="appr:tab:__all"/.test(apAll) && />All messages</.test(apAll), "Approvals: 'All messages' is the leftmost tab (first), distinct colour, default-selected");
// 6 — configurable staff dashboard (widget board)
ok(PERSONAS.owner.sections.find(s => s.id === "system").sub.some(it => it.id === "staffdash"), "System nav has Staff dashboard");
STAFFDASH.__reset();
// catalog grouped by data-source category
ok(STAFFDASH.CATALOG.length >= 4 && STAFFDASH.CATALOG.every(c => c.cat && c.items.length), "widget catalog grouped by data-source category");
ok(STAFFDASH.META.announcement.fixed && STAFFDASH.layout("phoungern")[0].id === "announcement", "announcement is fixed + first on the board");
ok(STAFFDASH.placed("phoungern").every(w => Number.isFinite(w.x) && Number.isFinite(w.y) && w.w >= 1 && w.h >= 1), "every placed widget has x · y · w · h");
ok(STAFFDASH.COLS === 12 && STAFFDASH.MAXH === 2, "grid is 12 columns, max height 2");
// catalog offers not-yet-placed widgets; add/remove
ok(!STAFFDASH.isPlaced("phoungern", "nextpay") && STAFFDASH.available("phoungern").some(c => c.items.some(it => it.id === "nextpay")), "catalog offers a not-yet-placed widget (Next pay)");
ok(STAFFDASH.add("phoungern", "nextpay") && STAFFDASH.isPlaced("phoungern", "nextpay"), "add() places a catalog widget");
ok(STAFFDASH.remove("phoungern", "nextpay") && !STAFFDASH.isPlaced("phoungern", "nextpay"), "remove() takes a widget off the board");
// free placement + collision
const sdClock = STAFFDASH.get("phoungern", "clock");
ok(STAFFDASH.setRect("phoungern", "clock", { x: sdClock.x, y: sdClock.y, w: sdClock.w, h: sdClock.h }) === true, "setRect to the same spot is valid");
ok(STAFFDASH.setRect("phoungern", "clock", { x: -1, y: 0, w: 2, h: 1 }) === false, "out-of-bounds placement rejected");
ok(STAFFDASH.setRect("phoungern", "clock", { x: 0, y: 1, w: 2, h: 1 }) === false, "overlapping placement rejected (collision)");
// fixed widget locked
ok(STAFFDASH.move("phoungern", "announcement", 1, 0) === false && STAFFDASH.remove("phoungern", "announcement") === false, "fixed announcement can't be moved or removed");
// builder screen: grid canvas + per-widget controls
STAFFDASH.__reset();
const sdBody = SCR_OWNER.web.staffdash().body;
ok(/dbx-grid/.test(sdBody) && /dbx-widget/.test(sdBody) && /data-resize=/.test(sdBody) && /staffdash:move:/.test(sdBody) && /staffdash:remove:/.test(sdBody), "builder renders grid canvas + move/resize/remove");
STAFFDASH.toggleCatalog(true);
ok(/dbx-cat-item/.test(SCR_OWNER.web.staffdash().body) && /staffdash:add:/.test(SCR_OWNER.web.staffdash().body), "Add-widget catalog lists addable widgets by category");
STAFFDASH.toggleCatalog(false);
// staff Home renders the free-placement grid
ok(/dash-grid/.test(SCR_STAFF.web.today().body) && /grid-column:/.test(SCR_STAFF.web.today().body), "staff Home renders free-placement grid (grid-column positions)");
STAFFDASH.remove("phoungern", "shiftline");
ok(!/Shift line-up/.test(SCR_STAFF.web.today().body), "removing a widget takes it off staff Home");
STAFFDASH.__reset();
// more columns + more catalog widgets
ok(STAFFDASH.COLS >= 12, "grid widened to 12 columns (SFDC-standard)");
const catIds = STAFFDASH.CATALOG.flatMap(c => c.items.map(it => it.id));
["onshift", "birthdays", "holidays", "hourstrend", "quicklinks"].forEach(id => ok(catIds.indexOf(id) > -1, "new catalog widget present: " + id));
ok(STAFFDASH.CATALOG.some(c => c.cat === "Team"), "new 'Team' widget category present");
STAFFDASH.add("phoungern", "quicklinks");
ok(/Quick actions/.test(SCR_STAFF.web.today().body) && /ql-btn/.test(SCR_STAFF.web.today().body), "added widget renders on staff Home (Quick actions)");
STAFFDASH.__reset();
// person rename: Khamla → Tinar, purged everywhere
ok(DATA.me().name === "Tinar Sisombat", "main sample person is Tinar Sisombat");
const allNames = [DATA.PAYSLIP.name].concat(DATA.LEAVE_REQS.map(l => l.who), DATA.OUTBOX.map(o => o.to), Object.values(DATA.PEOPLE).flat().map(p => p.name));
ok(allNames.every(n => !/Khamla/.test(n)), "no 'Khamla' remains in any seeded name");
ok(!/Khamla/.test(SCR_STAFF.web.today().title) && /Tinar/.test(SCR_STAFF.web.today().title), "staff greeting uses Tinar, not Khamla");
ok(DATA.people("phoungern").some(p => p.name === "Khamphan Sayasith"), "Khamphan Sayasith (different person) untouched");

/* ---- jobs schedule & shifts (SCHED) ---- */
SCHED.__reset(); DATA.setTenant("phoungern");
ok(SCHED.tmplOf("phoungern") === "multi", "default template = multi-shift");
const dW = SCHED.slotsFor("phoungern", "2026-06-17"); // Wed weekday → multi = 3 seeded shift groups
ok(dW.length === 3 && dW.every(s => s.people.length > 0), "multi: 3 shifts on a weekday, each peopled");
ok(dW.some(s => s.def.periodId === "P-afternoon") && dW.some(s => s.def.periodId === "P-evening"), "overlapping afternoon + evening shifts");
SCHED.setTemplate("phoungern", "basic");
ok(SCHED.tmplOf("phoungern") === "basic" && SCHED.genDay("phoungern", "2026-06-17").length === 1, "basic = 1 shift/day");
ok(DATA.AUDIT.some(a => a.fact === "sched.template"), "template change audited");
SCHED.setTemplate("phoungern", "multi");
ok(SCHED.slotsFor("phoungern", "2026-06-01").length === 0, "holiday (1 Jun) = closed, no shifts");
ok(SCHED.dayHeads("phoungern", "2026-06-17") > 0, "dayHeads counts distinct people");
const mgrCal = SCHED.calendar("phoungern");
ok((mgrCal.match(/<table class="mtbl sctbl"/g) || []).length === 3 && /data-act="sched:edit:/.test(mgrCal), "manager calendar = 3 months, days clickable to edit shifts");
const uidK = DATA.me().id, stCal = SCHED.calendar("phoungern", { uid: uidK });
ok((stCal.match(/sctbl/g) || []).length === 3 && /data-act="sched:pick:/.test(stCal), "staff calendar = own shifts, pick to swap");
SCHED.setSelDate("2026-06-17");
ok(/Shifts ·/.test(SCHED.dayDetail("phoungern")) && /chip/.test(SCHED.dayDetail("phoungern")), "manager day-detail lists names per shift");
const apN2 = APPROVALS.pending("phoungern");
const sw = SCHED.requestSwap("phoungern", uidK, ["2026-06-18"], "Souphaphone Keo", "doctor visit");
ok(sw.ok && APPROVALS.pending("phoungern") === apN2 + 1, "swap → approvals (+1, manager approval)");
ok(SCHED.mySwaps("phoungern", uidK).length === 1, "staff sees own swap request");
ok(SCR_OWNER.web.scheduling().body.indexOf("doctor visit") > -1, "manager scheduling shows the swap + note");
ok(!SCHED.requestSwap("phoungern", uidK, [], "").ok, "swap with no day rejected");
ok(SCR_OWNER.web.scheduling().title === "Jobs schedule & shifts" && SCR_STAFF.web.schedule().title.indexOf("Jobs schedule") > -1, "both screens renamed");
ok(PERSONAS.owner.sections.find(s => s.id === "staffmgr").sub.find(x => x.id === "scheduling").label === "Jobs schedule & shifts", "owner nav renamed");
ok(PERSONAS.staff.nav.flatMap(g => g.items).find(x => x.id === "schedule").label.indexOf("Jobs schedule") > -1, "staff nav renamed");

/* ---- shift configuration: periods · users groups · shift groups ---- */
SCHED.__reset(); DATA.setTenant("phoungern");
const cfg0 = SCHED.cfg("phoungern");
ok(cfg0.periods.length >= 4 && cfg0.groups.length >= 1 && cfg0.shiftGroups.length >= 1, "config seeds periods + groups + shift groups");
const sg0 = cfg0.shiftGroups[0], slot0 = SCHED.slotsFor("phoungern", "2026-06-17").find(s => s.def.id === sg0.id);
ok(slot0 && slot0.people.length === SCHED.members("phoungern", sg0.groupId).length, "a multi shift's people = its users-group members");
const pN = cfg0.periods.length;
ok(SCHED.addPeriod("phoungern", { label: "Night", start: "21:00", end: "23:00", cap: 2 }).ok && SCHED.cfg("phoungern").periods.length === pN + 1, "addPeriod works");
ok(!SCHED.addPeriod("phoungern", { label: "Bad", start: "18:00", end: "09:00" }).ok, "addPeriod rejects end ≤ start");
ok(!SCHED.addGroup("phoungern", { label: "Empty", members: [] }).ok, "addGroup rejects empty membership");
const gAdd = SCHED.addGroup("phoungern", { label: "Weekend crew", members: SCHED.roster("phoungern").slice(0, 3).map(p => p.id) });
ok(gAdd.ok, "addGroup works");
ok(!SCHED.addShiftGroup("phoungern", { periodId: "", groupId: "" }).ok, "addShiftGroup needs a period AND a group");
const sgAdd = SCHED.addShiftGroup("phoungern", { periodId: "P-morning", groupId: gAdd.id });
ok(sgAdd.ok, "addShiftGroup creates an assignable unit");
ok(!SCHED.removeGroup("phoungern", gAdd.id).ok, "can't remove a users group still bound to a shift group");
const aRes = SCHED.assignDays("phoungern", ["2026-06-20"], sgAdd.id); // Sat weekend
ok(aRes.ok && SCHED.assignedIdsFor("phoungern", "2026-06-20").includes(sgAdd.id), "assignDays adds a shift group to the selected day(s)");
ok(SCHED.assignDays("phoungern", ["2026-06-01"], sgAdd.id).n === 0, "holiday is skipped when assigning");
SCHED.dayRemoveShift("phoungern", "2026-06-20", sgAdd.id);
ok(!SCHED.assignedIdsFor("phoungern", "2026-06-20").includes(sgAdd.id), "dayRemoveShift removes a shift from the day");
SCHED.dayReset("phoungern", "2026-06-20");
ok(SCHED.cfg("phoungern").assign["2026-06-20"] === undefined, "dayReset clears the day override");
// create-first gate: remove every shift group, assignment must block
const liveSg = SCHED.cfg("phoungern").shiftGroups.map(s => s.id);
liveSg.forEach(id => SCHED.removeShiftGroup("phoungern", id));
ok(SCHED.cfg("phoungern").shiftGroups.length === 0 && !SCHED.assignDays("phoungern", ["2026-06-17"], "SG-x").ok, "no shift groups → assignment blocked (must create first)");
SCHED.state.assignMode = true;
ok(/Create a shift group first/.test(SCHED.assignBar("phoungern")), "assign bar shows the create-first gate");
SCHED.state.assignMode = false; SCHED.state.editDate = "2026-06-17";
ok(/No shift groups exist yet/.test(SCHED.dayEditor("phoungern")), "day editor shows the create-first gate");
// clean renders
SCHED.__reset();
const cfgHtml = SCHED.config("phoungern");
ok(/Shift periods/.test(cfgHtml) && /data-act="sched:addsg"/.test(cfgHtml) && /data-ug="members"/.test(cfgHtml) && !/undefined|NaN|\[object/.test(cfgHtml), "config renders three blocks, clean + interactive");
ok((cfgHtml.match(/se-listwrap/g) || []).length === 3 && /se-form/.test(cfgHtml), "shift config: list + creation are separated sections (buttons align)");
SCHED.state.editDate = "2026-06-17";
const edHtml = SCHED.dayEditor("phoungern");
ok(/dp-modal/.test(edHtml) && /sched:dayadd:/.test(edHtml) && /sched:edit-close/.test(edHtml) && !/undefined|NaN|\[object/.test(edHtml), "day editor renders clean (add + close)");
SCHED.closeEdit();
const schBody = SCR_OWNER.web.scheduling().body;
ok(/Shift configuration/.test(schBody) && /sched:assignmode:on/.test(schBody) && /sched:tmpl:/.test(schBody), "multi scheduling screen carries config + assign toolbar");
SCHED.__reset();

CAL.__reset(); PROFILE.__reset();

/* ---- split dashboards: manager (ops) vs payroll (money) ---- */
section("Dashboards — manager (ops · no money) vs payroll (money)");
DATA.setTenant("phoungern"); LEDGER.__reset(); CAL.__reset();
const mgr = SCR_OWNER.web.dashboard();
ok(/on the job/i.test(mgr.body) && /Team calendar/.test(mgr.body) && /system resources/.test(mgr.body), "manager dashboard: attendance + calendar + resources");
ok(!/Revenue vs staff-cost/.test(mgr.body) && !/month result/.test(mgr.body) && mgr.body.indexOf("PIT") === -1, "manager dashboard has NO money (no cash/revenue/PIT)");
const pd = SCR_OWNER.web["pay-dashboard"]();
ok(/Days to pay date/.test(pd.body) && /Revenue vs staff-cost/.test(pd.body) && /top expenses/.test(pd.body), "payroll dashboard: paydate countdown + revenue chart + top expenses");
ok(/expense:post:/.test(pd.body) && /expense:freq:/.test(pd.body) && /expense:add/.test(pd.body), "payroll dashboard: recurring post/freq/add wired");
const te = LEDGER.topExpenses("phoungern", 5);
ok(te.length >= 4 && te[0].amount >= te[te.length - 1].amount, "topExpenses sorted desc");
const rcx = LEDGER.recurring("phoungern"), rxid = rcx[0].id, nx0 = rcx[0].next, mexp0 = LEDGER.sums(LEDGER.ranged("phoungern", "month")).exp;
const prx = LEDGER.postRecurring("phoungern", rxid);
ok(prx.ok && LEDGER.sums(LEDGER.ranged("phoungern", "month")).exp > mexp0, "postRecurring adds a cashbook expense");
ok(LEDGER.recurring("phoungern").find(x => x.id === rxid).next !== nx0, "postRecurring rolls the next date forward");
LEDGER.setRecurringFreq("phoungern", rxid, "weekly");
ok(LEDGER.recurring("phoungern").find(x => x.id === rxid).freq === "weekly", "setRecurringFreq updates cadence");
const rnx = LEDGER.recurring("phoungern").length;
LEDGER.addRecurring("phoungern", { name: "Test sub", amount: 500000, freq: "monthly", cat: "Test" });
ok(LEDGER.recurring("phoungern").length === rnx + 1, "addRecurring adds a scheduled expense");
ok(DATA.AUDIT.some(a => a.fact === "expense.posted") && DATA.AUDIT.some(a => a.fact === "expense.scheduled"), "expense post/schedule audited");
const sm = PERSONAS.owner.sections.find(s => s.id === "staffmgr");
ok(sm.sub[0].id === "dashboard" && sm.sub[0].label === "Manager Dashboard" && sm.sub[1].id === "approvals" && sm.sub[2].id === "calendar", "staffmgr order: Manager Dashboard · Approvals · Team calendar …");
ok(!PERSONAS.owner.sections.some(s => s.solo && s.id === "dashboard"), "no solo dashboard section");
ok(PERSONAS.owner.firstOf["staffmgr"] === "dashboard" && PERSONAS.owner.sectionOf["dashboard"] === "staffmgr", "dashboard resolves under staffmgr");
const pay = PERSONAS.owner.sections.find(s => s.id === "payroll");
ok(pay.sub[0].id === "pay-dashboard" && PERSONAS.owner.sectionOf["pay-dashboard"] === "payroll", "payroll Dashboard is first sub");
LEDGER.__reset();

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
