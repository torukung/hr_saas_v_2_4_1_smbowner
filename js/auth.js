/* ============================================================
   ADEPTIO · auth — the front door (v2.4.1.smbowner)
   One flag (auth_portal): Sign-in (wall up) ↔ Open demo (no wall).
   Three personas, pre-filled demo credentials printed on the portal.
   Demo-only: passwords are plain here for the clickable preview; the
   real edge.auth Worker keeps them server-authoritative (Argon2id),
   never in the browser — same custody model as the parent line.
   ============================================================ */
window.AUTH = (function () {
  // one (or two) demo account(s) per persona; multi-tenant owners included
  const ACCOUNTS = [
    { email: "staff@phoungern.la", pwd: "staff123", name: "Tinar Sisombat", persona: "staff", scopes: ["staff"], tenant: "phoungern", role: "Barista" },
    { email: "staff2@phoungern.la", pwd: "staff123", name: "Souphaphone Keo", persona: "staff", scopes: ["staff"], tenant: "phoungern", role: "Barista" },
    { email: "manager@phoungern.la", pwd: "manager123", name: "Bouasone Vilaykham", persona: "owner", scopes: ["manager"], tenant: "phoungern", role: "Manager · delegated", delegated: true },
    { email: "owner@phoungern.la", pwd: "owner123", name: "Somchai Phongsavanh", persona: "owner", scopes: ["owner"], tenant: "phoungern", role: "Owner" },
    { email: "owner@vientianemart.la", pwd: "owner123", name: "Manivanh Keobounphan", persona: "owner", scopes: ["owner"], tenant: "vientianemart", role: "Owner" },
    { email: "platform@adeptio.la", pwd: "platform123", name: "Adeptio Operator", persona: "platform", scopes: ["platform"], tenant: null, role: "Platform Administrator" }
  ];

  let portal = true;   // true = Sign-in (wall up, default) · false = Open demo
  let ses = null;

  const portalOn = () => portal;
  function setPortal(on) { portal = !!on; if (!portal) ses = null; }
  const session = () => ses;
  const find = (email) => ACCOUNTS.find(a => a.email.toLowerCase() === String(email || "").trim().toLowerCase());

  function signIn(email, pwd) {
    const a = find(email);
    if (!a) return { ok: false, err: "No account with that email." };
    if (a.pwd !== pwd) return { ok: false, err: "Wrong password — check the printed credentials below." };
    ses = { email: a.email, name: a.name, persona: a.persona, scopes: a.scopes.slice(), tenant: a.tenant, role: a.role, delegated: !!a.delegated };
    if (a.tenant) DATA.setTenant(a.tenant);
    return { ok: true, ses };
  }
  function signOut() { ses = null; }

  // scopes → persona shell key
  function primaryScope(scopes) {
    if (scopes.includes("platform")) return "platform";
    if (scopes.includes("owner") || scopes.includes("manager")) return "owner";
    return "staff";
  }
  const accountsFor = (persona) => ACCOUNTS.filter(a => a.persona === persona);
  const defaultAccount = (persona) => accountsFor(persona).slice(-1)[0] || accountsFor(persona)[0];
  const stats = () => ({ accounts: ACCOUNTS.length, active: ACCOUNTS.length });

  return { ACCOUNTS, portalOn, setPortal, session, signIn, signOut, primaryScope, accountsFor, defaultAccount, stats, find };
})();
