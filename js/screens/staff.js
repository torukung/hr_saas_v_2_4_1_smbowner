/* ============================================================
   ADEPTIO · Staff Portal screens (ochre) — v2.4.1.smbowner
   Mobile-first PWA + web. The punch is sacred: selfie + GPS +
   timestamp, never-block, offline queue. Sees only own record.
   ============================================================ */
window.SCR_STAFF = (function () {
  const { icon, kip, card, kpi, badge, table, rowlist, rowitem, donut, heatcal, empty, meter } = UI;
  const me = () => DATA.me();
  const slip = DATA.PAYSLIP;

  /* ---- Time Off (SF-style) helpers ---- */
  function balRow(label, left, total, unit) {
    const pct = Math.max(0, Math.min(100, Math.round(left / total * 100)));
    return `<div class="to-balrow"><div class="to-bl"><span>${label}</span><span class="to-bv"><b>${left}</b> / ${total} ${unit || "days"} left</span></div><div class="to-meter"><i style="width:${pct}%"></i></div></div>`;
  }
  function balancesCard() {
    return card("Balances", `<div class="to-bal">${balRow("Annual leave", 8, 15)}${balRow("Sick leave · paid", 29, 30)}</div><p class="small muted" style="margin-top:6px">Resets each calendar year.</p>`, { icon: "calCheck" });
  }
  function holidaysCard() {
    const hol = CAL.upcoming(5);
    return card("Public holidays", rowlist(hol.map(h => rowitem({ icon: "calendar", title: h.name, sub: CAL.fmtShort(h.date) + " · 2026", neutral: true, side: badge(h.scope === "public" ? "plain" : "ok") }))), { icon: "calendar", badge: `<span class="pending-chip">${icon("lock")} set by your shop</span>` });
  }
  // Create absence — a clear frame POP-UP (was an easy-to-miss panel at the bottom)
  function createAbsenceModal(sel, sum) {
    const has = sel.length > 0;
    const opts = `<option value="">Please select…</option>` + CAL.LEAVE_TYPES.map(t => `<option value="${t.id}"${CAL.state.type === t.id ? " selected" : ""}>${t.label}</option>`).join("");
    const ro = (v) => `<div class="to-ro">${v}</div>`;
    const form = `<div class="leave-form">
      <div class="field"><label>Time type *</label><select class="input" data-leavetype>${opts}</select></div>
      <div class="field"><label>Absence duration</label><select class="input" data-leavedur><option>Full day</option><option>Half day · morning</option><option>Half day · afternoon</option></select></div>
      <div class="to-2col">
        <div class="field"><label>Start date</label>${ro(has ? CAL.fmtShort(sum.from) + " 2026" : "—")}</div>
        <div class="field"><label>End date</label>${ro(has ? CAL.fmtShort(sum.to) + " 2026" : "—")}</div>
      </div>
      <div class="to-2col">
        <div class="field"><label>Requesting</label>${ro(has ? sum.days + " day" + (sum.days > 1 ? "s" : "") : "—")}</div>
        <div class="field"><label>Returning to work</label>${ro(has ? CAL.fmtShort(sum.returning) + " 2026" : "—")}</div>
      </div>
      <div class="leave-sel-sum">${has ? sel.map(d => `<span class="leave-pill">${CAL.fmtShort(d)}</span>`).join("") : `<span class="small muted">No days picked — close this, tap day(s) on the calendar, then reopen.</span>`}${has ? `<button class="btn xs ghost" data-act="leave:clear">${icon("x")} Clear</button>` : ""}</div>
      <div class="field"><label>Comment <span class="small muted">· your manager will see this</span></label><textarea class="input" data-leavenote rows="2" placeholder="Reason or handover note"></textarea></div>
    </div>`;
    return `<div class="dp-backdrop" data-act="leave:close"></div>
      <div class="dp-modal" role="dialog" aria-modal="true" aria-label="Create absence">
        <div class="dp-head"><div class="dp-date"><span class="dp-dow">${icon("calCheck")} Create absence</span><span class="dp-full">Request time off — your manager approves</span></div><button class="iconbtn dp-x" data-act="leave:close" aria-label="Close">${icon("x")}</button></div>
        <div class="dp-body">${form}</div>
        <div class="dp-foot"><span class="small muted">${has ? sum.days + " day" + (sum.days > 1 ? "s" : "") + " selected" : "Pick days on the calendar"}</span><div style="display:flex;gap:8px"><button class="btn ghost sm" data-act="leave:close">Cancel</button><button class="btn sm" data-act="leave:submit"${has ? "" : " disabled"}>${icon("send")} Submit</button></div></div>
      </div>`;
  }

  /* ---- shared comms helpers (Home banner · Notices · Inbox read the same feed) ---- */
  function shortWhen(w) { if (!w) return ""; const parts = w.split(" "), d = parts[0].split("-"); return parseInt(d[2], 10) + " " + CAL.MON3[parseInt(d[1], 10) - 1] + (parts[1] ? " " + parts[1] : ""); }
  function announceBanner() {
    const items = ANNOUNCE.active(DATA.state.tenantId);
    if (!items.length) return "";
    return `<div class="ann-banner" style="margin-bottom:16px">
      <div class="ann-h">${icon("megaphone")}<b>Company announcements</b><span class="ann-cnt">${items.length}</span><button class="ann-more" data-go="staff/web/inbox">All in Inbox ${icon("chevR")}</button></div>
      ${items.map(a => `<div class="ann-item${a.tone === "acc" ? " acc" : ""}">
        <div class="ann-main"><div class="ann-t">${UI.esc(a.title)}</div>${a.body ? `<div class="ann-b">${UI.esc(a.body)}</div>` : ""}</div>
        <span class="ann-meta">${UI.esc(ANNOUNCE.statusLabel(a))}</span>
      </div>`).join("")}
    </div>`;
  }
  function feedRows(n, toInbox) {
    const f = ANNOUNCE.feed(DATA.state.tenantId), list = n ? f.slice(0, n) : f;
    return rowlist(list.map(m => rowitem({
      icon: m.icon, title: m.title,
      sub: [m.sub, m.channel, shortWhen(m.when)].filter(Boolean).join(" · "),
      go: toInbox ? "staff/web/inbox" : (m.go || "staff/web/inbox"),
      side: m.tone === "ok" ? badge("ok") : (m.kind ? `<span class="badge plain">${m.kind === "period" ? "pinned" : "new"}</span>` : "")
    })));
  }

  // shared inner form (web modal + mobile sub-screen reuse the same fields + data-act hooks)
  function fixFormInner(uid) {
    const recs = CAL.fixableRecords(uid), pick = CAL.state.fixDate;
    const rows = recs.length ? recs.map(r => `<label class="fix-row${pick === r.date ? " on" : ""}">
        <input type="radio" name="fixday" ${pick === r.date ? "checked" : ""} data-act="att:fix-pick:${r.date}">
        <span class="fix-d">${r.dow} ${r.dd} ${r.mon}</span>
        ${r.st === "late" ? badge("late") : `<span class="badge bad">absent</span>`}
        <span class="fix-lbl small muted">${UI.esc(r.label)}</span>
      </label>`).join("") : `<div class="se-empty small muted">No late or absent days in the last 3 months — nothing to correct ✓</div>`;
    return `<p class="small muted" style="margin:2px 0 10px">Only late / absent days can be corrected. Pick the day, attach evidence, and explain.</p>
      <div class="fix-list">${rows}</div>
      <div class="field" style="margin-top:12px"><label>Evidence</label><button class="btn sm ghost" data-act="att:fix-evidence">${icon(CAL.state.fixEvidence ? "check" : "upload")} ${CAL.state.fixEvidence ? "Evidence attached ✓ · tap to remove" : "Attach evidence (photo / doc)"}</button></div>
      <div class="field"><label>Explanation <span class="small muted">· required · your manager will see this</span></label><textarea class="input" data-fixnote rows="2" placeholder="What happened on this day?">${UI.esc(CAL.state.fixNote || "")}</textarea></div>`;
  }
  // Request-a-fix POP-UP (web): the shared form, wrapped in the centered modal
  function fixModal(uid) {
    if (!CAL.state.fixOpen) return "";
    const pick = CAL.state.fixDate, has = !!pick;
    return `<div class="dp-backdrop" data-act="att:fix-close"></div>
      <div class="dp-modal" role="dialog" aria-modal="true" aria-label="Request an attendance fix">
        <div class="dp-head"><div class="dp-date"><span class="dp-dow">${icon("edit")} Request a fix</span><span class="dp-full">Correct one attendance record — your manager approves</span></div><button class="iconbtn dp-x" data-act="att:fix-close" aria-label="Close">${icon("x")}</button></div>
        <div class="dp-body">${fixFormInner(uid)}</div>
        <div class="dp-foot"><span class="small muted">${has ? "Correcting " + CAL.fmtShort(pick) : "Select a day above"}</span><div style="display:flex;gap:8px"><button class="btn ghost sm" data-act="att:fix-close">Cancel</button><button class="btn sm" data-act="att:fix-submit"${has ? "" : " disabled"}>${icon("send")} Send request</button></div></div>
      </div>`;
  }

  // Payslip "Top 3" frame: current month expected (Gross : OT : Expenses : others) + the previous 2 months
  function payTop3() {
    const cur = { ot: 300000, exp: 150000, other: 100000 };
    const expected = slip.net + cur.ot + cur.exp + cur.other;
    const li = (l, v) => `<div class="pt-li"><span>${l}</span><span class="num">${kip(v)}</span></div>`;
    const prev = [
      { mon: "May 2026", net: 5492250, when: "paid 25 May ✓" },
      { mon: "April 2026", net: 5410000, when: "paid 25 Apr ✓" }
    ];
    return `<div class="grid cols-3 pay-top3" style="margin-bottom:16px">
      ${card("This month · expected", `
        <div class="pt-hero"><span class="pt-lbl">Expected take-home</span><span class="pt-val num">${kip(expected)}</span><span class="pt-sub"><span class="badge ok">25 Jun</span> · estimate</span></div>
        <div class="pt-lines">${li("Gross", slip.gross)}${li("OT", cur.ot)}${li("Expenses / reimburse", cur.exp)}${li("Other allowances", cur.other)}</div>`, { icon: "wallet", cls: "pt-cur" })}
      ${prev.map(p => card(p.mon, `
        <div class="pt-hero"><span class="pt-lbl">Net paid</span><span class="pt-val num">${kip(p.net)}</span><span class="pt-sub">${p.when}</span></div>
        <button class="btn xs ghost" data-act="toast:${p.mon} payslip — opens the full breakdown (demo)">${icon("receipt")} View payslip</button>`, { icon: "history" })).join("")}
    </div>`;
  }

  /* ---------------- web ---------------- */
  const web = {
    today() {
      const sw = (window.APPROVALS && APPROVALS.get("phoungern", "AP-243")) || null;
      const swBadge = sw ? (sw.state === "pending" ? `<span class="badge warn">pending</span>` : badge(sw.state === "approved" ? "approved" : "plain")) : `<span class="badge warn">pending</span>`;
      const adv = (window.PAYROLL && PAYROLL.getAdvances("phoungern").find(a => a.uid === (me() && me().id))) || null;
      const pub = window.WORK && WORK.isPublished("phoungern");
      const att = CAL.attSummary(DATA.me().id);
      // widget renderers — keyed by catalog id; the manager picks · places · sizes them (STAFFDASH)
      const W = {
        announcement: () => announceBanner() || card("Announcements & alerts", empty("megaphone", "No announcements", "Your shop will post here"), { icon: "megaphone" }),
        hours: () => kpi("This week", "32.5<small> h</small>", `<span class="up">on track</span> · 6 shifts`),
        leavebal: () => kpi("Leave balance", "8.0<small> days</small>", "annual · 1.5 used"),
        nextshift: () => kpi("Next shift", "Wed 09:00", "Floor · this week"),
        attendance: () => card("Attendance", `<div class="statline"><div class="sl-it"><span class="sl-v num">${att.present}</span><span class="sl-l">present</span></div><div class="sl-it"><span class="sl-v num">${att.late}</span><span class="sl-l">late</span></div><div class="sl-it"><span class="sl-v num">${att.onTime}%</span><span class="sl-l">on-time</span></div></div>`, { icon: "history", link: "staff/web/attendance", linkLabel: "Open" }),
        nextpay: () => kpi("Next pay", kip(slip.net), `<span class="badge ok">25 Jun</span> · ready`, { hero: true }),
        payslip: () => card("June payslip", `<div class="tablewrap"><table class="tbl"><tbody><tr><td>Gross</td><td class="r num">${kip(slip.gross)}</td></tr><tr><td>− NSSF</td><td class="r num neg">−247,500</td></tr><tr><td>− PIT</td><td class="r num neg">−260,250</td></tr><tr class="total"><td>Net</td><td class="r num">${kip(slip.net)}</td></tr></tbody></table></div>`, { icon: "receipt", link: "staff/web/pay", linkLabel: "My pay" }),
        clock: () => card("Clock in/out", `
            <div class="clock-hero">
              <div class="ch-line">
                <div><div class="ch-time num">— : —</div><div class="ch-sub">You're clocked out · last out 18:02 ✓ synced</div></div>
                <button class="ch-btn" data-go="staff/web/clock">${icon("clock")} Clock in</button>
              </div>
              <div class="geo">${icon("pin")} Main shop · within 30 m geofence</div>
            </div>`, { icon: "clock" }),
        notices: () => card("Notices", feedRows(3, true), { icon: "inbox", link: "staff/web/inbox", linkLabel: "Open Inbox" }),
        shiftline: () => card("Shift line-up", `<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">${pub ? badge("published") : `<span class="badge warn">draft</span>`}<span class="small muted">${pub ? "Roster is live — your week below" : "Owner hasn't published the week yet"}</span></div>` + rowlist([
          rowitem({ icon: "calendar", title: "Mon · 09:00–18:00", sub: "Floor", side: badge("published") }),
          rowitem({ icon: "calendar", title: "Wed · 09:00–18:00", sub: "Floor · 1 open shift", side: `<button class="btn xs soft">Claim</button>` }),
          rowitem({ icon: "swap", title: "Thu 18 · swap → Souphaphone", sub: "your request", side: swBadge })
        ]), { icon: "calendar", link: "staff/web/schedule", linkLabel: "Schedule" }),
        openshifts: () => card("Open shifts", rowlist([
          rowitem({ icon: "calendar", title: "Wed · 09:00–18:00", sub: "Floor", side: `<button class="btn xs soft">Claim</button>` }),
          rowitem({ icon: "calendar", title: "Sat · 10:00–20:00", sub: "Floor", side: `<button class="btn xs soft">Claim</button>` })
        ]), { icon: "swap" }),
        approvals: () => card("Approval status", rowlist([
          rowitem({ icon: "calCheck", title: "Leave · Annual 3 days", sub: "22–24 Jun", side: badge("approved") }),
          rowitem({ icon: "swap", title: "Shift swap · Thu 18", sub: "→ Souphaphone", side: swBadge }),
          adv ? rowitem({ icon: "wallet", title: "Advance · " + kip(adv.amount), sub: "earned-wage access", side: adv.status === "requested" ? `<span class="badge warn">pending</span>` : badge(adv.status === "paid" ? "ok" : adv.status === "approved" ? "approved" : "plain") })
            : rowitem({ icon: "wallet", title: "No advance requested", sub: "request from My pay", neutral: true, side: badge("plain") })
        ]), { icon: "check" }),
        hourstrend: () => card("Hours trend", UI.bars([28, 31, 30, 33, 31.5, 32.5].map((v, i) => ({ l: "W" + (i + 1), v })), { values: true, h: 120 }) + `<p class="small muted" style="margin-top:6px">Worked hours · last 6 weeks</p>`, { icon: "trend" }),
        holidays: () => card("Upcoming holidays", rowlist(CAL.upcoming(3).map(h => rowitem({ icon: "calendar", title: h.name, sub: CAL.fmtShort(h.date) + " · 2026", neutral: true, side: badge(h.scope === "public" ? "plain" : "ok") }))), { icon: "calendar" }),
        onshift: () => { const ds = CAL.daySummary("phoungern", CAL.TODAY); const names = ds.onShift.slice(0, 5).map(e => e.p.name.split(" ")[0]).join(" · "); return card("On shift today", `<div class="statline"><div class="sl-it"><span class="sl-v num">${ds.onShift.length}</span><span class="sl-l">working</span></div><div class="sl-it"><span class="sl-v num">${ds.callable.length}</span><span class="sl-l">callable</span></div></div><p class="small muted" style="margin-top:8px">${names || "—"}</p>`, { icon: "users", link: "staff/web/schedule", linkLabel: "Roster" }); },
        birthdays: () => card("Birthdays this month", rowlist([
          rowitem({ icon: "heart", title: "Souphaphone Keo", sub: "12 June", neutral: true, side: `<span class="badge ok">soon</span>` }),
          rowitem({ icon: "heart", title: "Noy Phaketh", sub: "24 June", neutral: true })
        ]), { icon: "heart" }),
        quicklinks: () => card("Quick actions", `<div class="ql-grid">
          <button class="ql-btn" data-go="staff/web/clock">${icon("clock")}<span>Clock in</span></button>
          <button class="ql-btn" data-go="staff/web/leave">${icon("calCheck")}<span>Request leave</span></button>
          <button class="ql-btn" data-go="staff/web/pay">${icon("receipt")}<span>Payslip</span></button>
          <button class="ql-btn" data-go="staff/web/schedule">${icon("calendar")}<span>My schedule</span></button>
        </div>`, { icon: "sparkle" })
      };
      const grid = STAFFDASH.layout("phoungern").map(w => {
        const inner = W[w.id] ? W[w.id]() : "";
        return inner ? `<div class="dash-w" style="grid-column:${w.x + 1}/span ${w.w};grid-row:${w.y + 1}/span ${w.h}">${inner}</div>` : "";
      }).join("");
      return {
        title: "Good morning, Tinar", sub: "Tuesday · 15 June 2026 · Phoungern Co.",
        body: `<div class="dash-grid" style="--cols:${STAFFDASH.COLS}">${grid}</div>`
      };
    },
    clock() {
      return {
        title: "Clock in/out", sub: "Selfie + GPS + timestamp · never blocks, even offline",
        body: `
        <div class="grid cols-2">
          ${card("Punch", `
            <div class="clock-hero">
              <div class="ch-line">
                <div><div class="ch-time num">08:58</div><div class="ch-sub">Tuesday 15 June</div></div>
                <button class="ch-btn" data-act="staff:punch">${icon("camera")} Selfie & clock in</button>
              </div>
              <div class="geo">${icon("pin")} GPS locked · 12 m from pin · evidence-grade ✓</div>
            </div>
            <div class="seal-note ok" style="margin-top:14px">${icon("shield")} <div><b>Never-block.</b> No signal? The punch queues on your phone and syncs later — the server stamps the official time on arrival. A weak-GPS or out-of-fence punch is still saved, just flagged for the owner to confirm.</div></div>`, { icon: "clock" })}
          ${card("Today's punches", table(
          [{ h: "Time" }, { h: "Type" }, { h: "Where" }, { h: "Grade" }],
          [
            { cells: ["—", "In", "—", badge("pending")] },
            { cells: ["18:02", "Out", "Main shop", `<span class="badge ok">evidence</span>`] },
            { cells: ["12:30", "Break", "Main shop", `<span class="badge ok">evidence</span>`] },
            { cells: ["09:01", "In", "Main shop", `<span class="badge ok">evidence</span>`] }
          ]), { icon: "history" })}
        </div>`
      };
    },
    attendance() {
      const uid = DATA.me().id, sum = CAL.attSummary(uid), recs = CAL.attRecords(uid, 14);
      const m = new Date(CAL.TODAY).getMonth();
      const grade = (st) => st === "present" ? `<span class="badge ok">present</span>` : st === "late" ? badge("late") : st === "absent" ? `<span class="badge bad">absent</span>` : st === "leave" ? `<span class="badge plain">leave</span>` : badge("plain");
      return {
        title: "My attendance", sub: "Last 3 months · history, grade & fix-requests",
        actions: `<button class="btn sm" data-act="att:fix-open">${icon("edit")} Request a fix</button>`,
        body: `
        <div class="grid cols-3" style="margin-bottom:16px">
          ${kpi("Present", sum.present + "<small> days</small>", "this month")}
          ${kpi("Late", sum.late + "<small> day" + (sum.late !== 1 ? "s" : "") + "</small>", sum.late ? "<span class='down'>grace / geofence</span>" : "clean")}
          ${kpi("On-time rate", sum.onTime + "%", "<span class='up'>+4 vs May</span>")}
        </div>
        ${card("Attendance · " + CAL.MON3[(m + 10) % 12] + "–" + CAL.MON3[m] + " 2026", CAL.attCalendar(uid), { icon: "calendar" })}
        <div style="height:16px"></div>
        ${card("Clock records", table([{ h: "Date" }, { h: "In" }, { h: "Out" }, { h: "Status" }], recs.map(r => ({
          cells: [`${r.dow} ${r.dd} ${r.mon}`, r.in, r.out, grade(r.st)]
        }))), { icon: "history", badge: `<span class="badge plain">${recs.length} days</span>` })}
        ${fixModal(uid)}`
      };
    },
    leave() {
      const meP = DATA.me();
      const mine = DATA.LEAVE_REQS.filter(l => l.uid === meP.id || l.who === meP.name);
      const sel = CAL.selected(), sum = CAL.selSummary(), open = CAL.state.leaveOpen;
      return {
        title: "Time off", sub: "Balance & holidays up top · pick days on the calendar · create an absence",
        actions: open
          ? `<button class="btn ghost sm" data-act="leave:close">${icon("x")} Cancel</button>`
          : `<button class="btn" data-act="leave:open">${icon("plus")} Create absence</button>`,
        body: `
        <div class="grid cols-2" style="margin-bottom:16px">${balancesCard()}${holidaysCard()}</div>
        ${card("Calendar", CAL.monthPicker({ months: 3 }), { icon: "calendar", badge: `<span class="small muted">${sel.length ? sel.length + " day" + (sel.length > 1 ? "s" : "") + " selected" : "select day(s)"}</span>` })}
        <div style="height:16px"></div>
        ${card("My requests", mine.length ? rowlist(mine.map(l => rowitem({
          icon: l.tone === "sick" ? "alert" : "calendar", title: `${l.type} · ${l.days} day${l.days > 1 ? "s" : ""}`,
          sub: CAL.fmtRange(l.from, l.to || l.from) + (l.note ? " · “" + l.note + "”" : ""), side: badge(l.status)
        }))) : empty("calendar", "No requests yet", "Pick days and create an absence"), { icon: "list" })}
        ${open ? createAbsenceModal(sel, sum) : ""}`
      };
    },
    schedule() {
      const tid = DATA.state.tenantId, uid = DATA.me().id;
      const sel = SCHED.selected(), open = SCHED.state.swapOpen, mineSw = SCHED.mySwaps(tid, uid);
      const mates = SCHED.roster(tid).filter(p => p.id !== uid).slice(0, 8);
      const swapPanel = card("Request a shift swap", `<div class="leave-form">
          <div class="field"><label>Days to swap <span class="small muted">· tap your shifts on the calendar ↑</span></label><div class="leave-sel-sum">${sel.length ? sel.map(d => `<span class="leave-pill">${CAL.fmtShort(d)}</span>`).join("") : `<span class="small muted">No shift days picked yet</span>`}${sel.length ? `<button class="btn xs ghost" data-act="sched:clearsel">${icon("x")} Clear</button>` : ""}</div></div>
          <div class="field"><label>Give to</label><select class="input" data-swapto><option value="">Open shift · anyone can claim</option>${mates.map(p => `<option value="${UI.esc(p.name)}">${UI.esc(p.name)}</option>`).join("")}</select></div>
          <div class="field"><label>Note <span class="small muted">· your manager will see this</span></label><textarea class="input" data-swapnote rows="2" placeholder="Why you need the swap"></textarea></div>
          <div style="display:flex;gap:8px"><button class="btn" data-act="sched:swap-submit"${sel.length ? "" : " disabled"}>${icon("send")} Send for approval</button><button class="btn ghost" data-act="sched:swap-close">Cancel</button></div>
        </div>`, { icon: "swap" });
      return {
        title: "Jobs schedule & shifts", sub: "Your shifts · 3-month view · request a swap (manager approves)",
        actions: open
          ? `<button class="btn ghost sm" data-act="sched:swap-close">${icon("x")} Cancel</button>`
          : `<button class="btn" data-act="sched:swap-open">${icon("swap")} Request shift swap</button>`,
        body: card("My shifts", SCHED.calendar(tid, { uid }), { icon: "calendar" })
          + (open ? `<div style="height:16px"></div>${swapPanel}` : "")
          + `<div style="height:16px"></div>`
          + card("My swap requests", mineSw.length ? rowlist(mineSw.map(s => rowitem({
            icon: "swap", title: s.dates.map(CAL.fmtShort).join(", ") + " → " + s.to, sub: s.note || "—", side: badge(s.state)
          }))) : empty("swap", "No swap requests", "Pick a shift day and request a swap"), { icon: "list" })
      };
    },
    pay() {
      const etd = PAYROLL.earnedToDate(me()), ewaOn = FLAGS.on("phoungern", "ewa");
      return {
        title: "My pay", sub: "Payslips · earned-to-date · why every number",
        actions: `<button class="btn ghost sm">${icon("download")} Payslip PDF</button>`,
        body: `
        ${payTop3()}
        <div class="grid cols-2" style="margin-bottom:16px">
          ${FLAGS.on("phoungern", "etd") ? kpi("Earned to date", kip(etd.etdNet), etd.daysWorked + " of " + etd.workdays + " days · live") : kpi("Earned to date", "—", "tracker off in Functions")}
          ${kpi("YTD net", kip(27040000), "Jan–May 2026")}
        </div>
        ${ewaOn ? `<div class="seal-note" style="margin-bottom:16px">${icon("wallet")} <div><b>Earned-wage access is on.</b> Draw up to <b>${kip(etd.cap)}</b> (≤50% of earned-to-date), recovered from your next payslip. <button class="btn xs soft" data-act="ewa:request" style="margin-left:6px">${icon("wallet")} Request advance</button></div></div>` : ""}
        ${card("June payslip — every line shown", `
          <div class="tablewrap"><table class="tbl">
            <tbody>
              <tr><td>Gross earnings</td><td class="r num">${kip(slip.gross)}</td></tr>
              <tr><td>NSSF base = min(gross, ₭4.5M cap)</td><td class="r num">${kip(slip.ssBase)}</td></tr>
              <tr><td>− Employee NSSF (5.5%)</td><td class="r num neg">−${kip(slip.ssEmp).replace("₭ ", "")}</td></tr>
              <tr><td>Taxable income</td><td class="r num">${kip(slip.taxable)}</td></tr>
              ${slip.pitSlices.map(s => `<tr><td class="muted">&nbsp;&nbsp;PIT · ${s.band}</td><td class="r num muted">${kip(s.amt)}</td></tr>`).join("")}
              <tr><td>− PIT total</td><td class="r num neg">−${kip(slip.pit).replace("₭ ", "")}</td></tr>
              <tr class="total"><td>Net pay</td><td class="r num">${kip(slip.net)}</td></tr>
            </tbody>
          </table></div>
          <div class="seal-note ok" style="margin-top:12px">${icon("shield")} <div>Take-home ${kip(slip.net)} + remittances (${kip(slip.remit.nssf)} NSSF + ${kip(slip.remit.pit)} PIT) reconciles to the company's ${kip(slip.cost)} cost — to the kip.</div></div>
          <details class="seed-strip" style="margin-top:12px"><summary>${icon("eye")} Why this number · ເປັນຫຍັງຈຶ່ງເທົ່ານີ້</summary><div class="small" style="margin-top:8px;line-height:1.8">
            <b>Gross</b> — your base pay this month. <span class="muted">ລາຍຮັບລວມ — ເງິນເດືອນພື້ນຖານ.</span><br>
            <b>− NSSF 5.5%</b> — social security, on earnings up to the ₭4.5M cap. <span class="muted">ປະກັນສັງຄົມ 5.5% (ເພດານ ₭4.5M).</span><br>
            <b>− PIT</b> — income tax, only on the slice above ₭1.3M, rising by band. <span class="muted">ອາກອນລາຍໄດ້ ສະເພາະສ່ວນເກີນ ₭1.3M.</span><br>
            <b>= Net pay</b> — what lands in your account. <span class="muted">ເງິນສຸດທິ ທີ່ໂອນເຂົ້າບັນຊີ.</span>
          </div></details>`,
          { icon: "receipt", badge: badge("approved") })}`
      };
    },
    documents() {
      return {
        title: "My documents", sub: "Contract · ID · acknowledgements",
        body: card("Documents", rowlist([
          rowitem({ icon: "file", title: "Employment contract", sub: "Signed 2 Mar 2026", side: `<button class="btn xs ghost">${icon("eye")} View</button>` }),
          rowitem({ icon: "idcard", title: "National ID (on file)", sub: "Verified", side: badge("ok") }),
          rowitem({ icon: "file", title: "Code of conduct", sub: "Acknowledged", side: badge("approved") })
        ]), { icon: "files" })
      };
    },
    inbox() {
      const f = ANNOUNCE.feed(DATA.state.tenantId), anns = ANNOUNCE.active(DATA.state.tenantId);
      return {
        title: "Inbox", sub: "Announcements & alerts · in-app · LINE · WhatsApp — same feed as your Home",
        body: (anns.length ? announceBanner() : "") +
          card("All messages", feedRows(null, false), { icon: "inbox", badge: `<span class="badge plain">${f.length}</span>` })
      };
    },
    me(param) {
      const section = param || "general", uid = DATA.me().id;
      const extra = {
        tabs: [["account", "Account & security"]],
        render: () => `<div class="grid cols-2">
          ${card("Sign-in & security", rowlist([
            rowitem({ icon: "key", title: "Password", sub: "Changed 2 weeks ago", side: `<button class="btn xs ghost">Change</button>` }),
            rowitem({ icon: "phone", title: "This device", sub: "iPhone · active now", side: badge("ok") }),
            rowitem({ icon: "shield", title: "Two-step sign-in", sub: "Off · recommended", side: `<button class="btn xs ghost">Turn on</button>` })
          ]), { icon: "shield" })}
          ${card("Preferences", rowlist([
            rowitem({ icon: "globe", title: "Language", sub: "English · ລາວ coming", side: `<span class="pending-chip">${icon("globe")} ລາວ soon</span>` }),
            rowitem({ icon: "bell", title: "Notifications", sub: "Payslip · shifts · approvals", side: badge("ok") })
          ]), { icon: "sliders" })}
        </div>`
      };
      return {
        title: "Profile", sub: "Your profile, documents & account — the same record your shop keeps",
        body: PROFILE.page(uid, section, {
          edit: false,
          tabHref: (s) => "staff/web/me/" + s,
          headerRight: `<span class="pending-chip">${icon("lock")} your record · managed by your shop</span>`,
          extra
        })
      };
    }
  };

  /* ---------------- mobile PWA ---------------- */
  const mobile = {
    today() {
      return {
        title: "Today", body: `
        ${announceBanner()}
        <div class="clock-hero">
          <div class="ch-line"><div><div class="ch-sub">Tuesday 15 June</div><div class="ch-time num">— : —</div></div></div>
          <div class="ch-line" style="margin-top:10px"><div class="ch-sub">You're clocked out · last 18:02 ✓</div><button class="ch-btn" data-act="staff:punch">${icon("clock")} Clock in</button></div>
          <div class="geo">${icon("pin")} Main shop · within 30 m</div>
        </div>
        ${kpi("This week", "32.5<small> h</small>", "6 shifts · on track")}
        ${card("Notices", feedRows(3, true), { icon: "inbox", link: "staff/mobile/inbox", linkLabel: "Inbox" })}`
      };
    },
    clock() {
      return {
        title: "Clock in/out", body: `
        <div class="clock-hero">
          <div class="ch-line"><div><div class="ch-time num">08:58</div><div class="ch-sub">Selfie + GPS</div></div><button class="ch-btn" data-act="staff:punch">${icon("camera")} Clock in</button></div>
          <div class="geo">${icon("pin")} 12 m from pin · evidence ✓</div>
        </div>
        ${card("Today", rowlist([
          rowitem({ icon: "clock", title: "Out · 18:02", sub: "Main shop", side: `<span class="badge ok">ok</span>` }),
          rowitem({ icon: "clock", title: "In · 09:01", sub: "Main shop", side: `<span class="badge ok">ok</span>` })
        ]))}`
      };
    },
    leave() {
      const sel = CAL.selected();
      if (CAL.state.leaveOpen) {
        const opts = CAL.LEAVE_TYPES.map(t => `<option value="${t.id}"${CAL.state.type === t.id ? " selected" : ""}>${t.label}</option>`).join("");
        return {
          title: "Request leave", back: "staff/mobile/leave",
          body: `${card("Pick days", CAL.monthPicker(), { icon: "calendar" })}
            <div style="height:10px"></div>
            ${card("Details", `<div class="leave-form"><div class="field"><label>Time type</label><select class="input" data-leavetype>${opts}</select></div>
              <div class="field"><label>Selected · <b>${sel.length}</b> day${sel.length === 1 ? "" : "s"}</label><div class="leave-sel-sum">${sel.length ? sel.map(d => `<span class="leave-pill">${CAL.fmtShort(d)}</span>`).join("") : `<span class="small muted">Tap days above</span>`}</div></div>
              <button class="btn" style="width:100%;justify-content:center" data-act="leave:submit">${icon("send")} Submit request</button>
              <button class="btn ghost" style="width:100%;justify-content:center;margin-top:8px" data-act="leave:close">Cancel</button></div>`, { icon: "calCheck" })}`
        };
      }
      const mine = DATA.LEAVE_REQS.filter(l => l.uid === DATA.me().id || l.who === DATA.me().name);
      return {
        title: "Leave",
        body: `${card("Balance", `<div style="display:flex;gap:14px;align-items:center">${donut(53)}<div><div class="num" style="font-size:22px;font-weight:600">8.0</div><div class="small muted">days left</div></div></div>`)}
          <button class="btn" style="width:100%;justify-content:center;margin:10px 0" data-act="leave:open">${icon("plus")} Request leave</button>
          ${card("My requests", mine.length ? rowlist(mine.map(l => rowitem({ icon: l.tone === "sick" ? "alert" : "calendar", title: `${l.type} · ${l.days}d`, sub: CAL.fmtRange(l.from, l.to || l.from), side: badge(l.status) }))) : empty("calendar", "No requests yet", ""), { icon: "list" })}`
      };
    },
    pay() {
      return {
        title: "Pay", body: `${payTop3()}
        ${card("June payslip", `<div class="tablewrap"><table class="tbl"><tbody>
          <tr><td>Gross</td><td class="r num">${kip(slip.gross)}</td></tr>
          <tr><td>− NSSF</td><td class="r num neg">−247,500</td></tr>
          <tr><td>− PIT</td><td class="r num neg">−260,250</td></tr>
          <tr class="total"><td>Net</td><td class="r num">${kip(slip.net)}</td></tr>
        </tbody></table></div>`)}`
      };
    },
    more() {
      return {
        title: "More", body: card("", rowlist([
          rowitem({ icon: "history", title: "Attendance", go: "staff/mobile/attendance" }),
          rowitem({ icon: "list", title: "Schedule", go: "staff/mobile/schedule" }),
          rowitem({ icon: "files", title: "Documents", go: "staff/mobile/documents" }),
          rowitem({ icon: "inbox", title: "Inbox", go: "staff/mobile/inbox" }),
          rowitem({ icon: "user", title: "Profile", go: "staff/mobile/me" })
        ]))
      };
    },
    attendance() {
      const uid = DATA.me().id;
      if (CAL.state.fixOpen) {
        const has = !!CAL.state.fixDate;
        return {
          title: "Request a fix", back: "staff/mobile/attendance",
          body: card("Correct an attendance record", fixFormInner(uid), { icon: "edit" })
            + `<button class="btn" style="width:100%;justify-content:center;margin-top:4px" data-act="att:fix-submit"${has ? "" : " disabled"}>${icon("send")} Send request</button>`
            + `<button class="btn ghost" style="width:100%;justify-content:center;margin-top:8px" data-act="att:fix-close">Cancel</button>`
        };
      }
      return {
        title: "Attendance", back: "staff/mobile/more",
        body: card("June", heatcal({ until: 11, levels: { 12: "bad" } }))
          + `<button class="btn" style="width:100%;justify-content:center;margin-top:10px" data-act="att:fix-open">${icon("edit")} Request a fix</button>`
      };
    },
    schedule() { return { title: "Schedule", back: "staff/mobile/more", body: card("This week", rowlist(DATA.SHIFTS.slice(0, 5).map(s => rowitem({ icon: "calendar", title: `${s.day} 09:00–18:00`, sub: s.open ? "open shift" : "assigned", side: s.open ? `<button class="btn xs soft">Claim</button>` : badge("published") })))) }; },
    documents() { return { title: "Documents", back: "staff/mobile/more", body: card("", rowlist([rowitem({ icon: "file", title: "Contract", sub: "Signed" }), rowitem({ icon: "idcard", title: "National ID", side: badge("ok") })])) }; },
    inbox() {
      return {
        title: "Inbox", back: "staff/mobile/more",
        body: (ANNOUNCE.active(DATA.state.tenantId).length ? announceBanner() : "") +
          card("", feedRows(null, false))
      };
    },
    me() {
      const p = DATA.me();
      return {
        title: "Profile", back: "staff/mobile/more",
        body: card("", `<div style="display:flex;gap:12px;align-items:center">${PROFILE.avatar(p.id, { lg: true })}<div><b>${UI.esc(p.name)}</b><div class="small muted">${UI.esc(p.role)} · ${p.id}</div></div></div>`)
          + card("", rowlist([
            rowitem({ icon: "user", title: "Personal Data", go: "staff/web/me/personal" }),
            rowitem({ icon: "clock", title: "Time", go: "staff/web/me/time" }),
            rowitem({ icon: "files", title: "Documents", go: "staff/web/me/documents" })
          ]))
      };
    }
  };

  return { web, mobile };
})();
