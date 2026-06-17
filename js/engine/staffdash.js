/* ============================================================
   ADEPTIO · staff dashboard builder (manager-owned · SFDC-style)
   ------------------------------------------------------------
   A dynamic dashboard the manager/owner composes for staff:
   • a WIDGET CATALOG grouped by data-source category (the "+ Widget"
     picker) — pick which information frames appear;
   • FREE PLACEMENT on a COLS-wide grid — each widget has {x,y,w,h};
     widgets resize & reposition (drag OR buttons), empty cells allowed;
   • collision-checked so widgets never overlap.
   The Announcements/Alerts widget is FIXED (pinned top, can't be
   moved/removed). Per-tenant; the staff Home reads layout().
   ============================================================ */
window.STAFFDASH = (function () {
  const COLS = 12, MAXH = 2;

  // catalog — available information frames, grouped by data source (widths on a 12-col grid)
  const CATALOG = [
    { cat: "Communication", icon: "megaphone", items: [
      { id: "announcement", label: "Announcements & alerts", icon: "megaphone", fixed: true, w: 12, h: 1, desc: "Manager broadcasts — pinned top" },
      { id: "notices", label: "Notices / inbox", icon: "inbox", w: 6, h: 2, desc: "Latest messages feed" }
    ] },
    { cat: "My time", icon: "clock", items: [
      { id: "hours", label: "Hours this week", icon: "clock", w: 4, h: 1, desc: "Worked hours vs target" },
      { id: "leavebal", label: "Leave balance", icon: "calCheck", w: 4, h: 1, desc: "Annual days remaining" },
      { id: "nextshift", label: "Next shift", icon: "calendar", w: 4, h: 1, desc: "Upcoming rostered shift" },
      { id: "attendance", label: "Attendance summary", icon: "history", w: 6, h: 1, desc: "Present · late · on-time %" },
      { id: "hourstrend", label: "Hours trend", icon: "trend", w: 6, h: 1, desc: "Last 6 weeks worked hours" },
      { id: "holidays", label: "Upcoming holidays", icon: "calendar", w: 4, h: 1, desc: "Next public holidays" }
    ] },
    { cat: "Pay", icon: "banknote", items: [
      { id: "nextpay", label: "Next pay", icon: "banknote", w: 4, h: 1, desc: "Expected take-home + date" },
      { id: "payslip", label: "Payslip summary", icon: "receipt", w: 6, h: 2, desc: "Latest payslip lines" }
    ] },
    { cat: "Schedule", icon: "calendar", items: [
      { id: "shiftline", label: "Shift line-up", icon: "calendar", w: 6, h: 2, desc: "This week's shifts" },
      { id: "openshifts", label: "Open shifts", icon: "swap", w: 4, h: 1, desc: "Shifts to claim" }
    ] },
    { cat: "Team", icon: "users", items: [
      { id: "onshift", label: "Team on shift today", icon: "users", w: 6, h: 1, desc: "Who's working with you" },
      { id: "birthdays", label: "Birthdays this month", icon: "heart", w: 4, h: 1, desc: "Celebrate your teammates" }
    ] },
    { cat: "Approvals", icon: "check", items: [
      { id: "approvals", label: "Approval status", icon: "check", w: 6, h: 2, desc: "Your requests & decisions" }
    ] },
    { cat: "Actions", icon: "power", items: [
      { id: "clock", label: "Clock in/out", icon: "clock", w: 6, h: 1, desc: "Punch with selfie + GPS" },
      { id: "quicklinks", label: "Quick actions", icon: "sparkle", w: 6, h: 1, desc: "Shortcuts — leave · pay · schedule" }
    ] }
  ];
  const META = {}; CATALOG.forEach(c => c.items.forEach(it => META[it.id] = Object.assign({ cat: c.cat }, it)));

  // default board (the shipped Home) — {id, x, y, w, h} on a 12-column grid
  const DEFAULTS = [
    { id: "announcement", x: 0, y: 0, w: 12, h: 1 },
    { id: "hours", x: 0, y: 1, w: 4, h: 1 },
    { id: "leavebal", x: 4, y: 1, w: 4, h: 1 },
    { id: "nextshift", x: 8, y: 1, w: 4, h: 1 },
    { id: "clock", x: 0, y: 2, w: 6, h: 1 },
    { id: "notices", x: 6, y: 2, w: 6, h: 2 },
    { id: "shiftline", x: 0, y: 3, w: 6, h: 2 },
    { id: "approvals", x: 6, y: 4, w: 6, h: 2 }
  ];

  const boards = {};
  const clone = (a) => a.map(w => Object.assign({}, w));
  function board(tid) { tid = tid || DATA.state.tenantId; if (!boards[tid]) boards[tid] = clone(DEFAULTS); return boards[tid]; }
  const placed = (tid) => board(tid);
  const get = (tid, id) => board(tid).find(w => w.id === id);
  const isPlaced = (tid, id) => !!get(tid, id);
  const rows = (tid) => board(tid).reduce((m, w) => Math.max(m, w.y + w.h), 0);

  function overlap(a, b) { return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h; }
  function collides(tid, id, r) {
    if (r.x < 0 || r.y < 0 || r.w < 1 || r.h < 1 || r.h > MAXH || r.x + r.w > COLS) return true;
    return board(tid).some(w => w.id !== id && overlap(w, r));
  }
  // valid move/resize → commit, else reject (returns success)
  function setRect(tid, id, r) {
    const w = get(tid, id); if (!w) return false;
    const nr = { x: r.x, y: r.y, w: r.w, h: r.h };
    if (collides(tid, id, nr)) return false;
    Object.assign(w, nr); audit(tid, id, "placed " + nr.x + "," + nr.y + " · " + nr.w + "×" + nr.h); return true;
  }
  function move(tid, id, dx, dy) { const w = get(tid, id); if (!w || META[id].fixed) return false; return setRect(tid, id, { x: w.x + dx, y: w.y + dy, w: w.w, h: w.h }); }
  function resize(tid, id, dw, dh) { const w = get(tid, id); if (!w) return false; return setRect(tid, id, { x: w.x, y: w.y, w: Math.max(1, Math.min(COLS, w.w + dw)), h: Math.max(1, Math.min(MAXH, w.h + dh)) }); }
  function firstFree(tid, wd, hd) { for (let y = 0; y < 60; y++) for (let x = 0; x + wd <= COLS; x++) { if (!collides(tid, "__new__", { x, y, w: wd, h: hd })) return { x, y }; } return { x: 0, y: rows(tid) }; }
  function add(tid, id) { if (isPlaced(tid, id) || !META[id]) return false; const m = META[id], p = firstFree(tid, m.w, m.h); board(tid).push({ id, x: p.x, y: p.y, w: m.w, h: m.h }); audit(tid, id, "added"); return true; }
  function remove(tid, id) { if (!META[id] || META[id].fixed || !isPlaced(tid, id)) return false; boards[tid] = board(tid).filter(w => w.id !== id); audit(tid, id, "removed"); return true; }
  function available(tid) { return CATALOG.map(c => ({ cat: c.cat, icon: c.icon, items: c.items.filter(it => !isPlaced(tid, it.id)) })).filter(c => c.items.length); }
  const layout = (tid) => board(tid).slice().sort((a, b) => a.y - b.y || a.x - b.x);
  function reset(tid) { tid = tid || DATA.state.tenantId; boards[tid] = clone(DEFAULTS); audit(tid, "board", "reset to default"); }

  // builder UI state (catalog drawer open?)
  let _catalog = false;
  const catalogOpen = () => _catalog;
  function toggleCatalog(v) { _catalog = v == null ? !_catalog : !!v; }

  function audit(tid, id, what) { if (window.DATA && DATA.AUDIT) DATA.AUDIT.unshift({ fact: "staffdash.config", who: "Owner", when: "2026-06-16 10:05", ref: id + " · " + what }); }
  function __reset() { for (const k in boards) delete boards[k]; _catalog = false; }

  return { COLS, MAXH, CATALOG, META, board, placed, get, isPlaced, rows, layout, available, add, remove, setRect, move, resize, reset, catalogOpen, toggleCatalog, collides, __reset };
})();
