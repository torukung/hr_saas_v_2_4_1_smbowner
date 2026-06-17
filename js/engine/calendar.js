/* ============================================================
   ADEPTIO · calendar engine  (BO — leave + team absence)
   ------------------------------------------------------------
   One engine drives two surfaces:
   • staff   — interactive month picker → request leave (→ approvals)
   • owner   — Team Absence Calendar: per-person × day grid showing
     availability (leave / sick / holiday / split / take / off),
     scheduling synced from WORK, plus add-a-holiday.
   Pure in-memory; recompute-on-render like the rest of the demo.
   ============================================================ */
window.CAL = (function () {
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const MON3 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]; // Monday-first to match the references
  const TODAY = "2026-06-16"; // demo "today"

  /* ---- leave catalogue (Lao-appropriate) ---- */
  const LEAVE_TYPES = [
    { id: "annual", label: "Annual leave", tone: "leave" },
    { id: "sick", label: "Sick leave (paid)", tone: "sick" },
    { id: "business", label: "Business leave", tone: "leave" },
    { id: "birthday", label: "Birthday leave", tone: "leave" },
    { id: "compassionate", label: "Compassionate (bereavement)", tone: "leave" },
    { id: "marriage", label: "Marriage leave", tone: "leave" },
    { id: "maternity", label: "Maternity leave", tone: "leave" },
    { id: "paternity", label: "Paternity leave", tone: "leave" },
    { id: "ordination", label: "Ordination / religious leave", tone: "leave" },
    { id: "study", label: "Study / exam leave", tone: "leave" },
    { id: "military", label: "Military service leave", tone: "leave" },
    { id: "unpaid", label: "Unpaid leave", tone: "leave" }
  ];
  const leaveType = (id) => LEAVE_TYPES.find(t => t.id === id);

  /* ---- public holidays (Lao PDR 2026, demo set; owner-extendable) ---- */
  let HOLIDAYS = [
    { date: "2026-01-01", name: "International New Year's Day", scope: "public" },
    { date: "2026-03-08", name: "International Women's Day", scope: "public" },
    { date: "2026-04-14", name: "Lao New Year (Pi Mai)", scope: "public" },
    { date: "2026-04-15", name: "Lao New Year (Pi Mai)", scope: "public" },
    { date: "2026-04-16", name: "Lao New Year (Pi Mai)", scope: "public" },
    { date: "2026-05-01", name: "International Labour Day", scope: "public" },
    { date: "2026-06-01", name: "International Children's Day", scope: "public" },
    { date: "2026-12-02", name: "Lao National Day", scope: "public" }
  ];
  const holidayOn = (iso) => HOLIDAYS.find(h => h.date === iso);
  function addHoliday(date, name, scope) {
    if (!date || !name) return { ok: false, err: "Date and name are required" };
    if (holidayOn(date)) return { ok: false, err: "A holiday already exists on that day" };
    HOLIDAYS.push({ date, name, scope: scope || "company" });
    HOLIDAYS.sort((a, b) => a.date < b.date ? -1 : 1);
    DATA.AUDIT.unshift({ fact: "holiday.added", who: "Owner", when: TODAY + " 09:20", ref: date + " · " + name });
    return { ok: true };
  }
  function holidaysIn(y, m) { const pre = y + "-" + pad(m + 1); return HOLIDAYS.filter(h => h.date.indexOf(pre) === 0); }
  function upcoming(n) { return HOLIDAYS.filter(h => h.date >= TODAY).slice(0, n || 4); }

  /* ---- date helpers (no TZ surprises; ISO strings sort) ---- */
  const pad = (n) => String(n).padStart(2, "0");
  const iso = (y, m, d) => y + "-" + pad(m + 1) + "-" + pad(d);
  const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
  const domMonFirst = (y, m, d) => (new Date(y, m, d).getDay() + 6) % 7; // 0=Mon … 6=Sun
  const isWeekend = (y, m, d) => domMonFirst(y, m, d) >= 5;
  function fmtShort(isoStr) { const p = isoStr.split("-"); return parseInt(p[2], 10) + " " + MON3[parseInt(p[1], 10) - 1]; }
  function fmtRange(from, to) { return from === to ? fmtShort(from) : fmtShort(from) + "–" + fmtShort(to); }
  function spanDates(from, to) { const out = []; let s = from; while (s <= to) { out.push(s); const d = new Date(s); d.setDate(d.getDate() + 1); s = iso(d.getFullYear(), d.getMonth(), d.getDate()); } return out; }

  /* ---- view + selection state ---- */
  const state = { y: 2026, m: 5, leaveOpen: false, sel: {}, type: "annual", dayOpen: null, fixOpen: false, fixDate: null, fixEvidence: false, fixNote: "" }; // m=5 → June
  function nav(dir) { let { y, m } = state; m += (dir === "next" ? 1 : -1); if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } state.y = y; state.m = m; }
  function openDay(isoStr) { state.dayOpen = isoStr || null; }
  function closeDay() { state.dayOpen = null; }
  // attendance fix-request (staff): correct one non-present record → manager approval
  function openFix(v) { state.fixOpen = !!v; if (!v) { state.fixDate = null; state.fixEvidence = false; state.fixNote = ""; } }
  function pickFix(isoStr) { state.fixDate = state.fixDate === isoStr ? null : isoStr; }
  function attachFix() { state.fixEvidence = !state.fixEvidence; }
  function toggleDay(d) { const k = iso(state.y, state.m, d); if (state.sel[k]) delete state.sel[k]; else state.sel[k] = true; }
  function toggleDate(isoStr) { if (!isoStr) return; if (state.sel[isoStr]) delete state.sel[isoStr]; else state.sel[isoStr] = true; }
  const selected = () => Object.keys(state.sel).sort();
  function clearSel() { state.sel = {}; }
  function openLeave(v) { state.leaveOpen = v; if (!v) clearSel(); }
  // start / end / count / return-to-work from the current selection (links the form to the calendar)
  function selSummary() {
    const s = selected(); if (!s.length) return { from: null, to: null, days: 0, returning: null };
    const from = s[0], to = s[s.length - 1], d = new Date(to); d.setDate(d.getDate() + 1);
    return { from, to, days: s.length, returning: iso(d.getFullYear(), d.getMonth(), d.getDate()) };
  }

  /* ---- leave records (read from DATA.LEAVE_REQS) ---- */
  function leaveFor(uid, name) {
    return DATA.LEAVE_REQS.filter(l => l.uid === uid || l.who === name);
  }
  // expand a person's leave to a {iso: rec} map
  function leaveMap(uid, name) {
    const map = {};
    leaveFor(uid, name).forEach(l => { spanDates(l.from, l.to || l.from).forEach(d => { map[d] = l; }); });
    return map;
  }
  function requestLeave(uid, typeId, dates, note) {
    if (!dates || !dates.length) return { ok: false, err: "Pick at least one day on the calendar" };
    const t = leaveType(typeId); if (!t) return { ok: false, err: "Choose a leave type" };
    const ds = dates.slice().sort(), from = ds[0], to = ds[ds.length - 1];
    const p = (DATA.people().find(x => x.id === uid)) || DATA.me();
    const rec = { id: "LV-" + (250 + DATA.LEAVE_REQS.length), uid, who: p.name, type: t.label, typeId, tone: t.tone, days: ds.length, from, to, dates: ds, status: "pending", note: note || "" };
    DATA.LEAVE_REQS.unshift(rec);
    if (window.APPROVALS) APPROVALS.request(DATA.state.tenantId, "leave", { who: p.name, detail: t.label + " · " + ds.length + "d · " + fmtRange(from, to) + (note ? " · “" + note + "”" : "") });
    DATA.AUDIT.unshift({ fact: "leave.requested", who: p.name, when: TODAY + " 09:10", ref: t.label + " " + ds.length + "d (" + fmtRange(from, to) + ")" });
    return { ok: true, rec };
  }

  /* ---- per-person daily status for the team grid ---- */
  // deterministic roster pattern → working / off / split / take, overlaid by leave + holiday
  function dayCell(p, idx, y, m, d) {
    const isoD = iso(y, m, d), dow = domMonFirst(y, m, d), hol = holidayOn(isoD);
    if (hol) return { k: "holiday", t: hol.name };
    const lv = leaveMap(p.id, p.name)[isoD];
    if (lv) return { k: lv.tone === "sick" ? "sick" : "leave", t: lv.type + (lv.status === "pending" ? " · pending" : ""), pending: lv.status === "pending" };
    if (dow === 6) return { k: "off", t: "Weekly rest (Sun)" };          // everyone off Sunday
    if (dow === (idx % 6)) return { k: "off", t: "Rostered day off" };     // personal off-day
    if (dow === 2 && idx % 3 === 0) return { k: "split", t: "Split shift · 09–13 · 17–21" };
    if (dow === 4 && idx % 4 === 1) return { k: "take", t: "Picked-up open shift" };
    return { k: "work", t: "Working · 09:00–18:00" };
  }
  function teamMonth(tid, y, m) {
    y = y == null ? state.y : y; m = m == null ? state.m : m;
    const ppl = DATA.people(tid), n = daysInMonth(y, m);
    const days = []; for (let d = 1; d <= n; d++) days.push({ d, dow: domMonFirst(y, m, d), wknd: isWeekend(y, m, d), hol: holidayOn(iso(y, m, d)), today: iso(y, m, d) === TODAY });
    const rows = ppl.map((p, idx) => ({ p, cells: days.map(dd => dayCell(p, idx, y, m, dd.d)) }));
    // tallies
    let onleave = 0, sick = 0; rows.forEach(r => r.cells.forEach(c => { if (c.k === "leave") onleave++; if (c.k === "sick") sick++; }));
    return { y, m, days, rows, holidays: holidaysIn(y, m), onleave, sick };
  }

  /* ============================================================
     RENDER — interactive month picker (staff leave selection)
     ============================================================ */
  // one month rendered as a real <table> — fixed layout = 7 equal columns, real
  // rows, never overflows or overlaps (robust + responsive at any width)
  function monthBlock(y, m) {
    const n = daysInMonth(y, m), lead = domMonFirst(y, m, 1);
    const mymap = leaveMap(DATA.me().id, DATA.me().name);
    const slots = []; for (let i = 0; i < lead; i++) slots.push(null);
    for (let d = 1; d <= n; d++) slots.push(d);
    while (slots.length % 7) slots.push(null);
    let rows = "";
    for (let w = 0; w < slots.length; w += 7) {
      rows += "<tr>" + slots.slice(w, w + 7).map(d => {
        if (d == null) return `<td class="mc mc-empty"></td>`;
        const k = iso(y, m, d), hol = holidayOn(k), wknd = isWeekend(y, m, d), today = k === TODAY, seld = !!state.sel[k];
        const rec = mymap[k], booked = rec ? (rec.status === "approved" ? "appr" : "pend") : "", past = k < TODAY && !rec && !seld;
        const cls = ["mc", wknd ? "wknd" : "", today ? "today" : "", booked, hol ? "hol" : "", past ? "past" : "", seld ? "sel" : ""].filter(Boolean).join(" ");
        const title = hol ? hol.name : rec ? rec.type + " · " + rec.status : "";
        const act = hol ? "" : `data-act="leave:pick:${k}"`;
        return `<td class="${cls}" ${act} ${title ? `title="${UI.esc(title)}"` : ""}>${d}</td>`;
      }).join("") + "</tr>";
    }
    return `<div class="mcal-month"><div class="mcal-mt">${MONTHS[m]} ${y}</div><table class="mtbl"><thead><tr>${DOW.map(w => `<th>${w}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div>`;
  }
  function monthPicker(opts) {
    opts = opts || {}; const months = opts.months || 1;
    const lastM = (state.m + months - 1) % 12, lastY = state.y + Math.floor((state.m + months - 1) / 12);
    const range = months > 1 ? `${MONTHS[state.m]} – ${MONTHS[lastM]} ${lastY}` : `${MONTHS[state.m]} ${state.y}`;
    const head = `<div class="mcal-head"><button class="iconbtn" data-act="cal:nav:prev" aria-label="Previous month">${UI.icon("chevL")}</button><div class="mcal-title">${range}</div><button class="iconbtn" data-act="cal:nav:next" aria-label="Next month">${UI.icon("chevR")}</button></div>`;
    let blocks = "";
    for (let i = 0; i < months; i++) { let mm = state.m + i, yy = state.y; while (mm > 11) { mm -= 12; yy++; } blocks += monthBlock(yy, mm); }
    const legend = `<div class="mcal-legend">${chip("sel", "Selected")}${chip("today", "Today")}${chip("appr", "Approved")}${chip("pend", "Pending")}${chip("hol", "Holiday")}${chip("wknd", "Weekend")}</div>`;
    return `<div class="mcal">${head}<div class="mcal-wrap">${blocks}</div>${legend}</div>`;
  }
  const chip = (c, l) => `<span class="mcal-key"><span class="mcal-sw ${c}"></span>${l}</span>`;

  /* ============================================================
     RENDER — Team Absence Calendar (owner)
     ============================================================ */
  function teamGrid(tid) {
    const tm = teamMonth(tid);
    // every day column is clickable → opens the day-summary popup (on shift · on leave · callable)
    const colHead = `<div class="tcal-corner">Staff · ${tm.rows.length}</div>` + tm.days.map(dd => {
      const k = iso(tm.y, tm.m, dd.d), sel = state.dayOpen === k;
      const tip = (dd.hol ? dd.hol.name + " · " : "") + "Open " + DOW[dd.dow] + " " + dd.d + " — on shift, on leave & who's callable";
      return `<div class="tcal-dh clickable ${dd.wknd ? "wknd" : ""} ${dd.hol ? "hol" : ""} ${dd.today ? "today" : ""} ${sel ? "sel" : ""}" data-act="cal:day:${k}" role="button" tabindex="0" title="${UI.esc(tip)}"><span class="tcal-dow">${DOW[dd.dow][0]}</span><span class="tcal-dn">${dd.d}</span></div>`;
    }).join("");
    const body = tm.rows.map(r => {
      const cells = r.cells.map((c, ci) => {
        const dd = tm.days[ci], k = iso(tm.y, tm.m, dd.d), sel = state.dayOpen === k;
        const lbl = c.k === "split" ? "S" : c.k === "take" ? "T" : c.k === "holiday" ? "H" : "";
        return `<div class="tcal-c clickable ${c.k}${c.pending ? " pending" : ""}${sel ? " sel" : ""}" data-act="cal:day:${k}" title="${UI.esc(r.p.name + " · " + c.t)}">${lbl}</div>`;
      }).join("");
      return `<div class="tcal-row"><div class="tcal-name"><span class="avatar xs">${UI.initials(r.p.name)}</span><span class="tcal-nm">${r.p.name}</span></div>${cells}</div>`;
    }).join("");
    return `<div class="tcal-scroll"><div class="tcal" style="--cols:${tm.days.length}"><div class="tcal-head">${colHead}</div>${body}</div></div>`;
  }
  function teamLegend() {
    const k = (c, l) => `<span class="tcal-key"><span class="tcal-sw ${c}"></span>${l}</span>`;
    return `<div class="tcal-legendrow">${k("work", "Working")}${k("off", "Day off")}${k("leave", "Leave")}${k("sick", "Sick")}${k("split", "Split shift")}${k("take", "Picked-up")}${k("holiday", "Holiday")}${k("pending", "Pending")}</div>`;
  }
  function navBar() {
    return `<div class="mcal-head" style="justify-content:flex-start;gap:14px"><button class="iconbtn" data-act="cal:nav:prev">${UI.icon("chevL")}</button><div class="mcal-title">${MONTHS[state.m]} ${state.y}</div><button class="iconbtn" data-act="cal:nav:next">${UI.icon("chevR")}</button><button class="btn xs ghost" data-act="cal:today">Today</button></div>`;
  }

  /* ============================================================
     DAY SUMMARY — click any date → who's on shift, on leave, callable
     ============================================================ */
  // bucket the whole roster for one ISO day, reusing the same dayCell()
  // logic that paints the grid (so the popup never disagrees with it).
  function daySummary(tid, isoStr) {
    const p = isoStr.split("-"), yy = +p[0], mm = +p[1] - 1, dd = +p[2];
    const ppl = DATA.people(tid), hol = holidayOn(isoStr);
    const onShift = [], away = [], callable = [];
    ppl.forEach((person, idx) => {
      const c = dayCell(person, idx, yy, mm, dd), e = { p: person, k: c.k, t: c.t, pending: c.pending };
      if (c.k === "work" || c.k === "split" || c.k === "take") onShift.push(e);     // on the job
      else if (c.k === "leave" || c.k === "sick") away.push(e);                      // on leave / sick
      else callable.push(e);                                                         // off (rest day) or holiday → free to call in
    });
    return { iso: isoStr, y: yy, m: mm, d: dd, dow: domMonFirst(yy, mm, dd), hol, onShift, away, callable, total: ppl.length };
  }

  const DOW_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  // returns the floating popup markup (empty string when no day is open).
  // backdrop + modal are SIBLINGS so a click inside the modal doesn't bubble to the backdrop's close action.
  function dayPanel(tid) {
    if (!state.dayOpen) return "";
    const ds = daySummary(tid || DATA.state.tenantId, state.dayOpen), isToday = ds.iso === TODAY;
    const row = (e, side) => `<div class="dp-row"><span class="avatar xs">${UI.initials(e.p.name)}</span><div class="dp-rmain"><span class="dp-nm">${UI.esc(e.p.name)}</span><span class="dp-rs">${UI.esc(e.p.role + " · " + e.p.div)}</span></div><div class="dp-rside">${side}</div></div>`;
    const shiftRows = ds.onShift.map(e => row(e, `<span class="dp-tag ${e.k}">${UI.esc(e.t)}</span>`)).join("");
    const awayRows = ds.away.map(e => row(e, `<span class="dp-tag ${e.k}">${UI.esc(e.t)}</span>`)).join("");
    const callRows = ds.callable.map(e => row(e, `<span class="dp-tag off">${UI.esc(e.t)}</span><button class="btn xs ghost" data-act="cal:callin:${e.p.id}">${UI.icon("phone")} Call in</button>`)).join("");
    const sec = (kind, label, n, rows) => n ? `<div class="dp-sec"><div class="dp-sechead"><span class="tcal-sw ${kind}"></span><span class="dp-seclbl">${label}</span><span class="dp-seccnt">${n}</span></div><div class="dp-list">${rows}</div></div>` : "";
    const holBanner = ds.hol ? `<div class="dp-hol">${UI.icon("calendar")}<span><b>${UI.esc(ds.hol.name)}</b> · public holiday — the whole team is off. Anyone below can be called in if you open.</span></div>` : "";
    const empty = (!ds.onShift.length && !ds.away.length && !ds.callable.length) ? `<div class="dp-empty">No roster generated for this day.</div>` : "";
    return `<div class="dp-backdrop" data-act="cal:day-close"></div>
      <div class="dp-modal" role="dialog" aria-modal="true" aria-label="Day summary for ${ds.d} ${MONTHS[ds.m]} ${ds.y}">
        <div class="dp-head">
          <div class="dp-date"><span class="dp-dow">${DOW_FULL[ds.dow]}${isToday ? ` <span class="badge ok">Today</span>` : ""}</span><span class="dp-full">${ds.d} ${MONTHS[ds.m]} ${ds.y}</span></div>
          <button class="iconbtn dp-x" data-act="cal:day-close" aria-label="Close">${UI.icon("x")}</button>
        </div>
        <div class="dp-stats">
          <div class="dp-stat"><span class="dp-sv">${ds.onShift.length}</span><span class="dp-sl">On shift</span></div>
          <div class="dp-stat"><span class="dp-sv">${ds.away.length}</span><span class="dp-sl">On leave</span></div>
          <div class="dp-stat"><span class="dp-sv">${ds.callable.length}</span><span class="dp-sl">Callable</span></div>
        </div>
        ${holBanner}
        <div class="dp-body">
          ${sec("work", "On shift today", ds.onShift.length, shiftRows)}
          ${sec("leave", "On leave / sick", ds.away.length, awayRows)}
          ${sec("off", "Available to call in", ds.callable.length, callRows)}
          ${empty}
        </div>
        <div class="dp-foot"><span class="small muted">Shifts synced from Scheduling · leave from Approvals</span><button class="btn sm ghost" data-act="cal:day-close">Close</button></div>
      </div>`;
  }

  /* ============================================================
     ATTENDANCE — staff self-history (read-only, last 3 months)
     deterministic per working day, overlaid by leave + holiday
     ============================================================ */
  const _person = (uid) => (DATA.people().find(x => x.id === uid)) || DATA.me();
  function attStatus(uid, y, m, d) {
    const k = iso(y, m, d);
    if (k > TODAY) return null;                                   // future — no record yet
    if (holidayOn(k)) return { st: "holiday", label: holidayOn(k).name, in: "—", out: "—" };
    if (isWeekend(y, m, d)) return { st: "off", label: "Weekly rest", in: "—", out: "—" };
    const lv = leaveMap(uid, _person(uid).name)[k];
    if (lv) return { st: "leave", label: lv.type, in: "—", out: "—" };
    if ((d + m * 7) % 23 === 0) return { st: "absent", label: "Absent · no punch", in: "—", out: "—" };
    if (d % 11 === 1) return { st: "late", label: "Late arrival", in: "09:" + (14 + d % 10), out: "18:0" + (d % 3) }; // ~Jun 12, May 12, etc.
    return { st: "present", label: "Present · selfie + GPS", in: "09:0" + (d % 3), out: "18:0" + (1 + d % 4) };
  }
  function attSummary(uid) {
    const y = 2026, m = +TODAY.split("-")[1] - 1; let present = 0, late = 0, absent = 0;
    for (let d = 1; d <= daysInMonth(y, m); d++) { const s = attStatus(uid, y, m, d); if (!s) continue; if (s.st === "present") present++; else if (s.st === "late") late++; else if (s.st === "absent") absent++; }
    const base = present + late; return { present, late, absent, onTime: base ? Math.round(present / base * 100) : 100 };
  }
  function attRecords(uid, n) {
    const out = []; let cur = TODAY, guard = 0;
    while (out.length < n && cur >= "2026-04-01" && guard++ < 200) {
      const dt = new Date(cur), y = dt.getFullYear(), m = dt.getMonth(), d = dt.getDate(), s = attStatus(uid, y, m, d);
      if (s && s.st !== "off") out.push(Object.assign({ date: cur, dow: DOW[domMonFirst(y, m, d)], dd: d, mon: MON3[m] }, s));
      dt.setDate(dt.getDate() - 1); cur = iso(dt.getFullYear(), dt.getMonth(), dt.getDate());
    }
    return out;
  }
  // only the "not-green" working days are correctable (late · absent) — last ~3 months
  function fixableRecords(uid) {
    const out = []; let cur = TODAY, guard = 0;
    while (cur >= "2026-03-16" && guard++ < 140) {
      const dt = new Date(cur), y = dt.getFullYear(), m = dt.getMonth(), d = dt.getDate(), s = attStatus(uid, y, m, d);
      if (s && (s.st === "late" || s.st === "absent")) out.push(Object.assign({ date: cur, dow: DOW[domMonFirst(y, m, d)], dd: d, mon: MON3[m] }, s));
      dt.setDate(dt.getDate() - 1); cur = iso(dt.getFullYear(), dt.getMonth(), dt.getDate());
    }
    return out;
  }
  function submitFix(tid, uid, date, note) {
    if (!date) return { ok: false, err: "Select the day you want corrected" };
    if (!note || !note.trim()) return { ok: false, err: "Add an explanation for your manager" };
    const p = (DATA.people(tid).find(x => x.id === uid)) || DATA.me();
    const dp = date.split("-"), s = attStatus(uid, +dp[0], +dp[1] - 1, +dp[2]);
    const detail = "Fix " + fmtShort(date) + " · " + (s ? s.label : "record") + " → “" + note.trim() + "”" + (state.fixEvidence ? " · evidence attached" : "");
    if (window.APPROVALS) APPROVALS.request(tid, "punchfix", { who: p.name, detail });
    DATA.AUDIT.unshift({ fact: "attendance.fix_requested", who: p.name, when: TODAY + " 09:48", ref: detail });
    state.fixOpen = false; state.fixDate = null; state.fixEvidence = false; state.fixNote = "";
    return { ok: true };
  }
  const ATT_CLASS = { present: "att-present", late: "att-late", absent: "att-absent", leave: "att-leave", holiday: "hol", off: "wknd" };
  function attMonthBlock(uid, y, m) {
    const n = daysInMonth(y, m), lead = domMonFirst(y, m, 1), slots = [];
    for (let i = 0; i < lead; i++) slots.push(null);
    for (let d = 1; d <= n; d++) slots.push(d);
    while (slots.length % 7) slots.push(null);
    let rows = "";
    for (let w = 0; w < slots.length; w += 7) {
      rows += "<tr>" + slots.slice(w, w + 7).map(d => {
        if (d == null) return `<td class="mc mc-empty"></td>`;
        const k = iso(y, m, d), s = attStatus(uid, y, m, d), today = k === TODAY;
        const cls = ["mc", s ? ATT_CLASS[s.st] : "", today ? "today" : ""].filter(Boolean).join(" ");
        const title = s ? s.label + (s.in && s.in !== "—" ? " · " + s.in + "–" + s.out : "") : "";
        return `<td class="${cls}" ${title ? `title="${UI.esc(title)}"` : ""}>${d}</td>`;
      }).join("") + "</tr>";
    }
    return `<div class="mcal-month"><div class="mcal-mt">${MONTHS[m]} ${y}</div><table class="mtbl"><thead><tr>${DOW.map(w => `<th>${w}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div>`;
  }
  function attCalendar(uid) {
    const y = 2026, m = +TODAY.split("-")[1] - 1; let blocks = "";
    for (let i = 2; i >= 0; i--) { let mm = m - i, yy = y; while (mm < 0) { mm += 12; yy--; } blocks += attMonthBlock(uid, yy, mm); }
    const k = (c, l) => `<span class="mcal-key"><span class="mcal-sw ${c}"></span>${l}</span>`;
    const legend = `<div class="mcal-legend">${k("att-present", "Present")}${k("att-late", "Late")}${k("att-absent", "Absent")}${k("att-leave", "Leave")}${k("hol", "Holiday")}${k("wknd", "Rest day")}</div>`;
    return `<div class="mcal"><div class="mcal-wrap">${blocks}</div>${legend}</div>`;
  }

  function __reset() { state.y = 2026; state.m = 5; state.leaveOpen = false; state.sel = {}; state.type = "annual"; state.dayOpen = null; state.fixOpen = false; state.fixDate = null; state.fixEvidence = false; state.fixNote = ""; for (let i = HOLIDAYS.length - 1; i >= 0; i--) if (HOLIDAYS[i].scope !== "public") HOLIDAYS.splice(i, 1); }

  return {
    MONTHS, MON3, DOW, TODAY, LEAVE_TYPES, leaveType, HOLIDAYS,
    holidayOn, addHoliday, holidaysIn, upcoming,
    state, nav, openDay, closeDay, openFix, pickFix, attachFix, toggleDay, toggleDate, selected, selSummary, clearSel, openLeave,
    fmtShort, fmtRange, spanDates, leaveFor, leaveMap, requestLeave,
    teamMonth, monthPicker, teamGrid, teamLegend, navBar, daySummary, dayPanel,
    attStatus, attSummary, attRecords, attCalendar, fixableRecords, submitFix, __reset
  };
})();
