/* ============================================================
   ADEPTIO · persona registry (v2.4.1.smbowner)
   Three personas. Staff & Platform use a single-tier rail; the
   Owner console is TWO-TIER (section rail + contextual sub-nav).
   Screen render fns come from SCR_STAFF / SCR_OWNER / SCR_PLATFORM
   (loaded just before this file). Counts are live from DATA.
   ============================================================ */
window.PERSONAS = (function () {
  const pendingLeave = () => DATA.LEAVE_REQS.filter(l => l.status === "pending").length;
  const pendingKyc = () => DATA.pendingKyc().length;
  const pendingApprovals = () => (window.APPROVALS ? APPROVALS.pending() : 0);

  const STAFF = {
    key: "staff", label: "Staff", accent: "staff", icon: "user",
    appName: "Staff Portal", roleLine: "The employee · self-service", domain: "self",
    twoTier: false,
    nav: [{
      group: "My day", items: [
        { id: "today", label: "Today", icon: "sun" },
        { id: "clock", label: "Clock in/out", icon: "clock" },
        { id: "attendance", label: "Attendance", icon: "history" },
        { id: "leave", label: "Leave", icon: "calendar" },
        { id: "schedule", label: "Jobs schedule & shifts", icon: "calendar" }
      ]
    }, {
      group: "Me", items: [
        { id: "pay", label: "Pay", icon: "banknote" },
        { id: "inbox", label: "Inbox", icon: "inbox" },
        { id: "me", label: "Profile", icon: "user" }
      ]
    }],
    web: SCR_STAFF.web, mobile: SCR_STAFF.mobile,
    tabs: [
      { id: "today", label: "Today", icon: "sun" },
      { id: "clock", label: "Clock", icon: "clock" },
      { id: "leave", label: "Leave", icon: "calendar" },
      { id: "pay", label: "Pay", icon: "banknote" },
      { id: "more", label: "More", icon: "dots" }
    ],
    tabParent: { attendance: "more", schedule: "more", documents: "more", inbox: "more", me: "more" }
  };

  const OWNER = {
    key: "owner", label: "Owner", accent: "owner", icon: "store",
    appName: "Owner Console", roleLine: "Owner · Manager · HR · Books", domain: "tenant",
    twoTier: true,
    sections: [
      {
        id: "staffmgr", label: "Staff", icon: "users", tag: "2.1", count: pendingApprovals,
        title: "Staff Manager", sub: [
          { id: "dashboard", label: "Manager Dashboard", icon: "home" },
          { id: "approvals", label: "Approvals", icon: "check", count: pendingApprovals },
          { id: "calendar", label: "Team calendar", icon: "calCheck" },
          { id: "people", label: "People", icon: "users" },
          { id: "scheduling", label: "Jobs schedule & shifts", icon: "calendar" },
          { id: "attendance", label: "Attendance", icon: "history" },
          { id: "leave", label: "Leave", icon: "calCheck", count: pendingLeave },
          { id: "messaging", label: "Messaging & content", icon: "megaphone" },
          { id: "access", label: "Manager & Admin", icon: "key" }
        ]
      },
      {
        id: "payroll", label: "Payroll", icon: "banknote", tag: "★",
        title: "Payroll", sub: [
          { id: "pay-dashboard", label: "Dashboard", icon: "chart" },
          { id: "pay-runs", label: "Pay runs", icon: "banknote" },
          { id: "components", label: "Components", icon: "sliders" },
          { id: "advances", label: "Advances (EWA)", icon: "wallet" },
          { id: "statutory", label: "Statutory", icon: "shield" },
          { id: "payslips", label: "Payslips", icon: "receipt" },
          { id: "leveling", label: "Leveling", icon: "scale" }
        ]
      },
      {
        id: "accounting", label: "Accounting", icon: "book", tag: "2.2",
        title: "Accounting", sub: [
          { id: "cashbook", label: "Cashbook", icon: "book" },
          { id: "close", label: "Monthly close", icon: "calCheck" },
          { id: "tax", label: "Tax centre", icon: "percent" },
          { id: "costbenefit", label: "Cost & benefit", icon: "trend" },
          { id: "reports", label: "Reports & export", icon: "download" }
        ]
      },
      {
        id: "system", label: "System", icon: "settings", tag: "2.3",
        title: "System Management", sub: [
          { id: "company", label: "Company", icon: "briefcase" },
          { id: "staffdash", label: "Staff dashboard", icon: "grid" },
          { id: "functions", label: "Functions", icon: "power" },
          { id: "integrations", label: "Integrations", icon: "plug" },
          { id: "users", label: "Users & roles", icon: "users" },
          { id: "datastudio", label: "Data studio", icon: "database" },
          { id: "audit", label: "Audit & logs", icon: "history" }
        ]
      },
      {
        id: "capacity", label: "Capacity", icon: "gauge", tag: "2.4",
        title: "Capacity & Licenses", sub: [
          { id: "plan", label: "Plan & tier", icon: "tag" },
          { id: "seats", label: "Seats", icon: "users" },
          { id: "quotas", label: "Message quotas", icon: "chat" },
          { id: "storage", label: "Storage & add-ons", icon: "box" },
          { id: "billing", label: "Billing", icon: "receipt" }
        ]
      }
    ],
    web: SCR_OWNER.web, mobile: SCR_OWNER.mobile,
    tabs: [
      { id: "home", label: "Home", icon: "home" },
      { id: "staff", label: "Staff", icon: "users" },
      { id: "pay", label: "Pay", icon: "banknote" },
      { id: "books", label: "Accounting", icon: "book" },
      { id: "more", label: "More", icon: "dots" }
    ],
    tabParent: {}
  };
  // screen → section (two-tier highlight) + first sub of each section
  OWNER.sectionOf = {}; OWNER.firstOf = {};
  OWNER.sections.forEach(s => {
    if (s.solo) { OWNER.sectionOf[s.id] = s.id; OWNER.firstOf[s.id] = s.id; }
    else { OWNER.firstOf[s.id] = s.sub[0].id; s.sub.forEach(it => OWNER.sectionOf[it.id] = s.id); }
  });
  OWNER.sectionOf["people-profile"] = "staffmgr"; // drill-down from the People roster keeps Staff active

  const PLATFORM = {
    key: "platform", label: "Platform", accent: "platform", icon: "layers",
    appName: "Platform Console", roleLine: "Operator · cross-tenant", domain: "platform",
    twoTier: false,
    nav: [{
      group: "Operate", items: [
        { id: "overview", label: "Overview", icon: "grid" },
        { id: "registrations", label: "KYC & registration", icon: "idcard", count: pendingKyc, when: () => window.REG && REG.kycOn() },
        { id: "tenants", label: "Tenants", icon: "store" },
        { id: "resources", label: "Resources", icon: "gauge" },
        { id: "allocation", label: "Allocation", icon: "sliders" }
      ]
    }, {
      group: "Platform", items: [
        { id: "database", label: "Database & ops", icon: "database" },
        { id: "billing", label: "Billing & licensing", icon: "wallet" },
        { id: "security", label: "Security & audit", icon: "shield" },
        { id: "pusers", label: "Platform users", icon: "users" }
      ]
    }],
    web: SCR_PLATFORM.web, mobile: SCR_PLATFORM.mobile,
    tabs: [
      { id: "overview", label: "Overview", icon: "grid" },
      { id: "registrations", label: "KYC", icon: "idcard", count: pendingKyc, when: () => window.REG && REG.kycOn() },
      { id: "tenants", label: "Tenants", icon: "store" },
      { id: "more", label: "More", icon: "dots" }
    ],
    tabParent: {} // More-menu items deep-link to their web screens (open on web)
  };

  return { staff: STAFF, owner: OWNER, platform: PLATFORM };
})();
window.PERSONA_ORDER = ["staff", "owner", "platform"];
window.PERSONA_META = {
  staff: { who: "STAFF · PWA", h: "The Employee", tag: "Self-service — clock, leave, pay", pts: ["Clock in/out — selfie · GPS · never-block", "My attendance, leave & schedule", "Payslips & earned-to-date", "Inbox — in-app · LINE · WhatsApp"] },
  owner: { who: "OWNER · CONSOLE", h: "The Operator-Owner", tag: "Owner = Manager + HR + Books", pts: ["Staff, attendance, scheduling & leave", "Lao-correct split payroll (NSSF · PIT)", "Accounting, tax & cost/benefit", "Capacity, licenses & integrations"] },
  platform: { who: "PLATFORM · OPERATOR", h: "The Administrator", tag: "Above every shop — cross-tenant", pts: ["Review ID + selfie KYC · activate", "Per-tenant resources & allocation", "DB ops, suspend, break-glass", "Boundary: no salary / PII content"] }
};
