/* ============================================================
   ADEPTIO · jobs schedule & shifts — calendar-based rosters
   ------------------------------------------------------------
   • Basic template  = one Full-day shift per day (deterministic).
   • Multi template  = a CONFIGURABLE shift system the owner builds:
       – Shift period   : a period object  (name + start–end + cap)
       – Users group    : a named group of staff
       – Shift group    : binds one Shift period × one Users group
                          → the assignable unit ("Morning · Floor team")
     A day's roster = a list of Shift groups. Each carries its period
     (when) and its users group (who). Shift groups must be created
     before they can be assigned to a day.
   • Calendar (manager):
       – View mode   : click a day → edit its shifts (add/remove groups).
       – Assign mode : select one OR many days → bulk-assign a shift group.
     Days fall back to a seeded weekday/weekend rota until edited.
   • Staff: own shifts (membership-driven); pick a day to swap.
   • Swap → APPROVALS("swap") → manager approval.
   In-memory; recompute-on-render. Reads CAL for holidays/format.
   ============================================================ */
window.SCHED = (function () {
  const DEFS = {
    full: { id: "full", label: "Full day", time: "09:00–18:00", cap: 6 },
    morning: { id: "morning", label: "Morning", time: "08:00–13:00", cap: 4 },
    afternoon: { id: "afternoon", label: "Afternoon", time: "13:00–18:00", cap: 4 },
    evening: { id: "evening", label: "Evening", time: "17:00–21:00", cap: 2 } // overlaps afternoon
  };
  const TEMPLATES = {
    basic: { id: "basic", label: "Basic", sub: "one shift per day", note: "Everyone on a single Full-day 09:00–18:00 shift.", shifts: () => ["full"] },
    multi: { id: "multi", label: "Multi-shift", sub: "shifts vary by day", note: "Build shift periods, users groups and shift groups below, then assign them to days. Weekdays default to Morning + Afternoon + Evening; weekends to a single Full day until you edit them.", shifts: (wknd) => wknd ? ["full"] : ["morning", "afternoon", "evening"] }
  };
  const TODAY = "2026-06-16";
  const DOW_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const state = { y: 2026, m: 5, tmpl: {}, sel: {}, selDate: null, swapOpen: false, swaps: [], cfg: {}, assignMode: false, editDate: null };

  const pad = (n) => String(n).padStart(2, "0");
  const iso = (y, m, d) => y + "-" + pad(m + 1) + "-" + pad(d);
  const dim = (y, m) => new Date(y, m + 1, 0).getDate();
  const dowMon = (y, m, d) => (new Date(y, m, d).getDay() + 6) % 7;
  const isWknd = (y, m, d) => dowMon(y, m, d) >= 5;
  const wkndK = (k) => { const p = k.split("-"); return isWknd(+p[0], +p[1] - 1, +p[2]); };
  const hol = (k) => (window.CAL && CAL.holidayOn) ? CAL.holidayOn(k) : null;
  const fmt = (k) => CAL.fmtShort(k);

  const tmplOf = (tid) => state.tmpl[tid] || "multi";
  function setTemplate(tid, id) {
    if (!TEMPLATES[id]) return { ok: false };
    state.tmpl[tid] = id; state.selDate = null; state.editDate = null; state.assignMode = false; state.sel = {};
    DATA.AUDIT.unshift({ fact: "sched.template", who: "Owner", when: TODAY + " 09:40", ref: ((DATA.byId(tid) || {}).name || tid) + " → " + TEMPLATES[id].label });
    return { ok: true };
  }
  const roster = (tid) => DATA.people(tid).filter(p => p.access === "staff" || p.access === "manager");

  /* ============================================================
     SHIFT CONFIGURATION — periods · users groups · shift groups
     ============================================================ */
  // Seed a believable config on first touch so the calendar isn't empty
  // (the create-first gate still applies once a tenant has zero shift groups).
  function seedCfg(tid) {
    const ros = roster(tid), ids = ros.map(p => p.id);
    const byDiv = (d) => ros.filter(p => p.div === d).map(p => p.id);
    const periods = [
      { id: "P-morning", label: "Morning", start: "08:00", end: "13:00", cap: 4 },
      { id: "P-afternoon", label: "Afternoon", start: "13:00", end: "18:00", cap: 4 },
      { id: "P-evening", label: "Evening", start: "17:00", end: "21:00", cap: 2 },
      { id: "P-full", label: "Full day", start: "09:00", end: "18:00", cap: 6 }
    ];
    const floor = byDiv("Floor"), kitchen = byDiv("Kitchen"), store = byDiv("Store");
    const groups = [];
    if (floor.length) groups.push({ id: "G-floor", label: "Floor team", members: floor });
    if (kitchen.length) groups.push({ id: "G-kitchen", label: "Kitchen team", members: kitchen });
    if (store.length) groups.push({ id: "G-store", label: "Store team", members: store });
    groups.push({ id: "G-all", label: "All staff", members: ids });
    const has = (g) => groups.some(x => x.id === g);
    const gFloor = has("G-floor") ? "G-floor" : (has("G-store") ? "G-store" : "G-all");
    const gKitchen = has("G-kitchen") ? "G-kitchen" : gFloor;
    const shiftGroups = [
      { id: "SG-m-floor", label: "", periodId: "P-morning", groupId: gFloor },
      { id: "SG-a-floor", label: "", periodId: "P-afternoon", groupId: gFloor },
      { id: "SG-e-kitchen", label: "", periodId: "P-evening", groupId: gKitchen },
      { id: "SG-full-all", label: "", periodId: "P-full", groupId: "G-all" }
    ];
    return {
      periods, groups, shiftGroups, assign: {},
      rota: { weekday: ["SG-m-floor", "SG-a-floor", "SG-e-kitchen"], weekend: ["SG-full-all"] },
      seq: { p: 100, g: 100, s: 100 }
    };
  }
  function cfg(tid) { tid = tid || DATA.state.tenantId; if (!state.cfg[tid]) state.cfg[tid] = seedCfg(tid); return state.cfg[tid]; }
  const periodOf = (tid, id) => cfg(tid).periods.find(p => p.id === id);
  const groupOf = (tid, id) => cfg(tid).groups.find(g => g.id === id);
  const shiftGroupOf = (tid, id) => cfg(tid).shiftGroups.find(s => s.id === id);
  function sgLabel(tid, sg) { if (!sg) return "?"; const p = periodOf(tid, sg.periodId), g = groupOf(tid, sg.groupId); return sg.label || ((p ? p.label : "?") + " · " + (g ? g.label : "?")); }
  function sgTime(tid, sg) { const p = periodOf(tid, sg.periodId); return p ? p.start + "–" + p.end : ""; }
  function members(tid, gid) { const g = groupOf(tid, gid); if (!g) return []; const ppl = DATA.people(tid); return g.members.map(uid => ppl.find(p => p.id === uid)).filter(Boolean); }

  /* ---- config CRUD ---- */
  function addPeriod(tid, o) {
    o = o || {}; if (!o.label || !o.start || !o.end) return { ok: false, err: "Name, start and end time are all required" };
    if (o.end <= o.start) return { ok: false, err: "End time must be after start time" };
    const c = cfg(tid), id = "P-" + (++c.seq.p);
    c.periods.push({ id, label: o.label, start: o.start, end: o.end, cap: Math.max(1, parseInt(o.cap, 10) || 4) });
    DATA.AUDIT.unshift({ fact: "sched.period.added", who: "Owner", when: TODAY + " 09:41", ref: o.label + " " + o.start + "–" + o.end });
    return { ok: true, id };
  }
  function removePeriod(tid, id) {
    const c = cfg(tid); if (c.shiftGroups.some(s => s.periodId === id)) return { ok: false, err: "In use by a shift group — remove that shift group first" };
    c.periods = c.periods.filter(p => p.id !== id); return { ok: true };
  }
  function addGroup(tid, o) {
    o = o || {}; if (!o.label) return { ok: false, err: "Group name is required" };
    if (!o.members || !o.members.length) return { ok: false, err: "Pick at least one member for the group" };
    const c = cfg(tid), id = "G-" + (++c.seq.g);
    c.groups.push({ id, label: o.label, members: o.members.slice() });
    DATA.AUDIT.unshift({ fact: "sched.group.added", who: "Owner", when: TODAY + " 09:42", ref: o.label + " · " + o.members.length + " members" });
    return { ok: true, id };
  }
  function removeGroup(tid, id) {
    const c = cfg(tid); if (c.shiftGroups.some(s => s.groupId === id)) return { ok: false, err: "In use by a shift group — remove that shift group first" };
    c.groups = c.groups.filter(g => g.id !== id); return { ok: true };
  }
  function addShiftGroup(tid, o) {
    o = o || {}; if (!o.periodId || !o.groupId) return { ok: false, err: "Choose a shift period and a users group" };
    if (!periodOf(tid, o.periodId) || !groupOf(tid, o.groupId)) return { ok: false, err: "Invalid period or group" };
    const c = cfg(tid), id = "SG-" + (++c.seq.s);
    c.shiftGroups.push({ id, label: (o.label || "").trim(), periodId: o.periodId, groupId: o.groupId });
    DATA.AUDIT.unshift({ fact: "sched.shiftgroup.added", who: "Owner", when: TODAY + " 09:43", ref: sgLabel(tid, c.shiftGroups[c.shiftGroups.length - 1]) });
    return { ok: true, id };
  }
  function removeShiftGroup(tid, id) {
    const c = cfg(tid);
    c.shiftGroups = c.shiftGroups.filter(s => s.id !== id);
    c.rota.weekday = c.rota.weekday.filter(x => x !== id);
    c.rota.weekend = c.rota.weekend.filter(x => x !== id);
    Object.keys(c.assign).forEach(k => { c.assign[k] = c.assign[k].filter(x => x !== id); });
    return { ok: true };
  }

  /* ---- per-day assignment (manual override of the seeded rota) ---- */
  function defaultIds(tid, k) { const c = cfg(tid); return (wkndK(k) ? c.rota.weekend : c.rota.weekday) || []; }
  function assignedIdsFor(tid, k) { const c = cfg(tid); return c.assign[k] != null ? c.assign[k] : defaultIds(tid, k); }
  function assignDays(tid, dates, sgId) {
    if (!sgId) return { ok: false, err: "Pick a shift group to assign" };
    if (!shiftGroupOf(tid, sgId)) return { ok: false, err: "Create a shift group first" };
    if (!dates || !dates.length) return { ok: false, err: "Select at least one day on the calendar" };
    const c = cfg(tid); let n = 0;
    dates.forEach(k => {
      if (hol(k)) return;                                   // holidays stay closed
      const cur = (c.assign[k] != null ? c.assign[k] : defaultIds(tid, k)).slice();
      if (!cur.includes(sgId)) cur.push(sgId);
      c.assign[k] = cur; n++;
    });
    DATA.AUDIT.unshift({ fact: "sched.assigned", who: "Owner", when: TODAY + " 09:44", ref: sgLabel(tid, shiftGroupOf(tid, sgId)) + " → " + n + " day(s)" });
    return { ok: true, n };
  }
  function dayAddShift(tid, k, sgId) { return assignDays(tid, [k], sgId); }
  function dayRemoveShift(tid, k, sgId) {
    const c = cfg(tid); const cur = (c.assign[k] != null ? c.assign[k] : defaultIds(tid, k)).slice();
    c.assign[k] = cur.filter(x => x !== sgId); return { ok: true };
  }
  function dayReset(tid, k) { const c = cfg(tid); delete c.assign[k]; return { ok: true }; }   // back to the seeded rota

  /* ---- shifts on a date ---- */
  // basic template: deterministic Full-day rotation (legacy behaviour)
  function genDay(tid, k) {
    if (hol(k)) return [];
    const p = k.split("-"), y = +p[0], m = +p[1] - 1, d = +p[2], wknd = isWknd(y, m, d);
    const ros = roster(tid); if (!ros.length) return [];
    return TEMPLATES.basic.shifts(wknd).map((sid, s) => {
      const def = DEFS[sid], start = (d * 2 + s * 3) % ros.length, people = [];
      for (let i = 0; i < def.cap; i++) people.push(ros[(start + i) % ros.length]);
      return { def, people };
    });
  }
  // multi template: resolve the day's assigned shift groups → {def, people, sg}
  function genMulti(tid, k) {
    if (hol(k)) return [];
    return assignedIdsFor(tid, k).map(id => {
      const sg = shiftGroupOf(tid, id); if (!sg) return null;
      return { sg, def: { id: sg.id, label: sgLabel(tid, sg), time: sgTime(tid, sg), periodId: sg.periodId, groupId: sg.groupId }, people: members(tid, sg.groupId) };
    }).filter(Boolean);
  }
  function slotsFor(tid, k) { return tmplOf(tid) === "multi" ? genMulti(tid, k) : genDay(tid, k); }
  function dayHeads(tid, k) { const set = new Set(); slotsFor(tid, k).forEach(sh => sh.people.forEach(p => set.add(p.id))); return set.size; }
  function myShifts(tid, k, uid) { return slotsFor(tid, k).filter(sh => sh.people.some(p => p.id === uid)); }

  /* ---- state mutators ---- */
  function nav(dir) { let { y, m } = state; m += dir === "next" ? 1 : -1; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } state.y = y; state.m = m; }
  function toToday() { state.y = 2026; state.m = 5; }
  function pickDay(k) { if (state.sel[k]) delete state.sel[k]; else state.sel[k] = true; }
  const selected = () => Object.keys(state.sel).sort();
  function clearSel() { state.sel = {}; }
  function setSelDate(k) { state.selDate = state.selDate === k ? null : k; }
  function openSwap(v) { state.swapOpen = v; if (!v) clearSel(); }
  function setAssignMode(v) { state.assignMode = !!v; if (state.assignMode) state.editDate = null; else state.sel = {}; }
  function openEdit(k) { state.editDate = state.editDate === k ? null : k; }
  function closeEdit() { state.editDate = null; }

  /* ---- swaps → approvals ---- */
  function requestSwap(tid, uid, dates, toName, note) {
    if (!dates || !dates.length) return { ok: false, err: "Pick a shift day on the calendar first" };
    const me = (DATA.people(tid).find(x => x.id === uid)) || DATA.me(), ds = dates.slice().sort();
    const detail = "Swap " + ds.map(fmt).join(", ") + " → " + (toName || "open shift") + (note ? " · “" + note + "”" : "");
    const rec = { id: "SW-" + (state.swaps.length + 1), tid, uid, who: me.name, dates: ds, to: toName || "open shift", note: note || "", state: "pending" };
    state.swaps.unshift(rec);
    if (window.APPROVALS) APPROVALS.request(tid, "swap", { who: me.name, detail });
    DATA.AUDIT.unshift({ fact: "sched.swap_requested", who: me.name, when: TODAY + " 09:45", ref: detail });
    state.sel = {}; state.swapOpen = false;
    return { ok: true, rec };
  }
  const mySwaps = (tid, uid) => state.swaps.filter(s => s.tid === tid && s.uid === uid);

  /* ============================================================
     RENDER — month tables (.mtbl), 3-month window
     ============================================================ */
  function mgrBlock(tid, y, m) {
    const n = dim(y, m), lead = dowMon(y, m, 1), slots = [], multi = tmplOf(tid) === "multi";
    for (let i = 0; i < lead; i++) slots.push(null);
    for (let d = 1; d <= n; d++) slots.push(d);
    while (slots.length % 7) slots.push(null);
    let rows = "";
    for (let w = 0; w < slots.length; w += 7) {
      rows += "<tr>" + slots.slice(w, w + 7).map(d => {
        if (d == null) return `<td class="mc mc-empty"></td>`;
        const k = iso(y, m, d), h = hol(k), today = k === TODAY;
        if (h) return `<td class="mc hol" title="${UI.esc(h.name)}"><span class="sc-d">${d}</span></td>`;
        const sh = slotsFor(tid, k), heads = dayHeads(tid, k), nshift = sh.length;
        const picked = state.assignMode ? !!state.sel[k] : (state.editDate === k || state.selDate === k);
        const act = state.assignMode ? `sched:pick:${k}` : (multi ? `sched:edit:${k}` : `sched:day:${k}`);
        const cls = ["mc", "sc", today ? "today" : "", picked ? "sel" : "", nshift ? "" : "empty-day"].filter(Boolean).join(" ");
        const note = nshift ? `${heads}p${nshift > 1 ? ` · ${nshift}×` : ""}` : (multi ? "+ add" : "—");
        const tip = nshift ? sh.map(s => s.def.label + (s.def.time ? " " + s.def.time : "")).join(" · ") : (multi ? "No shifts — click to add" : "");
        return `<td class="${cls}" data-act="${act}" title="${UI.esc(tip)}"><span class="sc-d">${d}</span><span class="sc-n">${note}</span></td>`;
      }).join("") + "</tr>";
    }
    return `<div class="mcal-month"><div class="mcal-mt">${CAL.MONTHS[m]} ${y}</div><table class="mtbl sctbl"><thead><tr>${CAL.DOW.map(w => `<th>${w}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div>`;
  }
  function staffBlock(tid, y, m, uid) {
    const n = dim(y, m), lead = dowMon(y, m, 1), slots = [];
    for (let i = 0; i < lead; i++) slots.push(null);
    for (let d = 1; d <= n; d++) slots.push(d);
    while (slots.length % 7) slots.push(null);
    let rows = "";
    for (let w = 0; w < slots.length; w += 7) {
      rows += "<tr>" + slots.slice(w, w + 7).map(d => {
        if (d == null) return `<td class="mc mc-empty"></td>`;
        const k = iso(y, m, d), h = hol(k), today = k === TODAY, seld = !!state.sel[k];
        if (h) return `<td class="mc hol" title="${UI.esc(h.name)}"><span class="sc-d">${d}</span></td>`;
        const mine = myShifts(tid, k, uid);
        if (!mine.length) return `<td class="mc sc off"><span class="sc-d">${d}</span></td>`;
        const tag = mine.map(s => s.def.label[0]).join("·");
        const cls = ["mc", "sc", "sc-on", today ? "today" : "", seld ? "sel" : ""].filter(Boolean).join(" ");
        return `<td class="${cls}" data-act="sched:pick:${k}" title="${UI.esc(mine.map(s => s.def.label + " " + s.def.time).join(" · "))}"><span class="sc-d">${d}</span><span class="sc-n">${tag}</span></td>`;
      }).join("") + "</tr>";
    }
    return `<div class="mcal-month"><div class="mcal-mt">${CAL.MONTHS[m]} ${y}</div><table class="mtbl sctbl"><thead><tr>${CAL.DOW.map(w => `<th>${w}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div>`;
  }
  function navBar() {
    const lastM = (state.m + 2) % 12, lastY = state.y + Math.floor((state.m + 2) / 12);
    return `<div class="mcal-head"><button class="iconbtn" data-act="sched:nav:prev">${UI.icon("chevL")}</button><div class="mcal-title">${CAL.MONTHS[state.m]} – ${CAL.MONTHS[lastM]} ${lastY}</div><button class="iconbtn" data-act="sched:nav:next">${UI.icon("chevR")}</button><button class="btn xs ghost" data-act="sched:today">Today</button></div>`;
  }
  function calendar(tid, opts) {
    opts = opts || {}; let blocks = "";
    for (let i = 0; i < 3; i++) { let mm = state.m + i, yy = state.y; while (mm > 11) { mm -= 12; yy++; } blocks += opts.uid ? staffBlock(tid, yy, mm, opts.uid) : mgrBlock(tid, yy, mm); }
    const key = (c, l) => `<span class="mcal-key"><span class="mcal-sw ${c}"></span>${l}</span>`;
    const legend = opts.uid
      ? `<div class="mcal-legend">${key("sc-on", "Your shift")}${key("sel", "Selected")}${key("today", "Today")}${key("off", "Off")}${key("hol", "Holiday")}<span class="mcal-key">Letters = Morning · Afternoon · Evening · Full</span></div>`
      : `<div class="mcal-legend"><span class="mcal-key">Number = people on shift · <b>N×</b> = multi-shift day · ${state.assignMode ? "click days to select, then assign" : "click a day to edit its shifts"}</span>${key("hol", "Holiday (closed)")}</div>`;
    return `<div class="mcal">${navBar()}<div class="mcal-wrap">${blocks}</div>${legend}</div>`;
  }

  /* ---- manager: read-only names per shift (BASIC template) ---- */
  function dayDetail(tid) {
    if (!state.selDate) return "";
    const k = state.selDate, sh = slotsFor(tid, k);
    const inner = sh.length
      ? sh.map(s => `<div class="sc-block">
          <div class="sc-bh"><b>${UI.esc(s.def.label)}</b> <span class="muted">${s.def.time}</span> <span class="badge plain">${s.people.length} people</span></div>
          <div class="sc-people">${s.people.map(p => `<span class="chip">${UI.initials(p.name)} ${UI.esc(p.name.split(" ")[0])}</span>`).join("")}</div>
        </div>`).join("")
      : UI.empty("calendar", "Closed", "Public holiday — no shifts");
    return UI.card("Shifts · " + fmt(k) + " 2026", inner, { icon: "users", badge: sh.length ? `<span class="badge plain">${dayHeads(tid, k)} on the day</span>` : "" });
  }

  /* ============================================================
     RENDER — shift configuration (MULTI template) + assignment UI
     ============================================================ */
  function cfgPeriods(tid) {
    const c = cfg(tid);
    const list = c.periods.length ? `<div class="se-list">${c.periods.map(p => `<div class="se-item">
        <div class="se-main"><span class="se-nm">${UI.esc(p.label)}</span><span class="se-sub">${p.start}–${p.end} · cap ${p.cap}</span></div>
        <button class="se-rm" data-act="sched:rmperiod:${p.id}" title="Remove period" aria-label="Remove ${UI.esc(p.label)}">${UI.icon("x")}</button>
      </div>`).join("")}</div>` : UI.empty("clock", "No shift periods", "Add a period to begin");
    const form = `<div class="se-form">
      <input class="input" data-sp="label" placeholder="Shift name (e.g. Night)">
      <label class="se-tl">Start <input class="input" type="time" data-sp="start" value="09:00"></label>
      <label class="se-tl">End <input class="input" type="time" data-sp="end" value="18:00"></label>
      <label class="se-tl">Cap <input class="input" type="number" min="1" max="99" data-sp="cap" value="4"></label>
      <button class="btn sm" data-act="sched:addperiod">${UI.icon("plus")} Add period</button>
    </div>`;
    return `<div class="se-listwrap">${list}</div>${form}`;
  }
  function cfgGroups(tid) {
    const c = cfg(tid), ros = roster(tid);
    const list = c.groups.length ? `<div class="se-list">${c.groups.map(g => `<div class="se-item">
        <div class="se-main"><span class="se-nm">${UI.esc(g.label)}</span><span class="se-sub">${g.members.length} member${g.members.length !== 1 ? "s" : ""}${g.members.length ? " · " + members(tid, g.id).slice(0, 4).map(p => p.name.split(" ")[0]).join(", ") + (g.members.length > 4 ? " +" + (g.members.length - 4) : "") : ""}</span></div>
        <button class="se-rm" data-act="sched:rmgroup:${g.id}" title="Remove group" aria-label="Remove ${UI.esc(g.label)}">${UI.icon("x")}</button>
      </div>`).join("")}</div>` : UI.empty("users", "No users groups", "Group staff to assign together");
    const form = `<div class="se-form col">
      <input class="input" data-ug="label" placeholder="Group name (e.g. Weekend crew)">
      <select class="input se-ms" data-ug="members" multiple size="5" aria-label="Members">${ros.map(p => `<option value="${p.id}">${UI.esc(p.name)} · ${UI.esc(p.role)}</option>`).join("")}</select>
      <div class="se-frow"><span class="se-hint">Ctrl/⌘-click to pick several</span><button class="btn sm" data-act="sched:addgroup">${UI.icon("plus")} Add group</button></div>
    </div>`;
    return `<div class="se-listwrap">${list}</div>${form}`;
  }
  function cfgShiftGroups(tid) {
    const c = cfg(tid);
    const list = c.shiftGroups.length ? `<div class="se-list">${c.shiftGroups.map(sg => `<div class="se-item">
        <div class="se-main"><span class="se-nm">${UI.esc(sgLabel(tid, sg))}</span><span class="se-sub">${sgTime(tid, sg)} · ${members(tid, sg.groupId).length} people</span></div>
        <button class="se-rm" data-act="sched:rmsg:${sg.id}" title="Remove shift group" aria-label="Remove ${UI.esc(sgLabel(tid, sg))}">${UI.icon("x")}</button>
      </div>`).join("")}</div>` : UI.empty("layers", "No shift groups yet", "Bind a period × a group below — required before you can assign shifts to a day");
    const gate = !c.periods.length || !c.groups.length;
    const form = gate
      ? `<p class="se-hint pad">Add at least one shift period and one users group first.</p>`
      : `<div class="se-form col">
        <div class="se-frow">
          <select class="input" data-sg="period" aria-label="Shift period">${c.periods.map(p => `<option value="${p.id}">${UI.esc(p.label)} (${p.start}–${p.end})</option>`).join("")}</select>
          <span class="se-x">×</span>
          <select class="input" data-sg="group" aria-label="Users group">${c.groups.map(g => `<option value="${g.id}">${UI.esc(g.label)}</option>`).join("")}</select>
        </div>
        <div class="se-frow"><input class="input" data-sg="label" placeholder="Label (optional — defaults to “Period · Group”)"><button class="btn sm" data-act="sched:addsg">${UI.icon("plus")} Create</button></div>
      </div>`;
    return `<div class="se-listwrap">${list}</div>${form}`;
  }
  function config(tid) {
    return `<div class="grid cols-3 se-cfg">
      ${UI.card("① Shift periods", cfgPeriods(tid), { icon: "clock", badge: `<span class="badge plain">when</span>` })}
      ${UI.card("② Users groups", cfgGroups(tid), { icon: "users", badge: `<span class="badge plain">who</span>` })}
      ${UI.card("③ Shift groups", cfgShiftGroups(tid), { icon: "layers", badge: `<span class="badge ${cfg(tid).shiftGroups.length ? "plain" : "warn"}">period × group</span>` })}
    </div>`;
  }

  // assign-mode toolbar (View / Assign) above the calendar
  function assignToolbar(tid) {
    return `<div class="se-tools">
      <div class="seg sm">
        <button aria-pressed="${!state.assignMode}" data-act="sched:assignmode:off">${UI.icon("eye")} View &amp; edit</button>
        <button aria-pressed="${state.assignMode}" data-act="sched:assignmode:on">${UI.icon("calCheck")} Assign shifts</button>
      </div>
      <span class="small muted">${state.assignMode ? "Click days to select — one or many — then assign a shift group below." : "Click any day to edit the shift groups assigned to it."}</span>
    </div>`;
  }
  // bulk-assign bar (assign mode) — gated on having a shift group
  function assignBar(tid) {
    if (!state.assignMode) return "";
    const c = cfg(tid), sel = selected(), nl = sel.length;
    if (!c.shiftGroups.length) return `<div class="se-bar warn">${UI.icon("alert")}<span>Create a shift group first — none exist yet, so there's nothing to assign.</span></div>`;
    const opts = c.shiftGroups.map(sg => `<option value="${sg.id}">${UI.esc(sgLabel(tid, sg))}</option>`).join("");
    return `<div class="se-bar">
      <span class="se-barlbl">${nl} day${nl !== 1 ? "s" : ""} selected</span>
      <select class="input" data-sg-assign aria-label="Shift group to assign" ${nl ? "" : "disabled"}>${opts}</select>
      <button class="btn sm" data-act="sched:assignsel" ${nl ? "" : "disabled"}>${UI.icon("plus")} Assign to ${nl} day${nl !== 1 ? "s" : ""}</button>
      <button class="btn sm ghost" data-act="sched:clearsel" ${nl ? "" : "disabled"}>Clear</button>
    </div>`;
  }
  // single-day editor (view mode, multi template) — add/remove shift groups
  function dayEditor(tid) {
    if (!state.editDate) return "";
    const k = state.editDate, c = cfg(tid), isHol = hol(k);
    const p = k.split("-"), dow = DOW_FULL[dowMon(+p[0], +p[1] - 1, +p[2])];
    const slots = slotsFor(tid, k), assigned = assignedIdsFor(tid, k);
    const avail = c.shiftGroups.filter(sg => !assigned.includes(sg.id));
    const isOverride = c.assign[k] != null;
    let body;
    if (isHol) {
      body = `<div class="se-empty">${UI.icon("calendar")}<div><b>${UI.esc(isHol.name)}</b><div class="small muted">Public holiday — closed, no shifts.</div></div></div>`;
    } else {
      const rows = slots.length ? slots.map(s => `<div class="se-slot">
          <div class="se-main"><span class="se-nm">${UI.esc(s.def.label)}</span><span class="se-sub">${s.def.time} · ${s.people.length} people</span></div>
          <button class="se-rm" data-act="sched:dayremove:${k}:${s.def.id}" title="Remove from this day" aria-label="Remove ${UI.esc(s.def.label)}">${UI.icon("x")}</button>
        </div>`).join("") : `<div class="se-empty small muted">No shifts on this day yet.</div>`;
      let add;
      if (!c.shiftGroups.length) add = `<div class="se-gate">${UI.icon("alert")}<span>No shift groups exist yet. Create one under <b>③ Shift groups</b> above before you can assign shifts.</span></div>`;
      else if (!avail.length) add = `<p class="se-hint pad">All shift groups are already on this day.</p>`;
      else add = `<div class="se-frow se-add"><select class="input" data-sg-add aria-label="Add shift group">${avail.map(sg => `<option value="${sg.id}">${UI.esc(sgLabel(tid, sg))} · ${sgTime(tid, sg)}</option>`).join("")}</select><button class="btn sm" data-act="sched:dayadd:${k}">${UI.icon("plus")} Add shift</button></div>`;
      body = `<div class="se-slots">${rows}</div>${add}`;
    }
    return `<div class="dp-backdrop" data-act="sched:edit-close"></div>
      <div class="dp-modal" role="dialog" aria-modal="true" aria-label="Edit shifts for ${fmt(k)}">
        <div class="dp-head">
          <div class="dp-date"><span class="dp-dow">${dow}${k === TODAY ? ` <span class="badge ok">Today</span>` : ""}${isOverride ? ` <span class="badge plain">edited</span>` : ` <span class="badge plain">auto</span>`}</span><span class="dp-full">${fmt(k)} 2026 · ${slots.length} shift${slots.length !== 1 ? "s" : ""}</span></div>
          <button class="iconbtn dp-x" data-act="sched:edit-close" aria-label="Close">${UI.icon("x")}</button>
        </div>
        <div class="dp-body">${body}</div>
        <div class="dp-foot"><button class="btn sm ghost" data-act="sched:dayreset:${k}" ${isOverride && !isHol ? "" : "disabled"}>${UI.icon("refresh")} Reset to default</button><button class="btn sm ghost" data-act="sched:edit-close">Close</button></div>
      </div>`;
  }

  function __reset() { state.y = 2026; state.m = 5; state.tmpl = {}; state.sel = {}; state.selDate = null; state.swapOpen = false; state.swaps = []; state.cfg = {}; state.assignMode = false; state.editDate = null; }

  return {
    DEFS, TEMPLATES, state, tmplOf, setTemplate, roster, genDay, genMulti, slotsFor, dayHeads, myShifts,
    cfg, periodOf, groupOf, shiftGroupOf, sgLabel, sgTime, members,
    addPeriod, removePeriod, addGroup, removeGroup, addShiftGroup, removeShiftGroup,
    defaultIds, assignedIdsFor, assignDays, dayAddShift, dayRemoveShift, dayReset,
    nav, toToday, pickDay, selected, clearSel, setSelDate, openSwap, setAssignMode, openEdit, closeEdit, requestSwap, mySwaps,
    calendar, dayDetail, navBar, config, assignToolbar, assignBar, dayEditor, __reset
  };
})();
