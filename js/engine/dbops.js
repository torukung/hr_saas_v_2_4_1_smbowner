/* ============================================================
   ADEPTIO · per-tenant DB ops — BO-25
   Owner controls their OWN slice (backup/restore/export, scoped to
   tenant_id). Platform Admin acts on ANY one tenant at a time —
   a snapshot is taken automatically before any destructive op, and
   every op is audited (platform.db.*). Demo: in-memory snapshots.
   ============================================================ */
window.DBOPS = (function () {
  const bk = {}; // tid → [{id, at, scope, kind, reason}]
  function list(tid) {
    tid = tid || DATA.state.tenantId;
    if (!bk[tid]) bk[tid] = [{ id: "BK-0001", at: "2026-06-14 02:00", scope: "all", kind: "scheduled" }];
    return bk[tid];
  }
  const add = (tid, o) => { list(tid).unshift(Object.assign({ id: "BK-" + Date.now(), at: "2026-06-15 16:50" }, o)); };

  // ---- owner (own tenant) ----
  function backup(tid, scope) { add(tid, { scope: scope || "now", kind: "backup" }); DATA.AUDIT.unshift({ fact: "db.backup", who: "Owner", when: "2026-06-15", ref: scope || "now" }); }
  function restore(tid, id) { DATA.AUDIT.unshift({ fact: "db.restore", who: "Owner", when: "2026-06-15", ref: id }); return { ok: true }; }
  function snapshot(tid) { add(tid, { scope: "all", kind: "snapshot" }); }

  // ---- platform (any tenant, one at a time) — auto-snapshot before destructive ----
  function platformOp(tid, op, reason) {
    snapshot(tid); // safety snapshot precedes every op
    DATA.AUDIT.unshift({ fact: "platform.db." + op, who: "Platform", when: "2026-06-15", ref: tid + " · " + (reason || "no reason given") });
    return { ok: true, snapshot: list(tid)[0] };
  }
  function __reset() { for (const k in bk) delete bk[k]; }

  return { list, backup, restore, snapshot, platformOp, __reset };
})();
