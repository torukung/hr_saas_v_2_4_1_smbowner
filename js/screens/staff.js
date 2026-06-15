/* ============================================================
   ADEPTIO · Staff Portal screens (ochre) — v2.4.1.smbowner
   Mobile-first PWA + web. The punch is sacred: selfie + GPS +
   timestamp, never-block, offline queue. Sees only own record.
   ============================================================ */
window.SCR_STAFF = (function () {
  const { icon, kip, card, kpi, badge, table, rowlist, rowitem, donut, heatcal, empty, meter } = UI;
  const me = () => DATA.me();
  const slip = DATA.PAYSLIP;

  /* ---------------- web ---------------- */
  const web = {
    today() {
      return {
        title: "Good morning, Khamla", sub: "Tuesday · 15 June 2026 · Phoungern Co.",
        body: `
        <div class="grid cols-3" style="margin-bottom:16px">
          ${kpi("This week", "32.5<small> h</small>", `<span class="up">on track</span> · 6 shifts`)}
          ${kpi("Leave balance", "8.0<small> days</small>", "annual · 1.5 used")}
          ${kpi("Next pay", kip(slip.net), "<span class='badge ok'>25 Jun</span>")}
        </div>
        <div class="grid cols-2">
          ${card("Clock", `
            <div class="clock-hero">
              <div class="ch-line">
                <div><div class="ch-time num">— : —</div><div class="ch-sub">You're clocked out · last out 18:02 ✓ synced</div></div>
                <button class="ch-btn" data-go="staff/web/clock">${icon("clock")} Clock in</button>
              </div>
              <div class="geo">${icon("pin")} Main shop · within 30 m geofence</div>
            </div>`, { icon: "clock" })}
          ${card("Notices", rowlist([
          rowitem({ icon: "banknote", title: "June payslip is ready", sub: "Tap to see the breakdown", side: badge("ok") }),
          rowitem({ icon: "calendar", title: "Shift reminder · tomorrow 09:00", sub: "via LINE", neutral: true }),
          rowitem({ icon: "megaphone", title: "Owner: Songkran roster posted", sub: "2 days ago", neutral: true })
        ]), { icon: "inbox", link: "staff/web/inbox", linkLabel: "Inbox" })}
        </div>`
      };
    },
    clock() {
      return {
        title: "Clock in / out", sub: "Selfie + GPS + timestamp · never blocks, even offline",
        body: `
        <div class="grid cols-2">
          ${card("Punch", `
            <div class="clock-hero">
              <div class="ch-line">
                <div><div class="ch-time num">08:58</div><div class="ch-sub">Tuesday 15 June</div></div>
                <button class="ch-btn">${icon("camera")} Selfie & clock in</button>
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
      return {
        title: "My attendance", sub: "June 2026 · history, grade & fix-requests",
        actions: `<button class="btn ghost sm">${icon("edit")} Request a fix</button>`,
        body: `
        <div class="grid cols-3" style="margin-bottom:16px">
          ${kpi("Present", "11<small> days</small>", "this month")}
          ${kpi("Late", "1<small> day</small>", "<span class='down'>geofence flag</span>")}
          ${kpi("On-time rate", "92%", "<span class='up'>+4 vs May</span>")}
        </div>
        <div class="grid cols-2">
          ${card("June", heatcal({ until: 11, levels: { 12: "bad" } }), { icon: "calendar" })}
          ${card("Recent", table([{ h: "Date" }, { h: "In" }, { h: "Out" }, { h: "Grade" }], [
          { cells: ["Mon 14", "09:01", "18:02", `<span class="badge ok">evidence</span>`] },
          { cells: ["Sat 12", "09:18", "18:05", badge("late")] },
          { cells: ["Fri 11", "08:57", "18:00", `<span class="badge ok">evidence</span>`] },
          { cells: ["Thu 10", "09:00", "17:58", `<span class="badge ok">evidence</span>`] }
        ]), { icon: "history" })}
        </div>`
      };
    },
    leave() {
      return {
        title: "Leave", sub: "Request time off · see balance & status",
        actions: `<button class="btn">${icon("plus")} Request leave</button>`,
        body: `
        <div class="grid cols-3">
          ${card("Balance", `<div style="display:flex;gap:16px;align-items:center">${donut(53)}<div><div class="num" style="font-size:26px;font-weight:600">8.0</div><div class="small muted">of 15 annual days left</div></div></div>`, { icon: "calendar" })}
          ${card("My requests", rowlist([
          rowitem({ icon: "calendar", title: "Annual · 3 days", sub: "22–24 Jun", side: badge("approved") }),
          rowitem({ icon: "calendar", title: "Sick · 1 day", sub: "5 Jun", side: badge("approved") })
        ]), { span: 2, icon: "list" })}
        </div>`
      };
    },
    schedule() {
      return {
        title: "My schedule", sub: "Shifts this week · swap or pick an open shift",
        body: `
        <div class="grid cols-2">
          ${card("This week", rowlist(DATA.SHIFTS.map(s => rowitem({
          icon: "calendar", title: `${s.day} · 09:00–18:00`, sub: s.open ? `${s.open} open shift available` : "Assigned to you",
          side: s.open ? `<button class="btn xs soft">Claim</button>` : badge("published")
        }))), { icon: "calendar" })}
          ${card("Swap a shift", `<p class="small muted" style="margin-bottom:12px">Offer a shift to a teammate — the owner approves, and the Lao OT guardrail (≤3h/day, ≤45h/mo) is auto-checked so a swap can't create illegal overtime.</p>
            <button class="btn ghost">${icon("swap")} Offer Thu 18 to a teammate</button>`, { icon: "swap" })}
        </div>`
      };
    },
    pay() {
      const etd = PAYROLL.earnedToDate(me()), ewaOn = FLAGS.on("phoungern", "ewa");
      return {
        title: "My pay", sub: "Payslips · earned-to-date · why every number",
        actions: `<button class="btn ghost sm">${icon("download")} Payslip PDF</button>`,
        body: `
        <div class="grid cols-3" style="margin-bottom:16px">
          ${FLAGS.on("phoungern", "etd") ? kpi("Earned to date", kip(etd.etdNet), etd.daysWorked + " of " + etd.workdays + " days · live", { hero: true }) : kpi("Earned to date", "—", "tracker off in Functions")}
          ${kpi("Last net pay", kip(slip.net), "May · paid ✓")}
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
      return {
        title: "Inbox", sub: "Announcements & alerts · in-app · LINE · WhatsApp",
        body: card("Messages", rowlist([
          rowitem({ icon: "banknote", title: "Your June payslip is ready", sub: "in-app · 14 Jun 18:04", side: badge("ok") }),
          rowitem({ icon: "calendar", title: "Shift reminder — tomorrow 09:00", sub: "LINE · 14 Jun 07:30", neutral: true }),
          rowitem({ icon: "megaphone", title: "Owner broadcast: Songkran roster", sub: "LINE · 13 Jun 12:00", neutral: true }),
          rowitem({ icon: "check", title: "Leave approved · 22–24 Jun", sub: "in-app · 12 Jun", neutral: true })
        ]), { icon: "inbox" })
      };
    },
    me() {
      return {
        title: "Me", sub: "Profile · sign-in method · security",
        body: `
        <div class="grid cols-2">
          ${card("Profile", `<div style="display:flex;gap:14px;align-items:center;margin-bottom:8px">${UI.avatar("Khamla Sisombat", true)}<div><div style="font-weight:700;font-size:15px">Khamla Sisombat</div><div class="small muted">Barista · Floor · PG-010</div></div></div>
            <div class="statline"><div class="sl-it"><span class="sl-v">2 Mar 26</span><span class="sl-l">Joined</span></div><div class="sl-it"><span class="sl-v">Phoungern</span><span class="sl-l">Company</span></div></div>`, { icon: "user" })}
          ${card("Sign-in & security", rowlist([
          rowitem({ icon: "key", title: "Password", sub: "Changed 2 weeks ago", side: `<button class="btn xs ghost">Change</button>` }),
          rowitem({ icon: "phone", title: "This device", sub: "iPhone · active now", side: badge("ok") }),
          rowitem({ icon: "globe", title: "Language", sub: "English · ລາວ coming", side: `<span class="pending-chip">${icon("globe")} ລາວ soon</span>` })
        ]), { icon: "shield" })}
        </div>`
      };
    }
  };

  /* ---------------- mobile PWA ---------------- */
  const mobile = {
    today() {
      return {
        title: "Today", body: `
        <div class="clock-hero">
          <div class="ch-line"><div><div class="ch-sub">Tuesday 15 June</div><div class="ch-time num">— : —</div></div></div>
          <div class="ch-line" style="margin-top:10px"><div class="ch-sub">You're clocked out · last 18:02 ✓</div><button class="ch-btn">${icon("clock")} Clock in</button></div>
          <div class="geo">${icon("pin")} Main shop · within 30 m</div>
        </div>
        ${kpi("This week", "32.5<small> h</small>", "6 shifts · on track")}
        ${card("Notices", rowlist([
          rowitem({ icon: "banknote", title: "Payslip ready", sub: "June", side: badge("ok") }),
          rowitem({ icon: "calendar", title: "Shift 09:00 tomorrow", sub: "LINE", neutral: true })
        ]))}`
      };
    },
    clock() {
      return {
        title: "Clock", body: `
        <div class="clock-hero">
          <div class="ch-line"><div><div class="ch-time num">08:58</div><div class="ch-sub">Selfie + GPS</div></div><button class="ch-btn">${icon("camera")} Clock in</button></div>
          <div class="geo">${icon("pin")} 12 m from pin · evidence ✓</div>
        </div>
        ${card("Today", rowlist([
          rowitem({ icon: "clock", title: "Out · 18:02", sub: "Main shop", side: `<span class="badge ok">ok</span>` }),
          rowitem({ icon: "clock", title: "In · 09:01", sub: "Main shop", side: `<span class="badge ok">ok</span>` })
        ]))}`
      };
    },
    leave() {
      return { title: "Leave", body: `${card("Balance", `<div style="display:flex;gap:14px;align-items:center">${donut(53)}<div><div class="num" style="font-size:22px;font-weight:600">8.0</div><div class="small muted">days left</div></div></div>`)}<button class="btn" style="width:100%;justify-content:center">${icon("plus")} Request leave</button>` };
    },
    pay() {
      return {
        title: "Pay", body: `${kpi("Last net pay", kip(slip.net), "May · paid ✓")}
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
          rowitem({ icon: "user", title: "Me", go: "staff/mobile/me" })
        ]))
      };
    },
    attendance() { return { title: "Attendance", back: "staff/mobile/more", body: card("June", heatcal({ until: 11, levels: { 12: "bad" } })) }; },
    schedule() { return { title: "Schedule", back: "staff/mobile/more", body: card("This week", rowlist(DATA.SHIFTS.slice(0, 5).map(s => rowitem({ icon: "calendar", title: `${s.day} 09:00–18:00`, sub: s.open ? "open shift" : "assigned", side: s.open ? `<button class="btn xs soft">Claim</button>` : badge("published") })))) }; },
    documents() { return { title: "Documents", back: "staff/mobile/more", body: card("", rowlist([rowitem({ icon: "file", title: "Contract", sub: "Signed" }), rowitem({ icon: "idcard", title: "National ID", side: badge("ok") })])) }; },
    inbox() { return { title: "Inbox", back: "staff/mobile/more", body: card("", rowlist([rowitem({ icon: "banknote", title: "Payslip ready", sub: "in-app" }), rowitem({ icon: "calendar", title: "Shift reminder", sub: "LINE" })])) }; },
    me() { return { title: "Me", back: "staff/mobile/more", body: card("Profile", `<div style="display:flex;gap:12px;align-items:center">${UI.avatar("Khamla Sisombat", true)}<div><b>Khamla Sisombat</b><div class="small muted">Barista · PG-010</div></div></div>`) }; }
  };

  return { web, mobile };
})();
