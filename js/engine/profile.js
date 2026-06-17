/* ============================================================
   ADEPTIO · people profile — schema-driven, owner-editable
   SuccessFactors-style grouped sections (general · personal · job),
   each a set of cards (multi-frame). Personal-data cards are
   owner-editable (set → override + audit people.updated); sealed
   fields (DOB · national ID) stay masked & read-only.
   ============================================================ */
window.PROFILE = (function () {
  const SCHEMA = {
    general: {
      label: "General Information",
      cards: [
        { key: "g_personal", title: "Personal Information", icon: "user", fields: [["empId", "Employee ID"], ["username", "Username"], ["firstName", "First name"], ["firstNameTh", "First name (TH)"], ["lastName", "Last name"]] },
        { key: "g_job", title: "Job Information", icon: "briefcase", fields: [["hireDate", "Hire date"], ["division", "Division"], ["department", "Department"], ["position", "Position title"], ["location", "Working location"]] }
      ]
    },
    personal: {
      label: "Personal Data",
      cards: [
        { key: "bio", title: "Biographical Information", icon: "user", fields: [["empId", "Employee ID"], ["legacyId", "Legacy ID"], ["dob", "Date of birth"], ["age", "Age (YY:MM)"]] },
        { key: "personal", title: "Personal Information", icon: "user", edit: true, fields: [["prefix", "Prefix"], ["firstName", "First name"], ["lastName", "Last name"], ["firstNameTh", "First name (TH)"], ["preferred", "Preferred name"], ["gender", "Gender"]] },
        { key: "contact", title: "Contact Information", icon: "phone", edit: true, fields: [["mobile", "Business mobile"], ["email", "Business email"]] },
        { key: "address", title: "Addresses", icon: "pin", edit: true, fields: [["current", "Current"], ["legal", "Legal / registered"]] },
        { key: "nid", title: "National ID Information", icon: "idcard", fields: [["country", "Country / region"], ["nidType", "ID card type"], ["nid", "National ID"]] },
        { key: "emergency", title: "Primary Emergency Contact", icon: "phone", edit: true, fields: [["emgName", "Name"], ["emgPhone", "Phone"], ["emgRel", "Relationship"]] },
        { key: "bank", title: "Payment Information", icon: "banknote", edit: true, fields: [["bank", "Bank"], ["acct", "Account number"]] }
      ]
    },
    job: {
      label: "Job Data",
      cards: [
        { key: "employment", title: "Employment Details", icon: "briefcase", fields: [["hireDate", "Hire date"], ["origHire", "Original hire date"], ["serviceDate", "Service date"], ["yos", "Year of service"]] },
        { key: "position", title: "Position & Organisation", icon: "building", fields: [["position", "Position title"], ["bizGroup", "Business group"], ["group", "Group"], ["division", "Division"], ["department", "Department"]] },
        { key: "jobinfo", title: "Job Information", icon: "briefcase", fields: [["manager", "Direct manager"], ["country", "Country"], ["company", "Company"], ["costCentre", "Cost centre"], ["careerTrack", "Career track"]] },
        { key: "relationships", title: "Job Relationships", icon: "users", fields: [["hrbp", "HRBP"], ["compMgr", "Compensation manager"]] }
      ]
    }
  };

  const overrides = {};

  /* ---- profile photo (manager-uploaded; demo = generated avatar) ---- */
  const photos = {};
  const hasPhoto = (uid) => !!photos[uid];
  function hueFor(uid) { let h = 7; for (const c of String(uid)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; }
  function setPhoto(uid) { photos[uid] = true; DATA.AUDIT.unshift({ fact: "people.photo", who: "Owner", when: "2026-06-16 09:55", ref: uid + " · profile photo uploaded" }); }
  function clearPhoto(uid) { delete photos[uid]; }
  // one avatar helper used everywhere a person's icon shows — photo if uploaded, else initials
  function avatar(uid, opts) {
    opts = opts || {};
    const p = (DATA.people().find(x => x.id === uid)) || DATA.me();
    const cls = "avatar " + (opts.lg ? "lg" : opts.xs ? "xs" : "") + (hasPhoto(uid) ? " photo" : "");
    const style = hasPhoto(uid) ? ` style="--ph:hsl(${hueFor(uid)} 50% 56%);--ph2:hsl(${(hueFor(uid) + 38) % 360} 52% 42%)"` : "";
    return `<span class="${cls.trim()}"${style}>${UI.initials(p.name)}</span>`;
  }

  function base(uid) {
    const p = (DATA.people().find(x => x.id === uid)) || DATA.me();
    const nm = (p.name || "").split(" ");
    const co = (DATA.cur() || {});
    return {
      empId: p.id, legacyId: p.id.replace(/\D/g, ""), username: ((nm[0] || "user") + "." + ((nm[1] || " ")[0] || "")).toLowerCase(),
      prefix: p.access === "owner" ? "Mr." : "Ms.", firstName: nm[0] || "", lastName: nm.slice(1).join(" ") || "—", firstNameTh: "—", preferred: p.name, gender: p.access === "owner" ? "Male" : "Female",
      dob: "•••••• (sealed · Show)", age: "—",
      mobile: "+856 20 •• ••• " + p.id.slice(-3), email: ((nm[0] || "staff").toLowerCase()) + "@phoungern.la",
      current: "Vientiane Capital, Lao PDR", legal: "Vientiane Capital, Lao PDR",
      country: "Lao PDR", nidType: "Lao National Identification Number", nid: "•••••• (sealed · Show)",
      emgName: "—", emgPhone: "—", emgRel: "—",
      bank: "BCEL", acct: "•••• " + p.id.slice(-4),
      hireDate: "2 Mar 2026", origHire: "2 Mar 2026", serviceDate: "2 Mar 2026", yos: "0y 3m",
      position: p.role, bizGroup: "Phoungern", group: co.name || "Phoungern Co.", division: p.div, department: p.div,
      manager: p.access === "owner" ? "— (owner)" : "Somchai Phongsavanh", company: co.name || "Phoungern Co.",
      costCentre: "PG-" + (p.div || "GEN").slice(0, 3).toUpperCase(), careerTrack: p.access === "owner" ? "Management" : "Operations",
      hrbp: "Somchai Phongsavanh (owner-as-HR)", compMgr: "Somchai Phongsavanh", location: "Main shop · Vientiane"
    };
  }
  function get(uid) { return Object.assign(base(uid), overrides[uid] || {}); }
  function set(uid, obj) { overrides[uid] = Object.assign(overrides[uid] || {}, obj); DATA.AUDIT.unshift({ fact: "people.updated", who: "Owner", when: "2026-06-15", ref: uid + " · " + Object.keys(obj).join(", ") }); }

  /* ---- shared render (owner view = editable · staff Me = read) ---- */
  function sectionHtml(uid, section, opts) {
    opts = opts || {};
    const { card, kpi, rowlist, rowitem, badge, empty, kip, icon } = UI;
    const prof = get(uid), p = (DATA.people().find(x => x.id === uid)) || DATA.me();
    if (SCHEMA[section]) {
      return `<div class="grid cols-2">` + SCHEMA[section].cards.map(c => {
        const isEdit = opts.edit && c.edit && opts.editing === uid + ":" + c.key;
        const inner = c.fields.map(f => {
          const v = prof[f[0]] != null ? prof[f[0]] : "—";
          return isEdit
            ? `<div class="field" style="margin-bottom:10px"><label>${f[1]}</label><input class="input sm" data-pf="${f[0]}" value="${String(v).replace(/"/g, "&quot;")}"></div>`
            : `<div style="margin-bottom:9px"><div class="small muted">${f[1]}</div><div style="font-size:13.5px;font-weight:500;overflow-wrap:break-word">${v}</div></div>`;
        }).join("");
        let head = "";
        if (opts.edit) head = c.edit ? (isEdit ? `<div style="display:flex;gap:6px"><button class="btn xs soft" data-act="profile:save:${uid}:${c.key}:${section}">Save</button><button class="btn xs ghost" data-act="profile:cancel:${uid}:${section}">Cancel</button></div>` : `<button class="btn xs ghost" data-act="profile:edit:${uid}:${c.key}:${section}">${icon("edit")} Edit</button>`) : `<span class="pending-chip">${icon("lock")} system</span>`;
        else if (!c.edit) head = `<span class="pending-chip">${icon("lock")} sealed</span>`;
        return card(c.title, inner, { icon: c.icon, badge: head });
      }).join("") + `</div>`;
    }
    if (section === "time") return `<div class="grid cols-3" style="margin-bottom:16px">${kpi("Leave balance", "8.0<small> d</small>", "annual")}${kpi("This month", "11<small> d</small>", "present · 1 late")}${kpi("OT · month", "6<small> h</small>", "within cap")}</div>` +
      card("Time management", rowlist([rowitem({ icon: "calendar", title: "Annual leave", sub: "8.0 of 15 days", side: badge("ok") }), rowitem({ icon: "history", title: "Attendance · June", sub: "11 present · 1 late", neutral: true }), rowitem({ icon: "swap", title: "Shift swaps", sub: "1 this month", neutral: true })]), { icon: "clock" });
    if (section === "compensation") return `<div class="grid cols-2">
      ${card("Compensation", rowlist([rowitem({ icon: "banknote", title: "Base salary", sub: "monthly", side: `<span class="num">${kip(p.base)}</span>` }), rowitem({ icon: "scale", title: "Pay band", sub: prof.careerTrack, neutral: true, side: badge("plain") }), rowitem({ icon: "history", title: "Last review", sub: "—", neutral: true })]), { icon: "coins" })}
      ${card("Statutory", rowlist([rowitem({ icon: "shield", title: "NSSF", sub: "5.5% ee · 6% er (cap ₭4.5M)", neutral: true }), rowitem({ icon: "percent", title: "PIT", sub: "0–25% progressive", neutral: true })]), { icon: "shield" })}
    </div>`;
    if (section === "documents") return card("Documents", rowlist([rowitem({ icon: "file", title: "Employment contract", sub: "signed 2 Mar 2026", side: `<button class="btn xs ghost">${icon("eye")} View</button>` }), rowitem({ icon: "idcard", title: "National ID (sealed)", sub: "on file", side: badge("ok") }), rowitem({ icon: "file", title: "Code of conduct", sub: "acknowledged", side: badge("approved") })]), { icon: "files", badge: opts.edit ? `<button class="btn xs soft">${icon("plus")} Add document</button>` : "" });
    return empty("file", "Section", "—");
  }
  function page(uid, section, opts) {
    opts = opts || {}; const { icon } = UI;
    const p = (DATA.people().find(x => x.id === uid)) || DATA.me(), prof = get(uid);
    let tabs = [["general", "General Information"], ["personal", "Personal Data"], ["job", "Job Data"], ["time", "Time"], ["compensation", "Compensation"], ["documents", "Documents"]];
    if (opts.extra && opts.extra.tabs) tabs = tabs.concat(opts.extra.tabs); // persona-specific sections at the Me root (e.g. staff Account)
    const href = opts.tabHref || (s => "#");
    const hasNav = !!opts.tabHref;
    const switcher = `<div class="seg" style="flex-wrap:wrap;margin-bottom:18px">${tabs.map(tb => `<button aria-pressed="${section === tb[0]}" data-go="${href(tb[0])}">${tb[1]}</button>`).join("")}</div>`;
    // avatar shows the uploaded photo (or initials), and is a click-menu → Personal Data · Time · Documents (+ upload, for the manager)
    const photoStyle = hasPhoto(uid) ? `--ph:hsl(${hueFor(uid)} 50% 56%);--ph2:hsl(${(hueFor(uid) + 38) % 360} 52% 42%);` : "";
    const av = `<span class="avatar lg${hasPhoto(uid) ? " photo" : ""}" style="width:62px;height:62px;font-size:20px;border:3px solid var(--surface);${photoStyle}">${UI.initials(p.name)}</span>`;
    const headAvatar = hasNav
      ? `<details class="pf-menu"><summary class="pf-avwrap" title="Profile menu">${av}<span class="pf-cam">${UI.icon("camera")}</span></summary>
          <div class="pf-menu-pop">
            <a class="pf-mi" data-go="${href("personal")}">${UI.icon("user")} Personal Data</a>
            <a class="pf-mi" data-go="${href("time")}">${UI.icon("clock")} Time</a>
            <a class="pf-mi" data-go="${href("documents")}">${UI.icon("files")} Documents</a>
            ${opts.edit ? `<button class="pf-mi" data-act="profile:photo:${uid}">${UI.icon("camera")} ${hasPhoto(uid) ? "Change" : "Upload"} photo</button>` : ""}
          </div></details>`
      : av;
    const header = `<div class="card" style="padding:0;overflow:hidden;margin-bottom:16px">
      <div style="height:80px;background:linear-gradient(120deg,var(--acc) 0%,var(--acc-d) 120%)"></div>
      <div style="display:flex;align-items:flex-end;gap:16px;padding:0 20px 16px;margin-top:-30px;flex-wrap:wrap">
        ${headAvatar}
        <div style="flex:1;min-width:0"><div style="font-size:19px;font-weight:700">${p.name}</div><div class="small muted">${prof.position} · ${p.id}</div><div class="small muted">${prof.division} · ${prof.company}</div></div>
        <div style="display:flex;gap:8px;align-items:center">${opts.headerRight || ""}</div>
      </div></div>`;
    const isExtra = opts.extra && opts.extra.tabs && opts.extra.tabs.some(tb => tb[0] === section);
    const bodyHtml = isExtra ? opts.extra.render(section) : sectionHtml(uid, section, opts);
    return header + switcher + bodyHtml;
  }

  let editing = null; // "uid:cardKey"
  const setEditing = (v) => { editing = v; };
  const getEditing = () => editing;
  function __reset() { for (const k in overrides) delete overrides[k]; for (const k in photos) delete photos[k]; editing = null; }

  return { SCHEMA, get, set, page, sectionHtml, avatar, hasPhoto, setPhoto, clearPhoto, setEditing, getEditing, __reset };
})();
