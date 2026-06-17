/* ============================================================
   ADEPTIO · Owner Console screens (plum) — v2.4.1.smbowner
   One cockpit: Owner = Manager + HR + Books. Two-tier nav.
   Payroll + Accounting are now LIVE (PAYROLL + LEDGER engines):
   pay-run lifecycle, computed payslips, leveling, cashbook with
   auto-posted staff cost, live cost/benefit. Tenant-scoped.
   ============================================================ */
window.SCR_OWNER = (function () {
  const { icon, kip, card, kpi, tile, badge, table, rowlist, rowitem, donut, bars, lines2, meter, segMeter, lvlpill, flowRail, empty } = UI;
  const T = () => DATA.cur();
  const band = (ic, t, s) => `<div class="intro-band"><div class="ib-ic">${icon(ic)}</div><div><div class="ib-t">${t}</div><div class="ib-s">${s}</div></div></div>`;
  const millM = v => v + "M";
  const fmt = n => Number(Math.round(n)).toLocaleString("en-US");
  function pitBands(slips) {
    const rows = [{ rate: "0%", count: 0, pit: 0 }, { rate: "5%", count: 0, pit: 0 }, { rate: "10%+", count: 0, pit: 0 }];
    slips.forEach(s => {
      if (s.pit <= 0) rows[0].count++;
      else if (s.taxable <= 5000000) { rows[1].count++; rows[1].pit += s.pit; }
      else { rows[2].count++; rows[2].pit += s.pit; }
    });
    return rows;
  }
  const daysTo = (iso) => { const today = (window.CAL && CAL.TODAY) || "2026-06-16"; return Math.max(0, Math.round((new Date(iso) - new Date(today)) / 86400000)); };
  function recurList(list) {
    const seg = (e) => `<div class="seg sm rx-seg">${["weekly", "monthly", "yearly"].map(f => `<button aria-pressed="${f === e.freq}" data-act="expense:freq:${e.id}:${f}">${f[0].toUpperCase()}</button>`).join("")}</div>`;
    const rows = list.map(e => `<div class="rxrow">
      <div class="rx-main"><div class="rx-name">${e.name}</div><div class="rx-sub">${e.cat} · next ${CAL.fmtShort(e.next)}</div></div>
      <div class="rx-amt num">${kip(e.amount)}</div>${seg(e)}
      <button class="btn xs soft" data-act="expense:post:${e.id}">${icon("plus")} Post</button>
    </div>`).join("");
    const fopt = ["monthly", "weekly", "yearly"].map(f => `<option value="${f}">${f}</option>`).join("");
    const addf = `<div class="dbform" style="margin-top:12px">
      <input class="input" data-rx="name" placeholder="Expense name">
      <input class="input" data-rx="amount" placeholder="Amount ₭" inputmode="numeric">
      <select class="input" data-rx="freq">${fopt}</select>
      <button class="btn" data-act="expense:add">${icon("plus")} Schedule</button>
    </div>`;
    return `<div class="rxlist">${rows}</div><p class="small muted" style="margin:10px 0 0">Post drops it into the cashbook as an expense and rolls the date forward. W / M / Y sets the cadence.</p>${addf}`;
  }
  // Manager Dashboard "Alerts & communication" composer + live list (feeds staff Home + Inbox)
  function annComposer() {
    return `<div class="ann-compose">
      <div class="field"><label>Message *</label><input class="input" data-ann="title" placeholder="e.g. Shop closes early this Friday"></div>
      <div class="field"><label>Detail <span class="small muted">· optional</span></label><textarea class="input" data-ann="body" rows="2" placeholder="A line of context for the team"></textarea></div>
      <div class="ann-grid">
        <div class="field"><label>When</label><select class="input" data-ann="kind"><option value="immediate">Immediate alert</option><option value="scheduled">Schedule for a date</option><option value="period">Show for a period</option></select></div>
        <div class="field"><label>Publish date <span class="small muted">· if scheduled</span></label><input class="input" type="date" data-ann="date" value="2026-06-18"></div>
        <div class="field"><label>Stay shown · days <span class="small muted">· if period</span></label><input class="input" type="number" min="1" max="60" data-ann="days" value="7"></div>
      </div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><button class="btn sm" data-act="ann:add">${icon("send")} Post announcement</button><span class="small muted">Lands on staff Home + Inbox · in-app · LINE · EN · ລາວ</span></div>
    </div>`;
  }
  function annList(tid) {
    const items = ANNOUNCE.list(tid);
    return items.length ? rowlist(items.map(a => rowitem({
      icon: "megaphone", title: a.title, sub: ANNOUNCE.statusLabel(a) + " · " + a.channel,
      side: `<button class="btn xs ghost" data-act="ann:remove:${a.id}">${icon("x")} Remove</button>`
    }))) : empty("megaphone", "No announcements", "Post one above — staff see it on Home + Inbox");
  }
  // resolve an approval's person/team from its "who" (handles "Tinar → Souphaphone" composites)
  function apprPerson(i) { const nm = (i.who || "").split(/→|·/)[0].trim().split(" ")[0]; return DATA.people().find(x => x.name.split(" ")[0] === nm); }
  function apprTeam(i) { const p = apprPerson(i); return p ? p.team : "Other"; }

  const web = {
    /* ---------------- MANAGER DASHBOARD (operations · no money) ---------------- */
    dashboard() {
      const t = T(), a = DATA.ATT_TODAY, ppl = DATA.people(t.id);
      const cnt = { present: 0, late: 0, onleave: 0, absent: 0 };
      ppl.forEach(p => { cnt[p.status] = (cnt[p.status] || 0) + 1; });
      const onLeave = ppl.filter(p => p.status === "onleave");
      const pendLeave = DATA.LEAVE_REQS.filter(l => l.status === "pending").length;
      const pendAppr = APPROVALS.pending(t.id);
      return {
        title: `${t.name}`, sub: "Manager view — who's on the job today, the team calendar, and what needs you",
        actions: `<button class="btn ghost sm" data-go="owner/web/calendar">${icon("calendar")} Team calendar</button><button class="btn sm" data-go="owner/web/approvals">${icon("check")} Approvals</button>`,
        body: `
        <div class="tilegrid" style="margin-bottom:16px">
          ${tile({ label: "Today · on the job", icon: "users", value: `${a.in} / ${a.total}`, sub: `<span class="badge ok">${cnt.present} present</span> <span class="badge warn">${cnt.late} late</span>`, accent: true, go: "owner/web/attendance" })}
          ${tile({ label: "On leave today", icon: "calCheck", value: String(cnt.onleave), sub: cnt.onleave ? onLeave.map(p => p.name.split(" ")[0]).join(" · ") : "everyone in", go: "owner/web/leave" })}
          ${tile({ label: "Absent / no-show", icon: "alert", value: String(cnt.absent), sub: cnt.absent ? "follow up" : "none today", go: "owner/web/attendance" })}
          ${tile({ label: "Geofence flags", icon: "pin", value: String(a.flags), sub: "to review · never blocked", go: "owner/web/attendance" })}
        </div>
        <div class="grid cols-2">
          ${card("Needs you", rowlist([
          rowitem({ icon: "calCheck", title: `${pendLeave} leave request${pendLeave !== 1 ? "s" : ""} waiting`, sub: "review & decide", side: `<button class="btn xs soft" data-go="owner/web/leave">Review</button>` }),
          rowitem({ icon: "check", title: `${pendAppr} approvals in the inbox`, sub: "swaps · OT · advances", side: `<button class="btn xs soft" data-go="owner/web/approvals">Open</button>` }),
          rowitem({ icon: "pin", title: `${a.flags} geofence flags to clear`, sub: "punches are never auto-blocked", side: `<button class="btn xs soft" data-go="owner/web/attendance">Open</button>` })
        ]), { icon: "bell" })}
          ${card("This cycle · system resources", `<div class="capstrip">
            ${segMeter("Staff seats", t.seats.staff.used + t.seats.manager.used + t.seats.admin.used, 14)}
            ${segMeter("LINE messages", t.quota.line.used, t.quota.line.limit)}
            ${segMeter("WhatsApp", t.quota.whatsapp.used, t.quota.whatsapp.limit)}
            ${segMeter("Storage (GB)", t.storage.used, t.storage.limit, { unit: "GB" })}
          </div>`, { icon: "gauge", link: "owner/web/plan", linkLabel: "Manage" })}
        </div>
        <div style="height:16px"></div>
        ${card("Alerts & communication", annComposer() + `<div style="height:14px"></div>` + annList(t.id), { icon: "megaphone", badge: `<span class="badge plain">${ANNOUNCE.list(t.id).length} live</span>` })}
        <div style="height:16px"></div>
        ${card("Team calendar · " + CAL.MONTHS[CAL.state.m] + " " + CAL.state.y, CAL.navBar() + CAL.teamGrid(t.id) + CAL.teamLegend(), { icon: "calendar", link: "owner/web/calendar", linkLabel: "Open full" })}`
      };
    },
    /* ---------------- PAYROLL DASHBOARD (the money cockpit) ---------------- */
    "pay-dashboard"() {
      const t = T(), r = LEDGER.rollup(t.id), run = PAYROLL.getRun(t.id), ser = DW.series(t.id);
      const days = daysTo("2026-06-25"), top = LEDGER.topExpenses(t.id, 5), rec = LEDGER.recurring(t.id);
      const maxExp = top.length ? Math.max(1, Math.ceil(top[0].amount / 1e6)) : 1;
      return {
        title: "Payroll & money", sub: "The money cockpit — payroll, cash, revenue & expenses",
        actions: `<button class="btn ghost sm" data-go="owner/web/cashbook">${icon("plus")} Quick entry</button><button class="btn sm" data-go="owner/web/pay-runs">${icon("banknote")} Run payroll</button>`,
        body: `
        <div class="tilegrid" style="margin-bottom:16px">
          ${tile({ label: "Payroll · this month", icon: "banknote", value: kip(run.totals.cost), sub: `<span class="badge ${run.state === "close" ? "ok" : "plain"}">${run.state}</span> <span class="badge acc">PIT ${kip(run.totals.pit)}</span>`, accent: true, go: "owner/web/pay-runs" })}
          ${tile({ label: "Days to pay date", icon: "calendar", value: String(days), sub: "pay date · 25 Jun", go: "owner/web/pay-runs" })}
          ${tile({ label: "Cash · month result", icon: "trend", value: (r.result >= 0 ? "+" : "") + kip(r.result), sub: `margin ${(r.margin * 100).toFixed(0)}%`, go: "owner/web/costbenefit" })}
          ${tile({ label: "Revenue · this month", icon: "trend", value: kip(r.revenue), sub: `staff ${(r.staffCost / 1e6).toFixed(1)}M · ${(r.staffRatio * 100).toFixed(0)}% of rev`, go: "owner/web/costbenefit" })}
        </div>
        <div class="grid cols-2">
          ${card("This month · top expenses", top.length ? bars(top.map(e => ({ l: e.cat, v: Math.round(e.amount / 1e5) / 10, tone: "" })), { values: true, max: maxExp }) + `<p class="small muted" style="margin-top:8px">From the cashbook (₭M). Staff cost posts here when payroll closes.</p>` : empty("book", "No expenses yet", "Add entries in the cashbook"), { icon: "trend", link: "owner/web/cashbook", linkLabel: "Cashbook" })}
          ${card("Waiting · scheduled expenses", recurList(rec), { icon: "calCheck", badge: `<span class="badge warn">${rec.length} recurring</span>` })}
        </div>
        <div style="height:16px"></div>
        ${card("Revenue vs staff-cost — 6 months (derived)", lines2(ser.map(s => Math.round(s.revenue / 1e5) / 10), ser.map(s => Math.round(s.staffCost / 1e5) / 10), ser.map(s => s.month), { fmt: millM }) + UI.legend([{ c: "var(--acc)", l: "Revenue (₭M)" }, { c: "var(--muted-2)", l: "Staff cost (₭M)" }]), { icon: "chart" })}`
      };
    },

    /* ---------------- 2.1 STAFF MANAGER ---------------- */
    people() {
      const tid = T().id, teams = DATA.teamsFor(tid), total = DATA.people(tid).length;
      const stat = (p) => p.status === "present" ? badge("present") : p.status === "late" ? badge("late") : p.status === "onleave" ? badge("onleave") : badge("absent");
      // each person carries a slightly different background tint of the team colour ("different colour per person")
      const member = (p, i) => `<div class="team-member" style="background:color-mix(in srgb, var(--tc) ${7 + (i % 4) * 5}%, var(--surface))" data-go="owner/web/people-profile/${p.id}" role="button" tabindex="0">
        ${PROFILE.avatar(p.id, { xs: true })}
        <div class="tm-main"><span class="tm-name">${p.name}${p.you ? ' <span class="badge acc">you</span>' : ""}</span><span class="tm-sub">${p.role} · ${kip(p.base)}/mo</span></div>
        <span class="badge ${p.access === "owner" ? "acc" : "plain"}">${p.access}</span>${stat(p)}
      </div>`;
      const teamCard = (t) => `<div class="team-card" style="--tc:var(--${t.hue});--tcb:var(--${t.hue}-bg);--tcl:var(--${t.hue}-ln)">
        <div class="team-head"><span class="team-mark">${icon("users")}</span><div class="team-id"><span class="team-name">${t.label}</span><span class="team-sub">${t.members.length} ${t.members.length === 1 ? "person" : "people"}</span></div><span class="team-count">${t.members.length}</span></div>
        <div class="team-members">${t.members.map((p, i) => member(p, i)).join("")}</div>
      </div>`;
      return {
        title: "People", sub: T().name + " · grouped by team",
        actions: `<button class="btn sm">${icon("userPlus")} Add person</button>`,
        body: band("users", "Staff Manager · People", "Every worker, grouped by their team — each team carries its own accent, and each person a tint of it. Tap anyone to open their profile.") +
          `<div class="statline" style="margin-bottom:16px">${teams.map(t => `<div class="sl-it"><span class="sl-v num" style="color:var(--${t.hue}-d)">${t.members.length}</span><span class="sl-l">${t.label}</span></div>`).join("")}<div class="sl-it"><span class="sl-v num">${total}</span><span class="sl-l">of ${T().headcount} total</span></div></div>` +
          `<div class="team-stack">${teams.map(teamCard).join("")}</div>`
      };
    },
    "people-profile"(param) {
      const parts = (param || "").split("/"), uid = parts[0], section = parts[1] || "general";
      const ppl = DATA.people(), p = ppl.find(x => x.id === uid) || ppl[0];
      const prof = PROFILE.get(p.id);
      return {
        title: "People · " + p.name, sub: prof.position + " · " + prof.department,
        actions: `<button class="btn ghost sm" data-go="owner/web/people">${icon("chevL")} Roster</button>`,
        body: PROFILE.page(p.id, section, {
          edit: true, editing: PROFILE.getEditing(),
          tabHref: (s) => "owner/web/people-profile/" + p.id + "/" + s,
          headerRight: `<span class="badge ${p.access === "owner" ? "acc" : "plain"}">${p.access}</span><button class="btn ghost sm" data-act="toast:All actions — demo">${icon("dots")} All actions</button>`
        })
      };
    },
    attendance() {
      return {
        title: "Attendance", sub: "Live board · review queue · corrections · OT",
        body: band("history", "Staff Manager · Attendance", "Never-block punches; geofence flags route here, they never auto-dock pay.") +
          `<div class="grid cols-3" style="margin-bottom:16px">
            ${kpi("In now", "18 / 21", "<span class='up'>86%</span>")}
            ${kpi("Flags to clear", "2", "<span class='down'>geofence</span>")}
            ${kpi("OT this week", "14 h", "within Lao cap")}
          </div>
          ${card("Review queue — flag, never block", rowlist([
            rowitem({ icon: "pin", title: "Daophet Many · clock-in 50 m out", sub: "09:12 · weak GPS", side: `<button class="btn xs soft">Accept</button> <button class="btn xs ghost">Ask fix</button>` }),
            rowitem({ icon: "camera", title: "Vong Inthavong · no selfie", sub: "offline punch synced 12:40", side: `<button class="btn xs soft">Accept</button> <button class="btn xs ghost">Ask fix</button>` })
          ]), { icon: "alert" })}`
      };
    },
    scheduling() {
      const tid = T().id, tmpl = SCHED.tmplOf(tid), T_ = SCHED.TEMPLATES, multi = tmpl === "multi";
      const swaps = APPROVALS.inbox(tid).filter(i => i.type === "swap" || i.type === "claim");
      const seg = Object.keys(T_).map(id => `<button aria-pressed="${tmpl === id}" data-act="sched:tmpl:${id}">${T_[id].label} · ${T_[id].sub}</button>`).join("");
      const calBody = (multi ? SCHED.assignToolbar(tid) : "") + SCHED.calendar(tid) + (multi ? SCHED.assignBar(tid) : "");
      return {
        title: "Jobs schedule & shifts", sub: "Templates · shift configuration · 3-month roster calendar · swaps",
        actions: `<button class="btn ghost sm" data-go="owner/web/approvals">${icon("check")} Approvals (${APPROVALS.pending(tid)})</button>`,
        body: band("calendar", "Staff Manager · Jobs schedule & shifts", "Pick a template. On Multi-shift, build shift periods, users groups and shift groups, then select day(s) and assign. Click a day to edit its shifts; shifts can overlap; swaps need your approval.") +
          card("Roster template", `<div class="seg" style="flex-wrap:wrap;margin-bottom:8px">${seg}</div><p class="small muted">${T_[tmpl].note}</p>`, { icon: "sliders" }) +
          (multi ? `<div style="height:16px"></div>` + card("Shift configuration", `<p class="small muted" style="margin-bottom:12px">Build the building blocks once — a <b>shift group</b> binds a period (when) to a users group (who), and is what you drop onto days.</p>` + SCHED.config(tid), { icon: "layers", badge: `<span class="badge plain">${SCHED.cfg(tid).shiftGroups.length} shift groups</span>` }) : "") +
          `<div style="height:16px"></div>` +
          card("Roster calendar", calBody, { icon: "calendar", badge: `<span class="badge plain">${T_[tmpl].label}</span>` }) +
          (multi ? SCHED.dayEditor(tid) : (SCHED.state.selDate ? `<div style="height:16px"></div>${SCHED.dayDetail(tid)}` : "")) +
          `<div style="height:16px"></div>` +
          card("Shift-swap approvals", swaps.length ? rowlist(swaps.map(s => rowitem({
            icon: "swap", title: s.who, sub: s.detail,
            side: `<button class="btn xs soft" data-act="approve:${s.id}:approve">Approve</button> <button class="btn xs ghost" data-act="approve:${s.id}:reject">Decline</button>`
          }))) : empty("swap", "No swap requests", "Staff swap requests land here and on your dashboard"), { icon: "swap", badge: `<span class="badge ${swaps.length ? "warn" : "plain"}">${swaps.length} waiting</span>` })
      };
    },
    calendar() {
      const tid = T().id, tm = CAL.teamMonth(tid), hols = tm.holidays;
      const holDate = CAL.state.y + "-" + String(CAL.state.m + 1).padStart(2, "0") + "-15";
      return {
        title: "Team Absence Calendar", sub: "Availability at a glance · leave · sick · shifts · holidays",
        actions: `<button class="btn ghost sm" data-go="owner/web/scheduling">${icon("calendar")} Scheduling</button>`,
        body: band("calendar", "Staff Manager · Team Absence Calendar", "Who's available, who's off, and why — leave, sick, weekly rest, split & picked-up shifts (synced from Scheduling), with Lao public holidays blocked out for everyone.") +
          `<div class="grid cols-3" style="margin-bottom:16px">
            ${kpi("On leave · " + CAL.MONTHS[tm.m], tm.onleave + "<small> days</small>", "across the team")}
            ${kpi("Sick · month", tm.sick + "<small> days</small>", "this month")}
            ${kpi("Public holidays", String(hols.length), hols.length ? hols.map(h => CAL.fmtShort(h.date)).join(" · ") : "none this month")}
          </div>` +
          card("Month", CAL.navBar() + CAL.teamGrid(tid) + CAL.teamLegend(), { icon: "calendar", badge: `<span class="badge plain">${tm.rows.length} staff</span>` }) +
          `<div style="height:16px"></div>
          <div class="grid cols-2">
            ${card("Add a holiday", `<p class="small muted" style="margin-bottom:10px">Add a public or company holiday — it blocks out the column for everyone and shows on staff calendars.</p>
              <div class="dbform">
                <input class="input" type="date" data-hol="date" value="${holDate}">
                <input class="input" data-hol="name" placeholder="Holiday name (e.g. Boun That Luang)">
                <select class="input" data-hol="scope"><option value="company">Company</option><option value="public">Public</option></select>
                <button class="btn" data-act="cal:addholiday">${icon("plus")} Add holiday</button>
              </div>`, { icon: "calCheck" })}
            ${card("Upcoming holidays", rowlist(CAL.upcoming(5).map(h => rowitem({ icon: "calendar", title: h.name, sub: CAL.fmtShort(h.date) + " · 2026", neutral: true, side: badge(h.scope === "public" ? "plain" : "ok") }))), { icon: "list" })}
          </div>`
      };
    },
    leave() {
      const reqs = DATA.LEAVE_REQS;
      return {
        title: "Leave", sub: "Approvals · balances · leave types · accrual",
        body: band("calCheck", "Staff Manager · Leave", "Balance is auto-checked before it reaches you; approve and it debits + lands on the calendar.") +
          card("Requests", rowlist(reqs.map(l => rowitem({
            icon: l.tone === "sick" ? "alert" : "calendar", title: `${l.who} · ${l.type} ${l.days}d`,
            sub: `${CAL.fmtRange(l.from, l.to || l.from)}${l.note ? ` · “${l.note}”` : ""}`,
            side: l.status === "pending" ? `<button class="btn xs soft">Approve</button> <button class="btn xs ghost">Decline</button>` : badge(l.status)
          }))), { icon: "calCheck", badge: `<span class="badge warn">${reqs.filter(r => r.status === "pending").length} pending</span>` })
      };
    },
    messaging() {
      return {
        title: "Messaging & content", sub: "Announcements · templates · LINE/WA broadcast · inbox",
        actions: `<button class="btn sm">${icon("megaphone")} New broadcast</button>`,
        body: band("megaphone", "Staff Manager · Messaging", "Reach staff in-app, by email, or on LINE/WhatsApp — every template ships bilingual EN / ລາວ.") +
          `<div class="grid cols-2">
            ${card("Templates", rowlist([
              rowitem({ icon: "banknote", title: "Payslip ready", sub: "EN · ລາວ", side: badge("active") }),
              rowitem({ icon: "calendar", title: "Shift reminder", sub: "EN · ລາວ", side: badge("active") }),
              rowitem({ icon: "percent", title: "Compliance nudge", sub: "EN · ລາວ", side: badge("active") })
            ]), { icon: "files" })}
            ${card("Recent sends", rowlist(DATA.OUTBOX.map(o => rowitem({ icon: o.ch === "LINE" ? "chat" : "mail", title: `${o.tpl} → ${o.to}`, sub: `${o.ch} · ${o.when}`, neutral: true, side: badge("ok") }))), { icon: "send" })}
          </div>`
      };
    },
    access() {
      const admin = DATA.cur().owner || "Owner", dom = DATA.cur().id;
      const openSeat = `${rowitem({ icon: "userPlus", title: "Open seat", sub: "Invite a manager or admin to this shop", neutral: true, side: `<button class="btn xs soft" data-act="access:add">${icon("plus")} Add</button>` })}`;
      return {
        title: "Manager & Admin", sub: "Admins & managers for this shop — 1 from registration · 2 open seats",
        body: band("key", "Staff Manager · Manager & Admin", "The admin created at registration, plus up to two more managers/admins you can invite. Staff logins are managed per-person under People.") +
          card("Admins & managers", rowlist([
            rowitem({ avatar: admin, title: `${admin} <span class="badge acc">admin</span>`, sub: "owner@" + dom + ".la · from registration", side: badge("active") }),
            openSeat,
            openSeat
          ]), { icon: "key", badge: `<span class="badge plain">1 of 3 used</span>` }) +
          `<div style="height:16px"></div>` +
          card("Roles", rowlist([
            rowitem({ icon: "shield", title: "Admin", sub: "Full console — system · accounting · users · capacity", neutral: true, side: `<span class="badge acc">full</span>` }),
            rowitem({ icon: "userCheck", title: "Manager", sub: "Staff Manager subset — approvals · scheduling · attendance · no money", neutral: true, side: badge("plain") })
          ]), { icon: "users" })
      };
    },
    approvals() {
      const tid = T().id, items = APPROVALS.inbox(tid), V = APPROVALS.view;
      const teamLabel = (k) => { const t = DATA.TEAMS.find(x => x.id === k); return t ? t.label : k; };
      // ---- priority summary (on shift → overtime → leave → others) ----
      const byCat = {}; APPROVALS.CAT_ORDER.forEach(c => byCat[c] = 0);
      items.forEach(i => byCat[APPROVALS.catOf(i.type)]++);
      const summary = `<div class="appr-summary">${APPROVALS.CAT_ORDER.map((c, n) => `<div class="appr-cat${byCat[c] ? " has" : ""}"><span class="ac-rank">${n + 1}</span><span class="ac-n num">${byCat[c]}</span><span class="ac-l">${APPROVALS.CAT_LABEL[c]}</span></div>`).join("")}</div>`;
      // ---- two-level tabs, grouping remembered (by team → type, or by type → team) ----
      const mode = V.mode, cats = APPROVALS.CAT_ORDER, teamIds = DATA.teamsFor(tid).map(t => t.id);
      const topKeys = ["__all"].concat(mode === "team" ? teamIds : cats);   // "All messages" is always the leftmost tab
      const topLbl = (k) => k === "__all" ? "All messages" : (mode === "team" ? teamLabel(k) : APPROVALS.CAT_LABEL[k]);
      let tab = V.tab; if (topKeys.indexOf(tab) < 0) tab = "__all"; // default to All — never lands on an empty tab
      const inTop = tab === "__all" ? items.slice() : items.filter(i => mode === "team" ? apprTeam(i) === tab : APPROVALS.catOf(i.type) === tab);
      const subAll = mode === "team" ? cats : teamIds;
      const subPresent = subAll.filter(s => inTop.some(i => mode === "team" ? APPROVALS.catOf(i.type) === s : apprTeam(i) === s));
      const subKeys = ["__all"].concat(subPresent);
      let sub = V.sub; if (subKeys.indexOf(sub) < 0) sub = "__all";
      const subLbl = (s) => s === "__all" ? "All" : (mode === "team" ? APPROVALS.CAT_LABEL[s] : teamLabel(s));
      const shown = inTop.filter(i => sub === "__all" ? true : (mode === "team" ? APPROVALS.catOf(i.type) === sub : apprTeam(i) === sub));
      const topCount = (k) => k === "__all" ? items.length : items.filter(i => mode === "team" ? apprTeam(i) === k : APPROVALS.catOf(i.type) === k).length;
      const tabsRow = `<div class="appr-tabs">${topKeys.map(k => `<button class="appr-tab${k === "__all" ? " all" : ""}${k === tab ? " on" : ""}" data-act="appr:tab:${k}">${topLbl(k)}<span class="appr-tc">${topCount(k)}</span></button>`).join("")}</div>`;
      const subRow = `<div class="appr-subtabs">${subKeys.map(s => `<button class="appr-subtab${s === sub ? " on" : ""}" data-act="appr:sub:${s}">${subLbl(s)}</button>`).join("")}</div>`;
      const list = shown.length ? rowlist(shown.map(i => {
        const p = apprPerson(i);
        return rowitem({
          icon: i.grade === "flag" ? "alert" : "check",
          title: `${i.who} <span class="badge ${i.grade === "flag" ? "warn" : "plain"}">${APPROVALS.TYPES[i.type] ? APPROVALS.TYPES[i.type].label : i.type}${i.grade === "flag" ? " · flag" : ""}</span>`,
          sub: `${i.detail} · ${APPROVALS.CAT_LABEL[APPROVALS.catOf(i.type)]}${p ? " · " + p.team : ""} · ${i.id}`,
          side: `<button class="btn xs soft" data-act="approve:${i.id}:approved">Approve</button> <button class="btn xs ghost" data-act="approve:${i.id}:rejected">Reject</button>`
        });
      })) : empty("check", "Nothing in this tab", "Pick another tab or group");
      return {
        title: "Approvals", sub: "Prioritised inbox · group by team or type · decisions audited",
        body: band("check", "Staff Manager · Approvals", "Worker-protecting checks (geofence · OT · punch) flag and route here — they never block the worker. Summary is prioritised: on shift → overtime → leave → others.") +
          card("Summary · by priority", summary, { icon: "gauge", badge: `<span class="badge warn">${items.length} pending</span>` }) +
          `<div style="height:16px"></div>` +
          card("Inbox", `<div class="appr-toolbar">
              <div class="seg sm" role="group" aria-label="Group approvals by">
                <button aria-pressed="${mode === "team"}" data-act="appr:mode:team">By team</button>
                <button aria-pressed="${mode === "type"}" data-act="appr:mode:type">By type</button>
              </div>
              <button class="btn xs ghost" data-act="appr:save">${icon("check")} ${V.saved ? "View saved ✓" : "Save view"}</button>
            </div>
            ${tabsRow}${subRow}
            <div class="appr-list">${list}</div>`, { icon: "inbox", badge: `<span class="badge warn">${items.length} pending</span>` })
      };
    },

    /* ---------------- PAYROLL (live engine) ---------------- */
    "pay-runs"() {
      const t = T(), run = PAYROLL.getRun(t.id), sm = PAYROLL.stateMeta(run), idx = sm.idx;
      const steps = [{ t: "Draft", s: "pull punches" }, { t: "Review", s: "exceptions" }, { t: "Approve", s: "lock totals" }, { t: "Pay", s: "file + slips" }, { t: "File", s: "NSSF/PIT" }, { t: "Close", s: "post to books" }];
      const nextLabel = ["Send to review", "Approve", "Pay", "File", "Close run"][idx];
      const actions = run.state !== "close"
        ? `<button class="btn sm" data-act="pay-run:advance">${icon("check")} ${nextLabel}</button>${run.state === "draft" && FLAGS.on(t.id, "onetap") ? `<button class="btn soft sm" data-act="pay-run:oneclick">${icon("banknote")} One-tap run</button>` : ""}`
        : `<button class="btn ghost sm" data-act="pay-run:adjust">${icon("refresh")} Open adjustment run</button>`;
      return {
        title: "Pay runs", sub: "draft → review → approve → pay → file → close · one-tap", actions,
        body: band("banknote", "Payroll · the bridge between Staff and Accounting", "Lao-correct: NSSF 6%+5.5% (cap ₭4.5M), PIT 0–25%. Closed runs are immutable — fixes via an adjustment run.") +
          card(`${run.id} · ${run.period} · ${run.totals.headcount} staff`,
            UI.steps(steps, idx) +
            `<div class="statline" style="margin-top:16px">
              <div class="sl-it"><span class="sl-v num">${kip(run.totals.gross)}</span><span class="sl-l">Gross</span></div>
              <div class="sl-it"><span class="sl-v num">${kip(run.totals.net)}</span><span class="sl-l">Net pay</span></div>
              <div class="sl-it"><span class="sl-v num">${kip(run.totals.pit)}</span><span class="sl-l">PIT</span></div>
              <div class="sl-it"><span class="sl-v num">${kip(run.totals.cost)}</span><span class="sl-l">Employer cost</span></div>
              <div class="sl-it"><span class="sl-v">${lvlpill(run.level, true)}</span><span class="sl-l">Level</span></div>
            </div>` +
            (run.state === "close"
              ? `<div class="seal-note ok" style="margin-top:12px">${icon("check")} Closed & immutable — staff cost posted to Accounting → Cashbook. Corrections go through an adjustment run.</div>`
              : `<div class="seal-note brand" style="margin-top:12px">${icon("history")} State: <b>${run.state}</b>. Advancing never edits silently; closing posts to Accounting and locks the run.</div>`),
            { icon: "banknote", badge: run.state === "close" ? `<span class="badge ok">closed</span>` : `<span class="badge warn">${run.state}</span>` }) +
          `<div style="height:16px"></div>` +
          card("Per-person preview — add allowance · OT · misc · remarks", `<div class="tablewrap"><table class="tbl">
            <thead><tr><th>Name</th><th class="r">Base</th><th class="r">Allowance</th><th class="r">OT</th><th class="r">Misc</th><th>Remarks</th><th class="r">Net</th></tr></thead>
            <tbody>${run.slips.map(s => { const a = PAYROLL.getAdj(t.id, s.uid); return `<tr>
              <td>${s.name}</td>
              <td class="r num">${kip(s.base)}</td>
              <td class="r"><input class="input sm" data-adj="${s.uid}:allowance" value="${a.allowance || ""}" placeholder="0" inputmode="numeric" style="max-width:90px;text-align:right"></td>
              <td class="r"><input class="input sm" data-adj="${s.uid}:ot" value="${a.ot || ""}" placeholder="0" inputmode="numeric" style="max-width:90px;text-align:right"></td>
              <td class="r"><input class="input sm" data-adj="${s.uid}:misc" value="${a.misc || ""}" placeholder="0" inputmode="numeric" style="max-width:90px;text-align:right"></td>
              <td><input class="input sm" data-adj="${s.uid}:remarks" value="${(a.remarks || "").replace(/"/g, "&quot;")}" placeholder="—" style="min-width:130px"></td>
              <td class="r num">${kip(s.net)}</td>
            </tr>`; }).join("")}</tbody>
          </table></div>
          <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:12px;flex-wrap:wrap"><span class="small muted">Edits fold into gross → NSSF/PIT recompute. Net updates on save.</span><button class="btn sm" data-act="pay:adj-save">${icon("check")} Save to draft</button></div>`,
            { icon: "sliders", badge: `<span class="badge plain">${run.totals.headcount} people</span>` }) +
          (PAYROLL.draftSavedAt(t.id) ? `<div style="height:16px"></div>` + card("Draft table · " + run.period, `
            <div class="seal-note ok" style="margin-bottom:12px">${icon("check")} Auto-saved ${PAYROLL.draftSavedAt(t.id)} · ${run.period} · level ${run.level} — adjustments persist.</div>
            <div class="tablewrap"><table class="tbl"><thead><tr><th>Name</th><th class="r">Gross (incl. adj)</th><th class="r">NSSF</th><th class="r">PIT</th><th class="r">Net</th><th>Remarks</th></tr></thead>
            <tbody>${run.slips.filter(s => PAYROLL.hasAdj(t.id, s.uid)).map(s => `<tr><td>${s.name}</td><td class="r num">${kip(s.gross)}</td><td class="r num">${kip(s.ssEmp)}</td><td class="r num">${kip(s.pit)}</td><td class="r num">${kip(s.net)}</td><td class="small muted">${PAYROLL.getAdj(t.id, s.uid).remarks || "—"}</td></tr>`).join("") || `<tr><td colspan="6" class="muted">No adjustments yet — edit a row above and Save to draft.</td></tr>`}</tbody></table></div>
            <div class="statline" style="margin-top:14px"><div class="sl-it"><span class="sl-v num">${kip(run.totals.gross)}</span><span class="sl-l">Draft gross</span></div><div class="sl-it"><span class="sl-v num">${kip(run.totals.cost)}</span><span class="sl-l">Employer cost</span></div></div>
            <div class="dbform" style="margin-top:12px;align-items:center"><span class="small" style="align-self:center">Distribute</span><input class="input sm" type="date" data-sched="date" value="2026-06-25"><input class="input sm" type="time" data-sched="time" value="09:00"><button class="btn sm" data-act="pay:commit">${icon("calCheck")} Commit &amp; schedule</button></div>`,
            { icon: "book", badge: `<span class="badge warn">draft</span>` }) : "") +
          (PAYROLL.pendingPRs(t.id).length ? `<div style="height:16px"></div>` + card("Pending pay runs", table([{ h: "Run-id" }, { h: "Period" }, { h: "People", r: true }, { h: "Employer cost", r: true }, { h: "State" }, { h: "Distribute" }],
            PAYROLL.pendingPRs(t.id).map(pr => ({ cells: [`<span class="idtag">${pr.runId}</span>`, pr.period, `<span class="num">${pr.people}</span>`, `<span class="num">${kip(pr.cost)}</span>`, `<span class="badge warn">${pr.state}</span>`, `<span class="small">${pr.distributeAt}</span>`] }))),
            { icon: "calCheck", badge: `<span class="badge plain">${PAYROLL.pendingPRs(t.id).length} scheduled</span>` }) : "") +
          `<div style="height:16px"></div>` +
          card("History", table([{ h: "Run" }, { h: "Period" }, { h: "People", r: true }, { h: "Employer cost", r: true }, { h: "State" }],
            DATA.PAYRUNS.slice(1).map(r => ({ cells: [`<span class="idtag">${r.id}</span>`, r.period, `<span class="num">${r.people}</span>`, `<span class="num">${kip(r.cost)}</span>`, `<span class="badge ok">closed</span>`] }))), { icon: "history" })
      };
    },
    components() {
      return {
        title: "Components", sub: "Earnings · allowances · OT · deductions",
        body: band("sliders", "Payroll · Components", "The building blocks the engine sums into gross — Lao OT multipliers built in.") +
          card("Library", table([{ h: "Component" }, { h: "Type" }, { h: "Rule" }], [
            { cells: ["Base salary", `<span class="badge plain">earning</span>`, "monthly"] },
            { cells: ["Position allowance", `<span class="badge plain">allowance</span>`, "fixed / mo"] },
            { cells: ["Overtime — normal day", `<span class="badge plain">OT</span>`, "150%"] },
            { cells: ["Overtime — rest day / night", `<span class="badge plain">OT</span>`, "250% / 350%"] },
            { cells: ["NSSF (employee)", `<span class="badge bad">deduction</span>`, `5.5% to ${kip(DATA.SS.cap)} cap`] },
            { cells: ["PIT", `<span class="badge bad">deduction</span>`, "0–25% progressive"] }
          ]), { icon: "sliders" })
      };
    },
    advances() {
      const tid = T().id, list = PAYROLL.getAdvances(tid), sample = DATA.people(tid).find(p => p.you) || DATA.people(tid)[0], etd = PAYROLL.earnedToDate(sample);
      const rows = list.length ? rowlist(list.map(a => rowitem({
        icon: "wallet", title: `${a.who} · ${kip(a.amount)}`, sub: `${a.id} · ${a.status}`,
        side: a.status === "requested" ? `<button class="btn xs soft" data-act="ewa:approve:${a.id}">Approve</button> <button class="btn xs ghost" data-act="ewa:reject:${a.id}">Reject</button>`
          : a.status === "approved" ? `<button class="btn xs soft" data-act="ewa:payout:${a.id}">Pay out</button>`
            : badge(a.status === "paid" ? "ok" : "plain")
      }))) : empty("wallet", "No advances yet", "Approved draws are recovered on the next payslip");
      return {
        title: "Advances (EWA)", sub: "earned-to-date · owner-approved draw · payday recovery",
        actions: `<button class="btn ghost sm" data-act="ewa:request">${icon("plus")} Demo draw (${sample.name.split(" ")[0]})</button>`,
        body: band("wallet", "Payroll · Earned-Wage Access", "A salary advance against earned-to-date — capped ≤50%, recovered as one deduction line on the next payslip.") +
          `<div class="grid cols-3" style="margin-bottom:16px">
            ${kpi("Earned-to-date", kip(etd.etdNet), sample.name.split(" ")[0] + " · " + etd.daysWorked + "/" + etd.workdays + " days", { hero: true })}
            ${kpi("Draw cap", kip(etd.cap), "≤ 50% of earned-to-date")}
            ${kpi("Open advances", list.filter(a => a.status === "requested" || a.status === "approved").length, "awaiting / to pay")}
          </div>` +
          card("Requests", rows, { icon: "wallet", badge: `<span class="badge plain">${list.length} total</span>` }) +
          `<div style="height:16px"></div>` +
          card("How it flows", flowRail([{ t: "Request", s: "staff draws" }, { t: "Cap check", s: "≤50% etd" }, { t: "Approve", s: "owner" }, { t: "Pay out", s: "from float" }, { t: "Recover", s: "next payday" }]), { icon: "history" })
      };
    },
    statutory() {
      const t = T(), run = PAYROLL.getRun(t.id), tot = run.totals, bands = pitBands(run.slips);
      return {
        title: "Statutory", sub: "NSSF schedule · PIT withholding report — computed live",
        body: band("shield", "Payroll · Statutory", "The filings the owner hands in — generated from the same numbers as the payslips.") +
          `<div class="grid cols-2">
            ${card("NSSF contribution schedule", table([{ h: "" }, { h: "Rate" }, { h: run.period, r: true }], [
            { cells: ["Employee", "5.5%", `<span class="num">${kip(tot.ssEmp)}</span>`] },
            { cells: ["Employer", "6.0%", `<span class="num">${kip(tot.ssEr)}</span>`] },
            { cells: [`<b>Remit</b>`, "—", `<span class="num"><b>${kip(tot.ssEmp + tot.ssEr)}</b></span>`] }
          ]), { icon: "shield" })}
            ${card("PIT withholding report", table([{ h: "Band" }, { h: "Staff", r: true }, { h: "PIT", r: true }],
            bands.map(b => ({ cells: [b.rate, `<span class="num">${b.count}</span>`, `<span class="num">${kip(b.pit)}</span>`] }))
              .concat([{ cells: [`<b>Total</b>`, `<span class="num">${tot.headcount}</span>`, `<span class="num"><b>${kip(tot.pit)}</b></span>`] }])
          ), { icon: "percent" })}
          </div>
          <div class="seal-note brand" style="margin-top:14px">${icon("scale")} ${t.level === "L0" ? "Level L0 (cash) — statutory math is off; raise to L1+ to compute NSSF & PIT." : "Computed from the current run at level " + run.level + ". Sealed store db_payroll — server-authoritative."}</div>`
      };
    },
    payslips(param) {
      const t = T(), ppl = DATA.people(t.id);
      const person = ppl.find(p => p.id === param) || ppl.find(p => p.you) || ppl[0];
      const s = PAYROLL.computeSlip(person, t.level);
      const picker = `<select class="input sm" data-payslip aria-label="Choose employee" style="max-width:230px">${ppl.map(p => `<option value="${p.id}" ${p.id === person.id ? "selected" : ""}>${p.name}</option>`).join("")}</select>`;
      const statutory = t.level !== "L0";
      return {
        title: "Payslips", sub: 'bilingual EN/ລາວ · "why this number" · computed live',
        actions: picker + `<button class="btn ghost sm" data-act="export:payreg">${icon("download")} Register CSV</button>`,
        body: band("receipt", "Payroll · Payslips", "Every line shown; take-home and remittances reconcile to the company cost — to the kip.") +
          `<div class="grid cols-2">
            ${card(`${s.name} · ${person.role} · ${run_lvl(run_safe(t))}`, `<div class="tablewrap"><table class="tbl"><tbody>
              <tr><td>Gross earnings</td><td class="r num">${kip(s.gross)}</td></tr>
              ${statutory ? `<tr><td>NSSF base (cap ${kip(DATA.SS.cap)})</td><td class="r num">${kip(s.ssBase)}</td></tr>
              <tr><td>− Employee NSSF 5.5%</td><td class="r num neg">−${fmt(s.ssEmp)}</td></tr>
              <tr><td>Taxable</td><td class="r num">${kip(s.taxable)}</td></tr>
              <tr><td>− PIT (progressive)</td><td class="r num neg">−${fmt(s.pit)}</td></tr>` : `<tr><td class="muted" colspan="2">Level L0 · cash — no statutory deductions</td></tr>`}
              <tr class="total"><td>Net pay</td><td class="r num">${kip(s.net)}</td></tr>
            </tbody></table></div>`, { icon: "receipt", badge: s.reconciles ? `<span class="badge ok">reconciles</span>` : `<span class="badge bad">check</span>` })}
            ${card("Company cost & reconcile", `<div class="tablewrap"><table class="tbl"><tbody>
              <tr><td>Gross</td><td class="r num">${kip(s.gross)}</td></tr>
              <tr><td>+ Employer NSSF 6%</td><td class="r num">+${fmt(s.ssEr)}</td></tr>
              <tr class="total"><td>Employer cost</td><td class="r num">${kip(s.cost)}</td></tr>
              <tr><td class="muted">→ to worker (net)</td><td class="r num muted">${kip(s.net)}</td></tr>
              <tr><td class="muted">→ to NSSF</td><td class="r num muted">${kip(s.ssEmp + s.ssEr)}</td></tr>
              <tr><td class="muted">→ to Tax Dept (PIT)</td><td class="r num muted">${kip(s.pit)}</td></tr>
            </tbody></table></div><div class="seal-note ok" style="margin-top:10px">${icon("check")} ${fmt(s.net)} + ${fmt(s.ssEmp + s.ssEr)} + ${fmt(s.pit)} = <b>${fmt(s.cost)}</b></div>`, { icon: "coins" })}
          </div>`
      };
    },
    leveling() {
      const lv = T().level;
      const pill = (l) => `<button data-act="pay-level:${l}" style="border:0;background:none;padding:0;cursor:pointer" title="Switch to ${l}">${lvlpill(l, l === lv)}</button>`;
      return {
        title: "Leveling", sub: "L0 cash → L3 full compliance · owner switch · never rewrites closed runs",
        body: band("scale", "Payroll · Leveling", "One switch sets how deep compliance goes. Click a level to switch — a draft run recomputes live; closed runs keep theirs.") +
          card("Compliance depth", `<div class="lvl-track" style="margin-bottom:14px">
            ${["L0", "L1", "L2", "L3"].map(pill).join('<span style="color:var(--muted-2)">→</span>')}
            <span class="badge acc" style="margin-left:8px">current: ${lv}</span>
          </div>` + table([{ h: "Level" }, { h: "What runs" }, { h: "For" }], [
            { cells: [lvlpill("L0", lv === "L0"), "Net pay only · simple payslip", "cash-only micro-shop"] },
            { cells: [lvlpill("L1", lv === "L1"), "+ NSSF + PIT · bilingual payslip · YTD", "small team formalising"] },
            { cells: [lvlpill("L2", lv === "L2"), "+ schedules + tax calendar + remittance", "registered employer"] },
            { cells: [lvlpill("L3", lv === "L3"), "+ BIK · Profit Tax/CIT · e-filing export", "near-accountant output"] }
          ]), { icon: "scale" })
      };
    },

    /* ---------------- 2.2 ACCOUNTING (live ledger) ---------------- */
    cashbook() {
      const t = T(), view = LEDGER.getView(), list = LEDGER.ranged(t.id, view), sums = LEDGER.sums(list);
      const seg = ["day", "week", "month"].map(v => `<button aria-pressed="${view === v}" data-act="ledger:range:${v}">${v[0].toUpperCase() + v.slice(1)}</button>`).join("");
      const addForm = `<div class="dbform" style="margin-top:12px">
        <select class="input sm" data-led="kind"><option value="rev">Revenue</option><option value="exp">Expense</option></select>
        <input class="input sm" data-led="cat" placeholder="Category (e.g. Daily sales)">
        <input class="input sm" data-led="amount" placeholder="Amount ₭" inputmode="numeric" style="max-width:130px">
        <select class="input sm" data-led="method"><option>cash</option><option>transfer</option><option>qr</option></select>
        <button class="btn sm" data-act="ledger:add">${icon("plus")} Add entry</button>
      </div>`;
      return {
        title: "Cashbook", sub: "revenue / expense · day · week · month — live",
        actions: `<div class="seg sm">${seg}</div>`,
        body: band("book", "Accounting · Cashbook", "The books live inside the system — single-entry, matched to an owner. The spreadsheet becomes an export.") +
          `<div class="grid cols-3" style="margin-bottom:16px">${kpi("In · " + view, kip(sums.rev), sums.count + " entries")}${kpi("Out · " + view, kip(sums.exp), "")}${kpi("Net · " + view, (sums.net >= 0 ? "+" : "") + kip(sums.net), "", { hero: true })}</div>` +
          card("Entries", table([{ h: "Date" }, { h: "Type" }, { h: "Category" }, { h: "Method" }, { h: "Amount", r: true }],
            list.map(e => ({
              cells: [
                e.date.slice(5),
                e.kind === "rev" ? `<span class="badge ok">revenue</span>` : `<span class="badge bad">expense</span>`,
                `${e.cat} ${e.source === "payroll" ? `<span class="badge lock">${icon("lock")} payroll</span>` : ""}`,
                `<span class="badge plain">${e.method}</span>`,
                `<span class="num ${e.kind === "rev" ? "pos" : "neg"}">${e.kind === "rev" ? "+" : "−"}${fmt(e.amount)}</span>`
              ]
            }))) + addForm,
            { icon: "book", badge: `<button class="btn xs ghost" data-act="export:ledger">${icon("download")} CSV</button>` })
      };
    },
    close() {
      const t = T(), r = LEDGER.rollup(t.id), posted = LEDGER.hasPayrollLines(t.id);
      return {
        title: "Monthly close", sub: "expense input · accruals · staff-cost pull",
        body: band("calCheck", "Accounting · Monthly close", "Staff cost flows in automatically when you close the pay run — no re-keying.") +
          card("June close checklist", rowlist([
            rowitem({ icon: "check", title: "Revenue entered", sub: kip(r.revenue) + " · monthly", side: badge("ok") }),
            posted
              ? rowitem({ icon: "banknote", title: "Staff cost pulled from payroll", sub: kip(r.staffCost) + " · auto-posted ✓", side: badge("ok") })
              : rowitem({ icon: "banknote", title: "Staff cost — close a pay run to post", sub: kip(r.staffCost) + " · live estimate", side: `<button class="btn xs soft" data-go="owner/web/pay-runs">Run</button>` }),
            rowitem({ icon: "receipt", title: "Other expenses", sub: "rent · utilities · COGS · " + kip(r.otherExp), side: badge("ok") }),
            rowitem({ icon: "chat", title: "Channel fees", sub: "LINE/WA · " + kip(r.channelFee) + " · auto", side: badge("ok") })
          ]), { icon: "calCheck" })
      };
    },
    tax() {
      const t = T(), cal = TAX.calendar(t.id), appl = TAX.applicable(t.id), vat = TAX.vatPeriod(t.id), cur = TAX.current(), hist = TAX.history();
      const lvlMap = { L0: 0, L1: 1, L2: 2, L3: 3 };
      const pct = x => +(x * 100).toFixed(2);
      const stBadge = (s) => s === "filed" ? `<span class="badge ok">filed</span>` : `<span class="badge lock">${icon("lock")} needs level</span>`;
      const calRows = cal.map(p => rowitem({
        icon: p.status === "filed" ? "check" : "calendar",
        title: `${p.type} <span class="badge plain" style="font-size:9px">${p.cadence}</span>`,
        sub: `${p.basis} · due ${p.due}`,
        side: `${p.need ? `<span class="num">${kip(p.amount)}</span>` : ""} ${p.status === "due" ? `${FLAGS.on(t.id, "nudges") ? `<button class="btn xs ghost" data-act="tax:nudge:${p.key}">Nudge</button> ` : ""}<button class="btn xs soft" data-act="tax:file:${p.key}">Mark filed</button>` : stBadge(p.status)}`
      }));
      return {
        title: "Tax centre", sub: `PIT · NSSF · VAT · ${t.entity === "company" ? "CIT" : "Profit Tax"} · figures computed live`,
        actions: `<button class="btn ghost sm" data-act="export:vat">${icon("download")} VAT return</button>`,
        body: band("percent", "Accounting · Tax centre", "Full pack, revealed by level + entity type. The owner files; Adeptio prepares the figure — computed live from payroll and the books.") +
          `<div class="statline">
            <div class="sl-it"><span class="sl-v num">${kip(TAX.pitPeriod(t.id))}</span><span class="sl-l">PIT · this month</span></div>
            <div class="sl-it"><span class="sl-v num">${kip(TAX.nssfPeriod(t.id))}</span><span class="sl-l">NSSF · this month</span></div>
            <div class="sl-it"><span class="sl-v num">${kip(vat.payable)}</span><span class="sl-l">VAT payable · Q2</span></div>
            <div class="sl-it"><span class="sl-v">${t.entity === "company" ? "CIT " + pct(cur.cit) + "%" : "PT " + pct(TAX.profitTaxPeriod(t.id).rate) + "%"}</span><span class="sl-l">${t.entity === "company" ? "company" : "sole · " + t.biz}</span></div>
          </div>
          <div class="grid cols-2">
            ${card("Calendar — mark filed when done", rowlist(calRows), { icon: "calCheck", badge: `<span class="badge warn">${cal.filter(p => p.status === "due").length} due</span>` })}
            ${card("Applicable taxes — this entity", table([{ h: "Tax" }, { h: "Basis" }, { h: "Rate", r: true }, { h: "Level" }], appl.map(a => {
            const locked = lvlMap[t.level] < lvlMap[a.minLevel];
            return { cells: [a.name, `<span class="small muted">${a.basis}</span>`, `<span class="num">${a.rate}</span>`, locked ? `<span class="badge lock">${icon("lock")} ${a.minLevel}</span>` : lvlpill(a.minLevel)] };
          })), { icon: "scale", badge: `<span class="badge ${t.entity === "company" ? "acc" : "plain"}">${t.entity === "company" ? "company · CIT" : "sole · Profit Tax"}</span>` })}
          </div>
          <div style="height:16px"></div>
          ${card("Tax tables — effective-dated", `<div class="grid cols-2">
              <div>${table([{ h: "Rate" }, { h: "Value", r: true }], [
            { cells: ["NSSF employer + employee", `<span class="num">${pct(cur.ss.er)}% + ${pct(cur.ss.ee)}%</span>`] },
            { cells: ["NSSF cap", `<span class="num">${kip(cur.ss.cap)}</span>`] },
            { cells: ["PIT", `<span class="num">0–25% · ${cur.pit.length} bands</span>`] },
            { cells: ["VAT", `<span class="num">${pct(cur.vat)}%</span>`] },
            { cells: [t.entity === "company" ? "CIT" : "Profit Tax · " + t.biz, `<span class="num">${t.entity === "company" ? pct(cur.cit) + "%" : pct(cur.pt[t.biz]) + "%"}</span>`] }
          ])}</div>
              <div>
                <div class="lab" style="font-size:10.5px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);font-weight:600;margin-bottom:6px">Amend a rate (effective-dated)</div>
                <p class="small muted" style="margin-bottom:10px">Editing adds a new effective row — historical, closed runs keep the rate they were computed with.</p>
                <div class="dbform">
                  <span class="small" style="align-self:center">VAT</span>
                  <input class="input sm" data-taxrate="vat" value="${pct(cur.vat)}" inputmode="decimal" style="max-width:74px">
                  <span class="small" style="align-self:center">%</span>
                  <button class="btn sm" data-act="tax:rate-vat">${icon("check")} Apply</button>
                </div>
                <div class="small muted" style="margin-top:10px">Effective rows on file: <b>${hist.length}</b>${hist.length > 1 ? ` · latest from ${hist[hist.length - 1].from}` : ""}</div>
              </div>
            </div>`, { icon: "sliders" })}`
      };
    },
    costbenefit() {
      const t = T(), r = DW.monthly(t.id), ser = DW.series(t.id), months = ser.map(s => s.month);
      const revM = ser.map(s => Math.round(s.revenue / 1e5) / 10), staffM = ser.map(s => Math.round(s.staffCost / 1e5) / 10);
      return {
        title: "Cost & benefit", sub: "derived (dw_reports) · labour-cost vs revenue · margin · cost/head",
        actions: `<button class="btn ghost sm" data-act="export:workbook">${icon("download")} Workbook · all tabs</button>`,
        body: band("trend", "Accounting · Cost & benefit", "Derived by replay — revenue from the cashbook, staff cost from payroll. It rebuilds itself; nothing is re-keyed.") +
          `<div class="grid cols-4" style="margin-bottom:16px">
            ${kpi("Margin", Math.round(r.margin * 100) + "%", "result ÷ revenue", { hero: true })}
            ${kpi("Staff ÷ revenue", Math.round(r.staffRatio * 100) + "%", "labour intensity")}
            ${kpi("Cost / head", kip(r.costPerHead), "÷ " + r.headcount + " staff")}
            ${kpi("Operating result", (r.result >= 0 ? "+" : "") + kip(r.result), "this month")}
          </div>` +
          card("P&L-lite — " + PAYROLL.getRun(t.id).period, table([{ h: "Line" }, { h: "₭ / month", r: true }, { h: "Source" }], [
            { cells: [`<b style="color:var(--ok-text)">Revenue</b>`, `<span class="num">${kip(r.revenue)}</span>`, `<span class="small muted">Σ cashbook revenue</span>`] },
            { cells: ["− Staff cost (gross + employer NSSF)", `<span class="num neg">−${fmt(r.staffCost)}</span>`, `<span class="small muted">Σ payroll cost (live)</span>`] },
            { cells: ["− Rent · utilities · COGS · other", `<span class="num neg">−${fmt(r.otherExp)}</span>`, `<span class="small muted">Σ cashbook expense</span>`] },
            { cells: ["− LINE / WhatsApp fees", `<span class="num neg">−${fmt(r.channelFee)}</span>`, `<span class="small muted">auto ← metering</span>`] },
            { cells: [`<b>Operating result</b>`, `<span class="num ${r.result >= 0 ? "pos" : "neg"}">${r.result >= 0 ? "+" : "−"}${fmt(Math.abs(r.result))}</span>`, `<span class="small muted">at level ${r.level}</span>`] }
          ]) + `<div style="margin-top:14px">${lines2(revM, staffM, months, { fmt: millM })}${UI.legend([{ c: "var(--acc)", l: "Revenue ₭M" }, { c: "var(--muted-2)", l: "Staff cost ₭M" }])}</div>`, { icon: "chart" }) +
          `<div style="height:16px"></div>
          <div class="grid cols-2">
            ${card("Margin trend", bars(ser.map(s => ({ l: s.month, v: Math.round(s.margin * 100), vt: Math.round(s.margin * 100) + "%" })), { values: true, max: 30 }), { icon: "trend" })}
            ${card("Cost per head (₭M)", bars(ser.map(s => ({ l: s.month, v: Math.round(s.costPerHead / 1e5) / 10, tone: "soft" })), { values: true }), { icon: "users" })}
          </div>
          <div class="seal-note brand" style="margin-top:14px">${icon("layers")} <div><b>dw_reports</b> is derived — it rebuilds from the cashbook + payroll by replay. Delete a tenant and its reports vanish with it. The workbook export bundles every tab into one file.</div></div>`
      };
    },
    reports() {
      return {
        title: "Reports & export", sub: "to .csv now (.xlsx/.pdf next) — one-shot, no outside sheet",
        body: band("download", "Accounting · Reports", "Enter once in-app; export any view. CSV downloads are live in this build.") +
          card("Available reports", rowlist([
            rowitem({ icon: "banknote", title: "Payroll register", sub: "all workers, one sheet", side: `<button class="btn xs ghost" data-act="export:payreg">${icon("download")} CSV</button>` }),
            rowitem({ icon: "book", title: "Cashbook ledger", sub: "all entries", side: `<button class="btn xs ghost" data-act="export:ledger">${icon("download")} CSV</button>` }),
            rowitem({ icon: "chart", title: "P&L-lite", sub: "revenue · costs · margin", side: `<button class="btn xs ghost" data-act="export:pl">${icon("download")} CSV</button>` }),
            rowitem({ icon: "shield", title: "NSSF schedule", sub: "employee + employer", side: `<button class="btn xs ghost" data-act="export:nssf">${icon("download")} CSV</button>` }),
            rowitem({ icon: "percent", title: "PIT withholding report", sub: "per employee", side: `<button class="btn xs ghost" data-act="export:pit">${icon("download")} CSV</button>` }),
            rowitem({ icon: "receipt", title: "VAT return", sub: "output − input", side: `<button class="btn xs ghost" data-act="export:vat">${icon("download")} CSV</button>` })
          ]), { icon: "download" })
      };
    },

    /* ---------------- 2.3 SYSTEM ---------------- */
    company() {
      const t = T();
      return {
        title: "Company", sub: "tenant profile · entity type · LAK · locales",
        body: band("briefcase", "System · Company", "Sets the regime — sole trader (Profit Tax on revenue) or company (CIT on profit).") +
          card("Profile", `<div class="grid cols-2">
            <div>${rowlist([
            rowitem({ icon: "store", title: t.name, sub: "Trading name", neutral: true }),
            rowitem({ icon: "briefcase", title: t.entity === "company" ? "Company (CIT)" : "Sole trader (Profit Tax)", sub: "Entity type", neutral: true })
          ])}</div>
            <div>${rowlist([
            rowitem({ icon: "coins", title: "LAK · ₭", sub: "Currency", neutral: true }),
            rowitem({ icon: "globe", title: "English · ລາວ staged", sub: "Locale", neutral: true })
          ])}</div>
          </div>`, { icon: "briefcase" })
      };
    },
    staffdash() {
      const tid = T().id, items = STAFFDASH.layout(tid), M = STAFFDASH.META, COLS = STAFFDASH.COLS;
      const gridRows = Math.max(STAFFDASH.rows(tid), 2);
      const occupied = items.reduce((n, w) => n + w.w * w.h, 0);
      const empties = Math.max(0, gridRows * COLS - occupied);
      const slots = Array.from({ length: empties }, () => `<div class="dbx-slot"></div>`).join("");
      const widget = (w) => {
        const m = M[w.id];
        const head = `<div class="dbx-w-head"><span class="dbx-w-ic">${icon(m.icon)}</span><span class="dbx-w-t">${m.label}</span>${m.fixed ? `<span class="badge acc">${icon("lock")} pinned</span>` : `<button class="dbx-x" data-act="staffdash:remove:${w.id}" aria-label="Remove">${icon("x")}</button>`}</div>`;
        const tools = m.fixed ? "" : `<div class="dbx-tools">
            <div class="dbx-pad"><button data-act="staffdash:move:${w.id}:0:-1" aria-label="Up">${icon("chevD", "flip")}</button><button data-act="staffdash:move:${w.id}:-1:0" aria-label="Left">${icon("chevL")}</button><button data-act="staffdash:move:${w.id}:1:0" aria-label="Right">${icon("chevR")}</button><button data-act="staffdash:move:${w.id}:0:1" aria-label="Down">${icon("chevD")}</button></div>
            <div class="dbx-szbtns"><button data-act="staffdash:resize:${w.id}:-1:0" title="Narrower">W−</button><button data-act="staffdash:resize:${w.id}:1:0" title="Wider">W+</button><button data-act="staffdash:resize:${w.id}:0:-1" title="Shorter">H−</button><button data-act="staffdash:resize:${w.id}:0:1" title="Taller">H+</button></div>
          </div>`;
        return `<div class="dbx-widget${m.fixed ? " fixed" : ""}" data-wid="${w.id}"${m.fixed ? "" : ` data-drag="${w.id}"`} style="grid-column:${w.x + 1}/span ${w.w};grid-row:${w.y + 1}/span ${w.h}">
          ${head}<div class="dbx-w-meta">${m.cat} · ${w.w}×${w.h}${m.fixed ? "" : " · drag to move"}</div>${tools}
          ${m.fixed ? "" : `<span class="dbx-resize" data-resize="${w.id}" title="Drag to resize">${icon("chevR", "diag")}</span>`}
        </div>`;
      };
      const canvas = `<div class="dbx-grid" style="--cols:${COLS}" data-dbx="1">${slots}${items.map(widget).join("")}</div>`;
      const catalog = STAFFDASH.catalogOpen() ? `<div style="height:16px"></div>` + card("Add a widget", `<p class="small muted" style="margin-bottom:10px">Grouped by data source. Click to drop it onto the first free spot.</p><div class="dbx-cat">${(STAFFDASH.available(tid).map(c => `<div class="dbx-cat-group"><div class="dbx-cat-name">${icon(c.icon)} ${c.cat}</div>${c.items.map(it => `<button class="dbx-cat-item" data-act="staffdash:add:${it.id}"><span class="dci-ic">${icon(it.icon)}</span><span class="dci-main"><span class="dci-t">${it.label}</span><span class="dci-d">${it.desc} · ${it.w}×${it.h}</span></span><span class="dci-add">${icon("plus")}</span></button>`).join("")}</div>`).join("")) || `<div class="se-empty small muted">Every widget is already on the dashboard.</div>`}</div>`, { icon: "grid", badge: `<button class="btn xs ghost" data-act="staffdash:catalog:close">${icon("x")} Close</button>` }) : "";
      return {
        title: "Staff dashboard", sub: "Compose what staff see on Home — add · resize · position widgets (SFDC-style)",
        actions: `<button class="btn sm" data-act="staffdash:catalog:${STAFFDASH.catalogOpen() ? "close" : "open"}">${icon("plus")} Add widget</button><button class="btn ghost sm" data-act="staffdash:reset">${icon("refresh")} Reset</button><button class="btn ghost sm" data-go="staff/web/today">${icon("eye")} Preview as staff</button>`,
        body: band("grid", "System · Staff dashboard builder", "Pick information frames from the catalog (grouped by data source), then drag to reposition and drag the corner to resize on the grid — Salesforce-style. Announcements stays pinned at the top.") +
          card("Dashboard canvas", `<p class="small muted" style="margin-bottom:12px">${items.length} widget${items.length === 1 ? "" : "s"} · ${COLS} columns. Drag a widget to move it, drag its corner to resize — or use the on-card buttons.</p>${canvas}`, { icon: "grid", badge: `<span class="badge plain">${items.length} placed</span>` }) +
          catalog
      };
    },
    functions() {
      const tid = T().id;
      const sw = (fe) => `<button class="switch" aria-checked="${FLAGS.on(tid, fe)}" role="switch" data-act="flags:toggle:${fe}" aria-label="${FLAGS.REGISTRY[fe].label}"></button>`;
      const optRow = (fe, ic) => rowitem({ icon: ic, title: FLAGS.REGISTRY[fe].label, sub: FLAGS.REGISTRY[fe].scope === "owner" ? "Owner only" : "Owner + Mgr", side: sw(fe) });
      return {
        title: "Functions", sub: "feature flags — off hides the menu + pauses the engine, data retained · audited",
        body: band("power", "System · Functions", "Core is always on. Everything else is a per-tenant switch — flip Scheduling or EWA and watch the rail change. A manager may tune operations; money & policy flags are owner-only.") +
          `<div class="grid cols-2">
            ${card("Core — locked on", rowlist(FLAGS.CORE.map(c => rowitem({ icon: "lock", title: c[1], side: `<span class="badge lock">${icon("lock")} core</span>` }))), { icon: "lock" })}
            ${card("Optional — your switches", rowlist([
            optRow("geofence", "pin"), optRow("scheduling", "calendar"), optRow("shiftswap", "swap"),
            optRow("etd", "wallet"), optRow("nudges", "percent"), optRow("labourcost", "trend"),
            optRow("ewa", "wallet"), optRow("onetap", "banknote"), optRow("line", "chat"),
            optRow("whatsapp", "chat"), optRow("cloudbackup", "cloud")
          ]), { icon: "sliders" })}
          </div>
          <div class="seal-note" style="margin-top:14px">${icon("history")} <div>Off ≠ delete — the data stays and re-enabling restores it. Every flip writes a <span class="mono">flag.set</span> audit fact. (EWA is off by default → its <b>Advances</b> menu is hidden until you switch it on.)</div></div>`
      };
    },
    integrations() {
      return {
        title: "Integrations", sub: "LINE · WhatsApp · Sysmatik devices · directory · email",
        body: band("plug", "System · Integrations", "Connect the channels and hardware. LINE & WhatsApp accounts are under registration — wiring is ready.") +
          card("Connections", rowlist([
            rowitem({ icon: "chat", title: "LINE Official Account", sub: "Messaging API · Thailand region", side: `<span class="pending-chip">${icon("clock")} account in registration</span>` }),
            rowitem({ icon: "chat", title: "WhatsApp Business (Cloud API)", sub: "Meta · postpaid", side: `<span class="pending-chip">${icon("clock")} account in registration</span>` }),
            rowitem({ icon: "pulse", title: "Sysmatik devices", sub: "ZKTeco · Hikvision terminals", side: `<button class="btn xs ghost">Connect</button>` }),
            rowitem({ icon: "mail", title: "Email (SMTP relay)", sub: "activation · payslip · records", side: badge("active") }),
            rowitem({ icon: "cloud", title: "Dropbox + Google Drive", sub: "weekly backup destination", side: `<button class="btn xs ghost">Connect</button>` })
          ]), { icon: "plug" })
      };
    },
    users() {
      return {
        title: "Users & roles", sub: "scope map · break-glass · sessions",
        body: band("users", "System · Users & roles", "No new permission engine — the parent's scopes, re-bundled. Owner holds the union; managers a subset.") +
          card("Role map", table([{ h: "Role" }, { h: "= parent scopes" }, { h: "Seats", r: true }], [
            { cells: [`<span class="badge plain">staff</span>`, "staff", `<span class="num">10</span>`] },
            { cells: [`<span class="badge plain">manager</span>`, "manager (delegated)", `<span class="num">3</span>`] },
            { cells: [`<span class="badge acc">owner</span>`, "manager + hr + ceo + sysadmin", `<span class="num">1</span>`] }
          ]), { icon: "users" })
      };
    },
    datastudio() {
      const stores = ["db_people", "db_time", "db_leave", "db_workflow", "db_payroll", "db_ledger", "db_tax", "db_comms", "db_docs", "db_audit", "db_license"];
      return {
        title: "Data studio", sub: "stores · backup/restore · per-tenant export · purge",
        actions: `<button class="btn ghost sm" data-act="dbops:export">${icon("download")} Export tenant</button><button class="btn sm" data-act="dbops:backup">${icon("layers")} Back up now</button>`,
        body: band("database", "System · Data studio", "Your slice of the shared database — add, back up, restore, export. Bounded to this tenant_id.") +
          `<div class="dbgrid">${stores.map(s => `<div class="card stcard"><div class="st-top">${icon("layers")}<span class="st-name mono">${s}${["db_payroll", "db_ledger", "db_tax"].includes(s) ? ' <span class="badge bad" style="font-size:9px">sealed</span>' : ""}</span></div><div class="st-stats"><span>rows <b class="num">${[210, 1840, 96, 320, 21, 412, 18, 540, 64, 1290, 1][stores.indexOf(s)]}</b></span><span>tenant <b class="mono">${T().short}</b></span></div></div>`).join("")}</div>` +
          card("Backups & restore — this tenant only", rowlist(DBOPS.list(T().id).map(b => rowitem({ icon: b.kind === "snapshot" ? "shield" : "layers", title: b.id + " · " + b.kind, sub: b.at + " · scope " + b.scope, side: `<button class="btn xs ghost" data-act="dbops:restore:${b.id}">Restore</button>` }))), { icon: "history", badge: `<span class="badge ok">scoped to ${T().short}</span>` }) +
          `<div class="seal-note brand" style="margin-top:14px">${icon("shield")} <div>Sealed stores (payroll · ledger · tax) are server-authoritative — money never rides the open browser sync. Reset / purge / migrate are platform-level; to leave, request closure.</div></div>`
      };
    },
    audit() {
      return {
        title: "Audit & logs", sub: "append-only facts · sign-ins · exports · changes",
        body: band("history", "System · Audit", "Salary amounts and tax IDs never appear in the audit body — only references.") +
          card("Recent facts", table([{ h: "Fact" }, { h: "Who" }, { h: "When" }, { h: "Ref" }], DATA.AUDIT.slice(0, 12).map(a => ({
            cells: [`<span class="mono">${a.fact}</span>`, a.who, `<span class="small muted">${a.when}</span>`, `<span class="idtag">${a.ref}</span>`]
          }))), { icon: "history" })
      };
    },

    /* ---------------- 2.4 CAPACITY ---------------- */
    plan() {
      return {
        title: "Plan & tier", sub: "free / paid · what's included · upgrade",
        body: band("tag", "Capacity · Plan", "Free forever for a small shop — pay only for reach (LINE/WhatsApp) and capacity add-ons.") +
          `<div class="grid cols-2">
            ${card("Current plan", `<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px"><span style="width:40px;height:40px;border-radius:12px;background:var(--acc-bg);border:1px solid var(--acc-ln);display:grid;place-items:center;color:var(--acc-d)">${icon("tag")}</span><div><div style="font-size:22px;font-weight:600">Free</div><div class="small muted">10 staff · 3 mgr · 1 admin · in-app + email free</div></div></div>${UI.badge("active")}`, { icon: "tag" })}
            ${card("Upgrade path", `<p class="small muted">Outgrow 14 seats? Move to the 5-persona enterprise line — same stores, same tenant_id, no migration.</p><button class="btn ghost" style="margin-top:10px">${icon("layers")} See enterprise tiers</button>`, { icon: "trend" })}
          </div>`
      };
    },
    seats() {
      const t = T();
      return {
        title: "Seats", sub: "active staff vs limit · meter",
        body: band("users", "Capacity · Seats", "Free tier is 10 staff + 3 managers + 1 admin = 14. The Platform Admin can raise caps.") +
          card("Seat buckets", `<div class="capstrip">
            ${segMeter("Staff", t.seats.staff.used, t.seats.staff.limit)}
            ${segMeter("Managers", t.seats.manager.used, t.seats.manager.limit)}
            ${segMeter("Admin", t.seats.admin.used, t.seats.admin.limit)}
          </div>`, { icon: "users" })
      };
    },
    quotas() {
      const t = T();
      return {
        title: "Message quotas", sub: "LINE · WhatsApp — used / left · top-up",
        body: band("chat", "Capacity · Message quotas", "Metered channels carry a real provider cost — each send debits the quota and posts a fee to Accounting.") +
          card("This cycle", `<div class="capstrip">
            ${segMeter("LINE", t.quota.line.used, t.quota.line.limit)}
            ${segMeter("WhatsApp", t.quota.whatsapp.used, t.quota.whatsapp.limit)}
          </div><div style="margin-top:12px"><span class="pending-chip">${icon("clock")} LINE & WhatsApp accounts in registration — metering ready</span></div>`, { icon: "chat", badge: `<button class="btn xs soft">Top up</button>` })
      };
    },
    storage() {
      const t = T();
      return {
        title: "Storage & add-ons", sub: "docs · devices · channels — metered",
        body: band("box", "Capacity · Storage", "Documents, device connections and channel add-ons — all metered, all visible before the bill.") +
          card("Usage", `${segMeter("Storage (GB)", t.storage.used, t.storage.limit, { unit: "GB" })}<div style="height:10px"></div>${UI.rowlist([UI.rowitem({ icon: "pulse", title: "Sysmatik device add-on", sub: "0 connected", side: UI.badge("plain") }), UI.rowitem({ icon: "cloud", title: "Cloud backup", sub: "off", side: UI.badge("plain") })])}`, { icon: "box" })
      };
    },
    billing() {
      return {
        title: "Billing", sub: "usage statement · invoices (future charges)",
        body: band("receipt", "Capacity · Billing", "Honest billing — what a channel costs is shown before the bill, never a surprise overage.") +
          card("This cycle", table([{ h: "Item" }, { h: "Usage" }, { h: "Charge", r: true }], [
            { cells: ["Platform (Free tier)", "10/3/1 seats", `<span class="num">₭ 0</span>`] },
            { cells: ["LINE messages", `${T().quota.line.used} of ${T().quota.line.limit} sent`, `<span class="num">pending</span>`] },
            { cells: ["WhatsApp", `${T().quota.whatsapp.used} of ${T().quota.whatsapp.limit} sent`, `<span class="num">pending</span>`] }
          ]), { icon: "receipt" })
      };
    }
  };

  // tiny helpers used in payslip card title
  function run_safe(t) { return PAYROLL.getRun(t.id); }
  function run_lvl(run) { return "level " + run.level; }

  /* ---------------- mobile (owner on-the-floor subset) ---------------- */
  const mobile = {
    home() {
      const a = DATA.ATT_TODAY, t = T(), r = LEDGER.rollup(t.id), run = PAYROLL.getRun(t.id);
      return {
        title: t.name, body: `
        ${tile({ label: "In today", icon: "users", value: `${a.in}/${a.total}`, sub: `<span class="badge warn">${a.flags} flags</span>`, accent: true })}
        ${tile({ label: "Cash · month", icon: "trend", value: (r.result >= 0 ? "+" : "") + kip(r.result) })}
        ${tile({ label: "Pay due", icon: "banknote", value: kip(run.totals.cost), sub: `<span class="badge ${run.state === "close" ? "ok" : "plain"}">${run.state}</span>` })}
        ${card("Capacity", `${segMeter("LINE", t.quota.line.used, t.quota.line.limit)}`)}`
      };
    },
    staff() { return { title: "Staff", body: `${card("Needs you", rowlist([rowitem({ icon: "calCheck", title: "2 leave requests", side: `<button class="btn xs soft">Review</button>` }), rowitem({ icon: "pin", title: "2 geofence flags", side: `<button class="btn xs soft">Open</button>` })]))}` }; },
    pay() { const run = PAYROLL.getRun(T().id); return { title: "Pay", body: `${kpi(run.id, kip(run.totals.cost), run.state + " · net " + kip(run.totals.net))}${card("One-tap", `<p class="small muted" style="margin-bottom:10px">Preview totals → approve → pay → file.</p><button class="btn" style="width:100%;justify-content:center" data-act="pay-run:oneclick">${icon("banknote")} Run payroll</button>`)}` }; },
    books() { const t = T(), day = LEDGER.sums(LEDGER.ranged(t.id, "day")); return { title: "Accounting", body: `${kpi("Net · day", (day.net >= 0 ? "+" : "") + kip(day.net), day.count + " entries")}<button class="btn" style="width:100%;justify-content:center" data-go="owner/web/cashbook">${icon("plus")} Add cash / expense</button>${card("This month", `${segMeter("Margin", Math.round(LEDGER.rollup(t.id).margin * 100), 100, { unit: "%" })}`)}` }; },
    more() { return { title: "More", body: card("", rowlist([rowitem({ icon: "percent", title: "Tax centre", go: "owner/web/tax" }), rowitem({ icon: "settings", title: "System (open on web)", neutral: true }), rowitem({ icon: "gauge", title: "Capacity", go: "owner/web/plan" })])) }; }
  };

  return { web, mobile };
})();
