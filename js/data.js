/* ============================================================
   ADEPTIO · seed data — multi-tenant demo (v2.4.1.smbowner)
   Representative, in-memory only (no backend this pass). Numbers
   are blueprint-true: the payroll vector reconciles to the kip,
   the monthly cost/benefit ties out. Shaped so the later live DB
   (Turso + Worker) drops in behind the same accessors.
   ============================================================ */
window.DATA = (function () {

  /* ---------------- tenants (the spine) ---------------- */
  const TENANTS = [
    {
      id: "phoungern", name: "Phoungern Co.", short: "PG", entity: "company", biz: "services", locale: "en",
      status: "active", plan: "Free", level: "L0", headcount: 14, since: "2026-03-02",
      sites: [{ name: "Main shop · Vientiane", lat: 17.9757, lng: 102.6331, radius_m: 30 }],
      seats: { staff: { used: 10, limit: 12 }, manager: { used: 3, limit: 4 }, admin: { used: 1, limit: 2 } },
      quota: { line: { used: 38, limit: 50 }, whatsapp: { used: 12, limit: 50 } },
      storage: { used: 0.4, limit: 2 }, owner: "Somchai Phongsavanh",
      month: { revenue: 91000000, otherExp: 17300000, channelFee: 280000 }
    },
    {
      id: "vientianemart", name: "Vientiane Mart", short: "VM", entity: "sole", biz: "commerce", locale: "en",
      status: "active", plan: "Free", level: "L0", headcount: 9, since: "2026-04-18",
      sites: [{ name: "Mart · Thatluang", lat: 17.9667, lng: 102.6333, radius_m: 40 }],
      seats: { staff: { used: 7, limit: 10 }, manager: { used: 1, limit: 3 }, admin: { used: 1, limit: 1 } },
      quota: { line: { used: 21, limit: 50 }, whatsapp: { used: 4, limit: 50 } },
      storage: { used: 0.2, limit: 2 }, owner: "Manivanh Keobounphan",
      month: { revenue: 38000000, otherExp: 9000000, channelFee: 50000 }
    },
    {
      id: "laocoffee", name: "Lao Coffee Lab", short: "LC", entity: "sole", locale: "lo",
      status: "pending", plan: "—", level: "—", headcount: 0, since: "2026-06-14",
      sites: [], seats: null, quota: null, storage: null, owner: "Daophet Insixiengmai"
    }
  ];

  /* ---------------- people ---------------- */
  function P(id, name, role, div, base, status, x) {
    return Object.assign({ id, name, role, div, base, status: status || "present" }, x || {});
  }
  const PEOPLE = {
    phoungern: [
      P("PG-001", "Somchai Phongsavanh", "Owner / Sys-Admin", "Management", 3800000, "present", { access: "owner" }),
      P("PG-002", "Bouasone Vilaykham", "Shift Manager", "Floor", 3200000, "present", { access: "manager" }),
      P("PG-003", "Phetsamone Douangchak", "Shift Manager", "Kitchen", 3000000, "present", { access: "manager" }),
      P("PG-004", "Vilayphone Sengdara", "Supervisor", "Floor", 2800000, "onleave", { access: "manager" }),
      P("PG-010", "Tinar Sisombat", "Barista", "Floor", 6000000, "present", { access: "staff", you: true }),
      P("PG-011", "Souphaphone Keo", "Barista", "Floor", 2600000, "present", { access: "staff" }),
      P("PG-012", "Daophet Many", "Cashier", "Floor", 2500000, "late", { access: "staff", flag: "geo" }),
      P("PG-013", "Khamphan Sayasith", "Cook", "Kitchen", 2600000, "present", { access: "staff" }),
      P("PG-014", "Noy Phaketh", "Server", "Floor", 2500000, "present", { access: "staff" }),
      P("PG-015", "Vong Inthavong", "Server", "Floor", 2500000, "absent", { access: "staff" })
    ],
    vientianemart: [
      P("VM-001", "Manivanh Keobounphan", "Owner", "Management", 3500000, "present", { access: "owner" }),
      P("VM-002", "Outhai Phommachanh", "Supervisor", "Store", 2800000, "present", { access: "manager" }),
      P("VM-010", "Sengdao Latda", "Cashier", "Store", 2600000, "present", { access: "staff" }),
      P("VM-011", "Chanthala Bounmy", "Stock", "Store", 2500000, "present", { access: "staff" }),
      P("VM-012", "Mali Souk", "Cashier", "Store", 2500000, "late", { access: "staff" })
    ]
  };

  // pad rosters to each tenant's headcount with generated staff (comp profile: base + ss-eligible)
  (function () {
    const FN = ["Somphone", "Khamphone", "Bounthavy", "Sengphet", "Viengsavanh", "Thipphavanh", "Bountham", "Khampheng", "Souksavanh", "Phonesavanh", "Vilaysack", "Khamtanh", "Chansamone", "Bouaphanh"];
    const LN = ["Souksavath", "Phommavong", "Inthavong", "Sisomphone", "Vongphachanh", "Keomany", "Douangphachanh", "Phimmasone", "Sayavong", "Manivong", "Chanthavong", "Rattanavong"];
    const ROLES = [["Server", "Floor"], ["Cook", "Kitchen"], ["Cashier", "Floor"], ["Cleaner", "Floor"], ["Barista", "Floor"], ["Stock", "Store"]];
    function pad(tid, prefix, target) {
      const arr = PEOPLE[tid], names = new Set(arr.map(p => p.name));
      let n = 1;
      while (arr.length < target) {
        const i = arr.length, r = ROLES[i % ROLES.length];
        const base = 2500000 + ((i * 2) % 4) * 50000;
        let name = FN[i % FN.length] + " " + LN[(i * 2) % LN.length];
        while (names.has(name)) name += " Jr";
        names.add(name);
        arr.push(P(prefix + "-G" + String(n).padStart(2, "0"), name, r[0], r[1], base, i % 6 === 0 ? "late" : "present", { access: "staff" }));
        n++;
      }
    }
    pad("phoungern", "PG", 14);
    pad("vientianemart", "VM", 9);
  })();

  /* ---------------- team assignment (manager groups the roster by team) ---------------- */
  (function () {
    const teamOf = (p) => (p.access === "owner" || p.access === "manager") ? "Management"
      : p.div === "Kitchen" ? "Kitchen" : p.div === "Store" ? "Store" : "Floor";
    Object.keys(PEOPLE).forEach(tid => PEOPLE[tid].forEach(p => { p.team = teamOf(p); }));
  })();
  // team meta — display order + accent (named hues, no drift)
  const TEAMS = [
    { id: "Management", label: "Management", hue: "ceo" },
    { id: "Floor", label: "Floor service", hue: "staff" },
    { id: "Kitchen", label: "Kitchen", hue: "mgr" },
    { id: "Store", label: "Store", hue: "hr" }
  ];
  function teamsFor(tid) {
    const ppl = people(tid), seen = {};
    ppl.forEach(p => { (seen[p.team] = seen[p.team] || []).push(p); });
    return TEAMS.filter(t => seen[t.id]).map(t => Object.assign({}, t, { members: seen[t.id] }));
  }

  /* ---------------- payroll — the verified vector (blueprint BO-4) ---------------- */
  const SS = { er: 0.06, ee: 0.055, cap: 4500000 };
  const PIT_BRACKETS = [
    [0, 1300000, 0], [1300000, 5000000, 0.05], [5000000, 15000000, 0.10],
    [15000000, 25000000, 0.15], [25000000, 65000000, 0.20], [65000000, Infinity, 0.25]
  ];
  // worked example: Tinar, base 6,000,000 — reconciles to the kip
  const PAYSLIP = {
    name: "Tinar Sisombat", id: "PG-010", period: "June 2026", base: 6000000, gross: 6000000,
    ssBase: 4500000, ssEmp: 247500, ssEr: 270000, taxable: 5752500,
    pitSlices: [{ band: "₭1.3M → 5.0M @ 5%", amt: 185000 }, { band: "₭5.0M → 5.7525M @ 10%", amt: 75250 }],
    pit: 260250, net: 5492250, cost: 6270000,
    remit: { worker: 5492250, nssf: 517500, pit: 260250 }
  };
  const PAYRUNS = [
    { id: "PR-2026-06", period: "June 2026", state: "draft", people: 14, gross: 41700000, cost: 41700000, pit: 0, due: "2026-06-28" },
    { id: "PR-2026-05", period: "May 2026", state: "closed", people: 14, gross: 41200000, cost: 41200000, pit: 0, due: "2026-05-28" },
    { id: "PR-2026-04", period: "April 2026", state: "closed", people: 13, gross: 38500000, cost: 38500000, pit: 0, due: "2026-04-28" }
  ];

  /* ---------------- accounting — cashbook (per-tenant, full month so dw_reports replays from it) ---------------- */
  // PG sums: revenue 91,000,000 · non-payroll expense 17,300,000   |   VM: 38,000,000 · 9,000,000
  const LEDGER = {
    phoungern: [
      { date: "2026-06-02", kind: "rev", cat: "Weekly takings · wk1", amount: 21000000, method: "transfer", tax: "vat_out" },
      { date: "2026-06-07", kind: "rev", cat: "Weekly takings · wk2", amount: 22500000, method: "cash", tax: "vat_out" },
      { date: "2026-06-10", kind: "rev", cat: "Catering order", amount: 6000000, method: "transfer", tax: "vat_out" },
      { date: "2026-06-12", kind: "rev", cat: "Weekly takings · wk3", amount: 23000000, method: "qr", tax: "vat_out" },
      { date: "2026-06-14", kind: "rev", cat: "Weekly takings · wk4", amount: 18500000, method: "cash", tax: "vat_out" },
      { date: "2026-06-01", kind: "exp", cat: "Rent", amount: 6000000, method: "transfer", tax: "exempt" },
      { date: "2026-06-05", kind: "exp", cat: "Coffee beans (COGS)", amount: 6500000, method: "transfer", tax: "vat_in" },
      { date: "2026-06-09", kind: "exp", cat: "Misc supplies", amount: 1800000, method: "cash", tax: "exempt" },
      { date: "2026-06-12", kind: "exp", cat: "Packaging", amount: 1200000, method: "cash", tax: "vat_in" },
      { date: "2026-06-13", kind: "exp", cat: "Utilities", amount: 1800000, method: "transfer", tax: "vat_in" }
    ],
    vientianemart: [
      { date: "2026-06-06", kind: "rev", cat: "Weekly takings · wk1", amount: 14000000, method: "cash", tax: "vat_out" },
      { date: "2026-06-11", kind: "rev", cat: "Weekly takings · wk2", amount: 13000000, method: "qr", tax: "vat_out" },
      { date: "2026-06-14", kind: "rev", cat: "Weekly takings · wk3", amount: 11000000, method: "cash", tax: "vat_out" },
      { date: "2026-06-01", kind: "exp", cat: "Rent", amount: 4000000, method: "transfer", tax: "exempt" },
      { date: "2026-06-08", kind: "exp", cat: "Stock purchase", amount: 3500000, method: "transfer", tax: "vat_in" },
      { date: "2026-06-13", kind: "exp", cat: "Utilities", amount: 1500000, method: "transfer", tax: "vat_in" }
    ]
  };
  /* ---------------- recurring / scheduled expenses (waiting to post) ---------------- */
  const RECUR_EXPENSES = {
    phoungern: [
      { name: "Shop rent", cat: "Rent", amount: 6000000, freq: "monthly", next: "2026-06-20", method: "transfer", tax: "exempt" },
      { name: "Electricity & water", cat: "Utilities", amount: 1800000, freq: "monthly", next: "2026-06-22", method: "transfer", tax: "vat_in" },
      { name: "Coffee bean supplier", cat: "Coffee beans (COGS)", amount: 1500000, freq: "weekly", next: "2026-06-18", method: "transfer", tax: "vat_in" },
      { name: "Internet & LINE plan", cat: "Comms & software", amount: 280000, freq: "monthly", next: "2026-06-25", method: "qr", tax: "vat_in" },
      { name: "Business license renewal", cat: "Licenses & fees", amount: 2000000, freq: "yearly", next: "2026-12-01", method: "transfer", tax: "exempt" }
    ],
    vientianemart: [
      { name: "Shop rent", cat: "Rent", amount: 4000000, freq: "monthly", next: "2026-06-20", method: "transfer", tax: "exempt" },
      { name: "Stock replenishment", cat: "Stock purchase", amount: 3500000, freq: "weekly", next: "2026-06-19", method: "transfer", tax: "vat_in" },
      { name: "Electricity & water", cat: "Utilities", amount: 1500000, freq: "monthly", next: "2026-06-22", method: "transfer", tax: "vat_in" }
    ]
  };
  // legacy seed — NOT used at runtime (LEDGER.rollup computes live: revenue from the cashbook, staff cost from payroll over DATA.people).
  // 14-person shop (10 staff + 3 mgr + 1 admin = seat allocation): 91 − 41.7 − 17.3 − 0.28 ≈ 31.7M
  const ROLLUP = {
    revenue: 91000000, staffCost: 41700000, otherExp: 17300000, channelFee: 280000,
    result: 31720000, margin: 0.349, staffRatio: 0.458, costPerHead: 2978571,
    trendRev: [78, 81, 85, 88, 90, 91], trendStaff: [38, 39, 40, 40.5, 41, 41.7]
  };

  /* ---------------- tax centre — calendar + tables ---------------- */
  const TAX_PERIODS = [
    { type: "PIT withholding", basis: "Salary after NSSF", due: "2026-06-20", amount: 4100000, status: "due" },
    { type: "NSSF contribution", basis: "Earnings to ₭4.5M cap", due: "2026-06-20", amount: 3050000, status: "due" },
    { type: "VAT", basis: "Output − input", due: "2026-07-15", amount: 2400000, status: "upcoming" },
    { type: "Profit Tax / CIT", basis: "Annual", due: "2027-03-31", amount: null, status: "annual" }
  ];

  /* ---------------- attendance · leave · schedule ---------------- */
  const ATT_TODAY = { in: 18, total: 21, flags: 2, leave: 1 };
  const LEAVE_REQS = [
    { id: "LV-241", uid: "PG-011", who: "Souphaphone Keo", type: "Annual leave", typeId: "annual", tone: "leave", days: 2, from: "2026-06-18", to: "2026-06-19", status: "pending" },
    { id: "LV-240", uid: "PG-013", who: "Khamphan Sayasith", type: "Sick leave", typeId: "sick", tone: "sick", days: 1, from: "2026-06-15", to: "2026-06-15", status: "pending" },
    { id: "LV-239", uid: "PG-004", who: "Vilayphone Sengdara", type: "Annual leave", typeId: "annual", tone: "leave", days: 4, from: "2026-06-08", to: "2026-06-11", status: "approved" },
    { id: "LV-238", uid: "PG-014", who: "Noy Phaketh", type: "Annual leave", typeId: "annual", tone: "leave", days: 3, from: "2026-06-22", to: "2026-06-24", status: "approved" },
    { id: "LV-230", uid: "PG-010", who: "Tinar Sisombat", type: "Annual leave", typeId: "annual", tone: "leave", days: 3, from: "2026-06-22", to: "2026-06-24", status: "approved" },
    { id: "LV-229", uid: "PG-010", who: "Tinar Sisombat", type: "Sick leave", typeId: "sick", tone: "sick", days: 1, from: "2026-06-05", to: "2026-06-05", status: "approved" }
  ];
  const SHIFTS = [
    { day: "Mon", open: 1, assigned: 6 }, { day: "Tue", open: 0, assigned: 6 }, { day: "Wed", open: 2, assigned: 5 },
    { day: "Thu", open: 0, assigned: 6 }, { day: "Fri", open: 1, assigned: 7 }, { day: "Sat", open: 0, assigned: 8 }, { day: "Sun", open: 0, assigned: 4 }
  ];

  /* ---------------- KYC registrations (platform plane) ---------------- */
  const REGISTRATIONS = [
    { id: "REG-0473", company: "Lao Coffee Lab", owner: "Daophet Insixiengmai", email: "daophet@laocoffee.la", phone: "+856 20 55 1xx 123", submitted: "2026-06-14", status: "pending", idType: "National ID card", match: "strong", tenant: "laocoffee" },
    { id: "REG-0472", company: "Mekong Textiles", owner: "Latda Vongphachanh", email: "latda@mekongtex.la", phone: "+856 20 22 9xx 880", submitted: "2026-06-13", status: "pending", idType: "Passport", match: "review" },
    { id: "REG-0470", company: "Sabaidee Pharmacy", owner: "Viengkham Sisamouth", email: "vk@sabaidee.la", phone: "+856 20 78 4xx 201", submitted: "2026-06-11", status: "active", idType: "National ID card", match: "strong" },
    { id: "REG-0469", company: "(rejected) Quick Cash Co.", owner: "—", email: "n/a", phone: "n/a", submitted: "2026-06-10", status: "rejected", idType: "—", match: "fail" }
  ];

  /* ---------------- comms outbox (bilingual templates) ---------------- */
  const OUTBOX = [
    { to: "Tinar Sisombat", ch: "in-app", tpl: "Payslip ready", when: "2026-06-14 18:04", lang: "EN·ລາວ" },
    { to: "Souphaphone Keo", ch: "LINE", tpl: "Shift reminder", when: "2026-06-14 07:30", lang: "EN·ລາວ" },
    { to: "All staff", ch: "LINE", tpl: "Owner broadcast", when: "2026-06-13 12:00", lang: "EN·ລາວ" },
    { to: "Daophet Many", ch: "in-app", tpl: "Missing-punch nudge", when: "2026-06-13 19:10", lang: "EN·ລາວ" }
  ];

  /* ---------------- audit facts ---------------- */
  const AUDIT = [
    { fact: "payroll.drafted", who: "Somchai P.", when: "2026-06-14 16:20", ref: "PR-2026-06" },
    { fact: "ledger.added", who: "Bouasone V.", when: "2026-06-14 18:40", ref: "rev ₭4.2M" },
    { fact: "comms.sent", who: "system", when: "2026-06-14 18:04", ref: "payslip · in-app" },
    { fact: "flag.set", who: "Somchai P.", when: "2026-06-13 09:02", ref: "EWA → off" },
    { fact: "auth.signin", who: "Tinar S.", when: "2026-06-15 08:58", ref: "staff portal" }
  ];

  /* ---------------- accessors ---------------- */
  const state = { tenantId: "phoungern" };
  const byId = (id) => TENANTS.find(t => t.id === id);
  function cur() { return byId(state.tenantId) || TENANTS[0]; }
  function setTenant(id) { if (byId(id) && byId(id).status === "active") state.tenantId = id; }
  function people(tid) { return PEOPLE[tid || state.tenantId] || []; }
  function me() { return PEOPLE.phoungern.find(p => p.you); }
  function activeTenants() { return TENANTS.filter(t => t.status === "active"); }
  function pendingKyc() { return (window.REG && REG.pending) ? REG.pending() : REGISTRATIONS.filter(r => r.status === "pending"); }

  // platform totals
  function platformStats() {
    const act = activeTenants();
    return {
      tenants: act.length, pending: pendingKyc().length, total: TENANTS.length,
      seatsUsed: act.reduce((s, t) => s + (t.seats ? t.seats.staff.used + t.seats.manager.used + t.seats.admin.used : 0), 0),
      msgUsed: act.reduce((s, t) => s + (t.quota ? t.quota.line.used + t.quota.whatsapp.used : 0), 0)
    };
  }

  return {
    TENANTS, PEOPLE, SS, PIT_BRACKETS, PAYSLIP, PAYRUNS, LEDGER, ROLLUP, TAX_PERIODS,
    ATT_TODAY, LEAVE_REQS, SHIFTS, RECUR_EXPENSES, REGISTRATIONS, OUTBOX, AUDIT, TEAMS,
    state, byId, cur, setTenant, people, me, activeTenants, pendingKyc, platformStats, teamsFor
  };
})();
