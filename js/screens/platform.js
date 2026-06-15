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
      const st = DATA.platformStats();
      return {
        title: "Platform overview", sub: "Tenants live · pending KYC · platform load · alerts",
        body: `
        <div class="tilegrid" style="margin-bottom:16px">
          ${tile({ label: "Tenants live", icon: "store", value: st.tenants, sub: `of ${st.total} registered`, accent: true })}
          ${tile({ label: "Pending KYC", icon: "idcard", value: st.pending, sub: `<span class="badge warn">needs review</span>`, go: "platform/web/registrations" })}
          ${tile({ label: "Seats in use", icon: "users", value: st.seatsUsed, sub: "across the fleet" })}
          ${tile({ label: "Messages this cycle", icon: "chat", value: st.msgUsed, sub: "LINE + WhatsApp" })}
        </div>
        <div class="grid cols-2">
          ${card("KYC queue", rowlist(DATA.pendingKyc().map(r => rowitem({
          icon: "idcard", title: r.company, sub: `${r.owner} · ${r.submitted}`,
          side: `<span class="badge ${r.match === "strong" ? "ok" : "warn"}">${r.match}</span> <button class="btn xs soft" data-go="platform/web/registrations">Review</button>`
        }))), { icon: "idcard", link: "platform/web/registrations" })}
          ${card("Platform load", `<div class="capstrip">
            ${segMeter("Shared DB rows", 5210, 100000, { unit: "" })}
            ${segMeter("Workers / day", 12, 100, { unit: "k" })}
            ${segMeter("Storage (GB)", 0.6, 10, { unit: "GB" })}
          </div><div class="seal-note ok" style="margin-top:12px">${icon("check")} Shared-schema multi-tenancy — a new tenant is rows, not servers. Free-tier headroom is wide.</div>`, { icon: "pulse" })}
        </div>`
      };
    },

    registrations() {
      const pend = DATA.pendingKyc();
      const focus = pend[0]; // Lao Coffee Lab
      return {
        title: "Registrations", sub: "KYC queue — review ID ↔ selfie · activate / reject",
        body: band("idcard", "Control plane · KYC", "Not instant self-serve: an owner proves who they are, and you activate by hand — the gate that keeps free safe.") +
          card(`Review · ${focus.company}`, `
          <div class="kyc-review">
            <div class="kyc-doc"><div class="kd-head">${icon("idcard")} ID card</div><div class="kyc-img">${icon("idcard")}<div class="kdesc">${focus.idType} · name & photo legible</div></div></div>
            <div class="kyc-doc"><div class="kd-head">${icon("camera")} Owner selfie</div><div class="kyc-img">${icon("user")}<div class="kdesc">Live selfie · compare face ↔ ID</div></div></div>
          </div>
          <div class="grid cols-2" style="margin-top:14px">
            <div class="kyc-meta">
              <div class="kyc-fact">${icon("store")} <span><b>${focus.company}</b> · ${focus.owner}</span></div>
              <div class="kyc-fact">${icon("mail")} <span>${focus.email} · verified</span></div>
              <div class="kyc-fact">${icon("phone")} <span>${focus.phone} · verified</span></div>
              <div class="kyc-fact">${icon("check")} <span>Face match: <b>${focus.match}</b></span></div>
            </div>
            <div style="display:flex;flex-direction:column;gap:9px;justify-content:center">
              <button class="btn ok">${icon("userCheck")} Activate — provision 10/3/1 + seed</button>
              <button class="btn danger">${icon("x")} Reject with reason</button>
            </div>
          </div>
          <div class="seal-note" style="margin-top:14px">${icon("lock")} <div>Viewing these KYC images is itself audited and time-boxed — opened only for the application under review (<span class="mono">kyc.image_viewed</span>).</div></div>`,
            { icon: "idcard", badge: `<span class="badge warn">${pend.length} pending</span>` }) +
          `<div style="height:16px"></div>` +
          card("All registrations", table([{ h: "Ref" }, { h: "Company" }, { h: "Owner" }, { h: "ID type" }, { h: "Submitted" }, { h: "Status" }], DATA.REGISTRATIONS.map(r => ({
            cells: [`<span class="idtag">${r.id}</span>`, r.company, r.owner, r.idType, r.submitted, statusBadge(r.status)]
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
