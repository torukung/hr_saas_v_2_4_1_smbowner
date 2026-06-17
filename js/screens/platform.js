/* ============================================================
   ADEPTIO · Platform Console screens (teal) — v2.4.1.smbowner
   The operator above every shop. tenant_id = null; the data guard
   INVERTS — sees across tenants, but resources & lifecycle only,
   never sealed salary / PII / KYC content (break-glass + audited).
   ============================================================ */
window.SCR_PLATFORM = (function () {
  const { icon, kip, card, kpi, tile, badge, table, rowlist, rowitem, meter, segMeter, flowRail } = UI;
  const band = (ic, t, s) => `<div class="intro-band"><div class="ib-ic">${icon(ic)}</div><div><div class="ib-t">${t}</div><div class="ib-s">${s}</div></div></div>`;

  const resMeter = (used, total, tone) => `<div class="res-meter">${meter(total ? Math.round(used / total * 100) : 0, tone)}<span class="mono">${used}/${total}</span></div>`;
  const statusBadge = (s) => s === "active" ? badge("active") : s === "pending" ? `<span class="badge warn">pending KYC</span>` : `<span class="badge bad">${s}</span>`;

  const web = {
    overview() {
      const st = DATA.platformStats(), kyc = window.REG && REG.kycOn();
      // one master feature switch for the whole platform — KYC & registration on/off (default off)
      const master = `<div class="kyc-master ${kyc ? "on" : "off"}" style="margin-bottom:16px">
        <span class="km-ic">${icon("idcard")}</span>
        <div class="km-main"><div class="km-t">KYC &amp; registration ${kyc ? `<span class="badge ok">on</span>` : `<span class="badge bad">off</span>`}</div>
          <div class="km-s">${kyc ? "Self-serve shop registration and ID ↔ selfie review are live across the whole platform." : "Registration, the KYC review hub and every related menu are disabled platform-wide. Turn on to open the funnel."}</div></div>
        <button class="switch" role="switch" aria-checked="${kyc}" data-act="kyc:feature:${kyc ? "off" : "on"}" aria-label="KYC feature on/off"></button>
      </div>`;
      const platformLoad = card("Platform load", `<div class="capstrip">
            ${segMeter("Shared DB rows", 5210, 100000, { unit: "" })}
            ${segMeter("Workers / day", 12, 100, { unit: "k" })}
            ${segMeter("Storage (GB)", 0.6, 10, { unit: "GB" })}
          </div><div class="seal-note ok" style="margin-top:12px">${icon("check")} Shared-schema multi-tenancy — a new tenant is rows, not servers. Free-tier headroom is wide.</div>`, { icon: "pulse" });
      return {
        title: "Platform overview", sub: "Tenants live · platform load · alerts",
        body: master + `
        <div class="tilegrid" style="margin-bottom:16px">
          ${tile({ label: "Tenants live", icon: "store", value: st.tenants, sub: `of ${st.total} registered`, accent: true })}
          ${kyc ? tile({ label: "Pending KYC", icon: "idcard", value: st.pending, sub: `<span class="badge warn">needs review</span>`, go: "platform/web/registrations" }) : tile({ label: "Storage", icon: "box", value: "0.6", sub: "GB · shared" })}
          ${tile({ label: "Seats in use", icon: "users", value: st.seatsUsed, sub: "across the fleet" })}
          ${tile({ label: "Messages this cycle", icon: "chat", value: st.msgUsed, sub: "LINE + WhatsApp" })}
        </div>
        <div class="grid cols-2">
          ${kyc
          ? card("KYC queue", rowlist(DATA.pendingKyc().map(r => rowitem({
            icon: "idcard", title: r.company, sub: `${r.owner} · ${r.submitted}`,
            side: `<span class="badge ${r.match === "strong" ? "ok" : "warn"}">${r.match}</span> <button class="btn xs soft" data-go="platform/web/registrations">Review</button>`
          }))), { icon: "idcard", link: "platform/web/registrations" })
          : card("Registration disabled", `<div class="seal-note" style="margin:0">${icon("ban")} <div>KYC &amp; registration is <b>off</b>. New shops can't self-register and the review hub is hidden. Enable it above to reopen the queue.</div></div>`, { icon: "ban" })}
          ${platformLoad}
        </div>`
      };
    },

    registrations() {
      const pend = REG.pending(), c = REG.counts(), ch = REG.getChannel(), ad = REG.autoDisable(), focus = pend.find(r => r.match === "strong") || pend[0];
      const stB = (s) => s === "active" ? badge("active") : s === "pending" ? `<span class="badge warn">pending</span>` : s === "disabled" ? `<span class="badge bad">disabled</span>` : `<span class="badge bad">${s}</span>`;
      const sw = (on) => `<button class="switch" aria-checked="${on}" role="switch" data-act="kyc:autodisable"></button>`;
      return {
        title: "KYC & registration", sub: "one hub — register queue · ID↔selfie review · email channel · auto-disable",
        body: band("idcard", "Control plane · KYC", "Manage the whole funnel here: incoming registrations, KYC verification, the email channel that delivers password/confirmation links, and the auto-disable rule for stale applications.") +
          `<div class="statline">
            <div class="sl-it"><span class="sl-v num">${c.pending}</span><span class="sl-l">pending</span></div>
            <div class="sl-it"><span class="sl-v num">${c.active}</span><span class="sl-l">active</span></div>
            <div class="sl-it"><span class="sl-v num">${c.disabled}</span><span class="sl-l">auto-disabled</span></div>
            <div class="sl-it"><span class="sl-v num">${c.total}</span><span class="sl-l">total</span></div>
          </div>
          <div class="grid cols-2">
            ${card("Email channel — password delivery & confirmation", `
              <div style="display:flex;flex-direction:column;gap:10px">
                <div class="field" style="margin:0"><label>Provider</label><select class="input sm" data-ch="provider"><option ${ch.provider === "SMTP" ? "selected" : ""}>SMTP</option><option ${ch.provider === "ESP" ? "selected" : ""}>ESP (HTTP API)</option></select></div>
                <div class="field" style="margin:0"><label>Host</label><input class="input sm" data-ch="host" value="${ch.host}"></div>
                <div class="grid cols-2" style="gap:0 10px"><div class="field" style="margin:0"><label>Port</label><input class="input sm" data-ch="port" value="${ch.port}"></div><div class="field" style="margin:0"><label>From</label><input class="input sm" data-ch="from" value="${ch.from}"></div></div>
                <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><button class="btn sm" data-act="kyc:channel-save">${icon("check")} Save channel</button><button class="btn ghost sm" data-act="kyc:channel-test">${icon("mail")} Send test</button><span class="badge ${ch.status === "connected" ? "ok" : "warn"}">${ch.status}</span></div>
              </div>
              <div class="seal-note" style="margin-top:12px">${icon("lock")} On activation the owner is emailed a 72-h set-password link via this channel. Tokens sealed; sends logged as <span class="mono">auth.invite</span>.</div>`, { icon: "mail" })}
            ${card("Auto-disable stale registrations", `
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">${sw(ad.on)}<div><div style="font-weight:600">Auto-disable ${ad.on ? "on" : "off"}</div><div class="small muted">pending past ${ad.days} days → disabled</div></div></div>
              ${rowlist([rowitem({ icon: "history", title: "Disabled (stale)", sub: "expired pending registrations", side: `<span class="badge bad">${c.disabled}</span>` }), rowitem({ icon: "clock", title: "Deadline window", sub: ad.days + " days from submit", neutral: true, side: `<span class="badge plain">${ad.days}d</span>` })])}
              <div class="seal-note ok" style="margin-top:10px">${icon("check")} Keeps the shared free DB clean — abandoned KYC never lingers as a live tenant.</div>`, { icon: "ban" })}
          </div>
          <div style="height:16px"></div>` +
          (focus ? card(`Review · ${focus.company}`, `
          <div class="kyc-review">
            <div class="kyc-doc"><div class="kd-head">${icon("idcard")} ID card</div><div class="kyc-img">${icon("idcard")}<div class="kdesc">${focus.idType} · ${focus.owner}</div></div></div>
            <div class="kyc-doc"><div class="kd-head">${icon("camera")} Owner selfie</div><div class="kyc-img">${icon("user")}<div class="kdesc">Compare face ↔ ID</div></div></div>
          </div>
          <div class="grid cols-2" style="margin-top:14px">
            <div class="kyc-meta">
              <div class="kyc-fact">${icon("store")} <span><b>${focus.company}</b> · ${focus.entity}</span></div>
              <div class="kyc-fact">${icon("mail")} <span>${focus.email}</span></div>
              <div class="kyc-fact">${icon("phone")} <span>${focus.phone}</span></div>
              <div class="kyc-fact">${icon("clock")} <span>submitted ${focus.submitted} · deadline ${focus.deadline}</span></div>
              <div class="kyc-fact">${icon("check")} <span>Face match: <b>${focus.match}</b></span></div>
            </div>
            <div style="display:flex;flex-direction:column;gap:9px;justify-content:center">
              <button class="btn ok" data-act="kyc:activate:${focus.id}">${icon("userCheck")} Activate — provision + email link</button>
              <button class="btn danger" data-act="kyc:reject:${focus.id}">${icon("x")} Reject with reason</button>
            </div>
          </div>
          <div class="seal-note" style="margin-top:14px">${icon("lock")} <div>Viewing KYC images is itself audited and time-boxed (<span class="mono">kyc.image_viewed</span>) — opened only for the application under review.</div></div>`,
            { icon: "idcard", badge: `<span class="badge warn">${c.pending} pending</span>` }) : card("KYC queue", empty("check", "Queue clear", "No pending registrations"), { icon: "idcard" })) +
          `<div style="height:16px"></div>` +
          card("All registrations", table([{ h: "Ref" }, { h: "Company" }, { h: "Owner" }, { h: "Submitted" }, { h: "Deadline" }, { h: "Status" }, { h: "" }], REG.all().map(r => ({
            cells: [`<span class="idtag">${r.id}</span>`, r.company, r.owner, r.submitted, `<span class="small">${r.deadline || "—"}</span>`, stB(r.status),
            r.status === "pending" ? `<button class="btn xs soft" data-act="kyc:activate:${r.id}">Activate</button> <button class="btn xs ghost" data-act="kyc:disable:${r.id}">Disable</button>` : ""]
          }))), { icon: "list" })
      };
    },

    tenants() {
      return {
        title: "Tenants", sub: "registry · search · profile · suspend / reactivate / terminate",
        actions: `<div class="seg sm"><button aria-pressed="true">All</button><button aria-pressed="false">Active</button><button aria-pressed="false">Pending</button></div>`,
        body: band("store", "Control plane · Tenant registry", "Every shop, one row. Lifecycle actions act on one tenant at a time — confirm + reason + audit.") +
          card("Registry", table([{ h: "Tenant" }, { h: "Entity" }, { h: "Owner" }, { h: "Since" }, { h: "Plan" }, { h: "Status" }, { h: "" }], DATA.TENANTS.map(t => ({
            cells: [
              `<b>${t.name}</b> <span class="mono small muted">${t.id}</span>`,
              t.entity === "company" ? "Company" : t.entity === "sole" ? "Sole trader" : "—",
              t.owner, t.since, `<span class="badge plain">${t.plan}</span>`, statusBadge(t.status),
              t.status === "active" ? `<button class="btn xs ghost">${icon("ban")} Suspend</button>` : t.status === "pending" ? `<button class="btn xs soft" data-go="platform/web/registrations">Review</button>` : ""
            ]
          }))), { icon: "store" })
      };
    },

    resources() {
      return {
        title: "Resources", sub: "per-tenant: seats · messages · storage · activity",
        body: band("gauge", "Control plane · Resources", "Live meters per shop. The numbers are metadata — counts & usage, never the content behind them.") +
          card("Per-tenant", `<div class="tablewrap"><table class="tbl">
            <thead><tr><th>Tenant</th><th>Plan</th><th>Seats (S/M/A)</th><th>LINE</th><th>WhatsApp</th><th>Storage</th><th>Status</th><th>Allocate</th></tr></thead>
            <tbody>${DATA.TENANTS.map(t => {
            if (t.status !== "active") return `<tr><td class="strong">${t.name}</td><td>—</td><td class="mono">—</td><td>—</td><td>—</td><td>—</td><td>${statusBadge(t.status)}</td><td><button class="btn xs soft" data-go="platform/web/registrations">review</button></td></tr>`;
            const seats = `${t.seats.staff.used}/${t.seats.manager.used}/${t.seats.admin.used}`;
            return `<tr>
                <td class="strong">${t.name}</td>
                <td><span class="badge plain">${t.plan}</span></td>
                <td class="mono">${seats}</td>
                <td>${resMeter(t.quota.line.used, t.quota.line.limit, t.quota.line.used / t.quota.line.limit > 0.75 ? "warn" : "ok")}</td>
                <td>${resMeter(t.quota.whatsapp.used, t.quota.whatsapp.limit, "ok")}</td>
                <td class="mono">${t.storage.used} GB</td>
                <td>${statusBadge(t.status)}</td>
                <td><button class="btn xs soft" data-go="platform/web/allocation">+ seats · msg</button></td>
              </tr>`;
          }).join("")}</tbody>
          </table></div>`, { icon: "gauge" })
      };
    },

    allocation() {
      const t = DATA.cur(), q = t.quota || { line: { limit: 50 }, whatsapp: { limit: 50 } }, s = t.seats || { staff: { limit: 10 }, manager: { limit: 3 }, admin: { limit: 1 } };
      return {
        title: "Allocation", sub: "set caps · grant add-ons · change plan/tier · top-up quotas",
        body: band("sliders", "Control plane · Allocation", "Owners see caps read-only; you set them. Raise a cap and the blocked seat or send clears immediately. Free-tier default is 50 messages / cycle each.") +
          card("Allocate · " + t.name, `<div class="grid cols-2">
            <div>
              <div class="field"><label>Staff seats</label><input class="input" value="${s.staff.limit}"></div>
              <div class="field"><label>Manager seats</label><input class="input" value="${s.manager.limit}"></div>
              <div class="field"><label>Admin seats</label><input class="input" value="${s.admin.limit}"></div>
            </div>
            <div>
              <div class="field"><label>LINE quota / cycle</label><input class="input" value="${q.line.limit}"></div>
              <div class="field"><label>WhatsApp quota / cycle</label><input class="input" value="${q.whatsapp.limit}"></div>
              <div class="field"><label>Plan / tier</label><select class="input"><option>Free</option><option>Paid · standard</option></select></div>
            </div>
          </div>
          <button class="btn" style="margin-top:6px">${icon("check")} Apply allocation</button>
          <div class="seal-note" style="margin-top:12px">${icon("history")} Every allocation writes <span class="mono">platform.allocate</span> (who, when, what) — visible to the tenant.</div>`, { icon: "sliders" })
      };
    },

    database() {
      return {
        title: "Database & ops", sub: "backups · restore · migrations · per-tenant export · purge",
        body: band("database", "Control plane · DB ops", "Act on one tenant at a time. A snapshot is taken automatically before any destructive op; sealed content is break-glass only.") +
          `<div class="grid cols-2">
            ${card("Per-tenant operations · Phoungern Co.", rowlist([
              rowitem({ icon: "layers", title: "Backup / restore", sub: "individual tenant", side: `<button class="btn xs ghost" data-act="dbops:platform:backup">Run</button>` }),
              rowitem({ icon: "refresh", title: "Reset to clean seed", sub: "auto-snapshot + reason", side: `<button class="btn xs ghost" data-act="dbops:platform:reset">Reset</button>` }),
              rowitem({ icon: "ban", title: "Purge / terminate", sub: "auto-snapshot first", side: `<button class="btn xs danger" data-act="dbops:platform:purge">Purge</button>` }),
              rowitem({ icon: "database", title: "Migrate schema", sub: "auto-snapshot · audit", side: `<button class="btn xs ghost" data-act="dbops:platform:migrate">Migrate</button>` })
            ]), { icon: "database" })}
            ${card("Snapshots · " + DATA.cur().name, rowlist(DBOPS.list(DATA.cur().id).slice(0, 5).map(b => rowitem({ icon: b.kind === "snapshot" ? "shield" : "layers", title: b.id + " · " + b.kind, sub: b.at + " · scope " + b.scope, side: `<button class="btn xs ghost" data-act="dbops:restore:${b.id}">Restore</button>` }))), { icon: "history" })}
          </div>
          <div style="height:16px"></div>
          ${card("Flow — every destructive op: auto-snapshot → confirm → execute → audit", flowRail([{ t: "Request", s: "operator" }, { t: "Scope", s: "one tenant" }, { t: "Snapshot", s: "auto" }, { t: "Confirm", s: "+ reason" }, { t: "Execute", s: "audit platform.*" }]), { icon: "shield" })}
          <div class="seal-note ok" style="margin-top:14px">${icon("check")} Reset A → B & C untouched. Tenant isolation by <span class="mono">tenant_id</span>; a tenant's backup contains only its own rows.</div>`
      };
    },

    billing() {
      return {
        title: "Billing & licensing", sub: "usage statements · invoices · metered-channel revenue",
        body: band("wallet", "Platform · Billing", "Where the money works: the product is free; revenue comes from metered LINE/WhatsApp and capacity add-ons.") +
          card("Metered-channel revenue (this cycle)", table([{ h: "Tenant" }, { h: "LINE" }, { h: "WhatsApp" }, { h: "Add-ons" }, { h: "Statement", r: true }], [
            { cells: ["Phoungern Co.", String(DATA.byId("phoungern").quota.line.used), String(DATA.byId("phoungern").quota.whatsapp.used), "—", `<span class="num">pending price</span>`] },
            { cells: ["Vientiane Mart", String(DATA.byId("vientianemart").quota.line.used), String(DATA.byId("vientianemart").quota.whatsapp.used), "—", `<span class="num">pending price</span>`] }
          ]), { icon: "wallet", badge: `<span class="pending-chip">${icon("clock")} DS7 price open</span>` })
      };
    },

    security() {
      return {
        title: "Security & audit", sub: "cross-tenant sign-ins · exports · anomalies · break-glass",
        body: band("shield", "Platform · Security", "The operator runs the plumbing, not the contents. Any sealed-data access is break-glass — explicit, reason-required, logged for the tenant to see.") +
          `<div class="grid cols-2">
            ${card("Controls — assigned & bounded", `<div class="cancan">
              <div><div class="cc-h"><span class="badge ok" style="font-size:9px">CAN</span> manage</div>${rowlist([
                rowitem({ icon: "userCheck", title: "Activate / suspend / terminate", neutral: true }),
                rowitem({ icon: "sliders", title: "Allocate seats · quotas · plan", neutral: true }),
                rowitem({ icon: "database", title: "Backup · restore · purge · migrate", neutral: true }),
                rowitem({ icon: "shield", title: "Watch cross-tenant audit", neutral: true })
              ])}</div>
              <div><div class="cc-h"><span class="badge bad" style="font-size:9px">CANNOT</span> see</div>${rowlist([
                rowitem({ icon: "banknote", title: "Salary amounts · payslips", neutral: true }),
                rowitem({ icon: "book", title: "Cashbook / ledger entries", neutral: true }),
                rowitem({ icon: "user", title: "Staff personal data", neutral: true }),
                rowitem({ icon: "idcard", title: "KYC images outside a review", neutral: true })
              ])}</div>
            </div>`, { icon: "shield" })}
            ${card("Cross-tenant activity", rowlist([
              rowitem({ icon: "key", title: "Owner sign-in · Vientiane Mart", sub: "08:41 · ok", neutral: true, side: badge("ok") }),
              rowitem({ icon: "download", title: "Export · Phoungern · payroll register", sub: "logged export.*", neutral: true, side: badge("ok") }),
              rowitem({ icon: "unlock", title: "Break-glass · none active", sub: "would require reason + audit", neutral: true, side: badge("plain") })
            ]), { icon: "history" })}
          </div>`
      };
    },

    pusers() {
      return {
        title: "Platform users", sub: "operator accounts & roles (admin · support · billing)",
        body: band("users", "Platform · Operators", "Who runs the platform — separate from any tenant; these accounts carry tenant_id = null.") +
          card("Operators", table([{ h: "Operator" }, { h: "Email" }, { h: "Role" }, { h: "Status" }], [
            { cells: ["Adeptio Operator", "platform@adeptio.la", `<span class="badge acc">admin</span>`, badge("active")] },
            { cells: ["Support desk", "support@adeptio.la", `<span class="badge plain">support</span>`, badge("active")] },
            { cells: ["Billing", "billing@adeptio.la", `<span class="badge plain">billing</span>`, badge("pending")] }
          ]), { icon: "users" })
      };
    }
  };

  /* ---------------- mobile (platform minimal) ---------------- */
  const mobile = {
    overview() {
      const st = DATA.platformStats();
      return {
        title: "Platform", body: `
        ${tile({ label: "Tenants live", icon: "store", value: st.tenants, sub: `of ${st.total}`, accent: true })}
        ${tile({ label: "Pending KYC", icon: "idcard", value: st.pending, sub: "needs review" })}
        ${card("KYC queue", rowlist(DATA.pendingKyc().map(r => rowitem({ icon: "idcard", title: r.company, sub: r.owner, side: `<button class="btn xs soft" data-go="platform/mobile/registrations">Review</button>` }))))}`
      };
    },
    registrations() {
      const f = DATA.pendingKyc()[0];
      return {
        title: "KYC", body: `${card(f.company, `<div class="kyc-review"><div class="kyc-doc"><div class="kd-head">${icon("idcard")} ID</div><div class="kyc-img">${icon("idcard")}</div></div><div class="kyc-doc"><div class="kd-head">${icon("camera")} Selfie</div><div class="kyc-img">${icon("user")}</div></div></div><div style="display:flex;gap:8px;margin-top:12px"><button class="btn ok" style="flex:1;justify-content:center">${icon("userCheck")} Activate</button><button class="btn danger" style="flex:1;justify-content:center">${icon("x")} Reject</button></div>`)}` };
    },
    tenants() { return { title: "Tenants", body: card("", rowlist(DATA.TENANTS.map(t => rowitem({ icon: "store", title: t.name, sub: `${t.plan} · ${t.status}`, side: statusBadge(t.status) })))) }; },
    more() { return { title: "More", body: card("", rowlist([rowitem({ icon: "gauge", title: "Resources", go: "platform/web/resources" }), rowitem({ icon: "sliders", title: "Allocation", go: "platform/web/allocation" }), rowitem({ icon: "database", title: "Database & ops", go: "platform/web/database" }), rowitem({ icon: "shield", title: "Security & audit", go: "platform/web/security" })])) }; }
  };

  return { web, mobile };
})();
