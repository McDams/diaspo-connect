/**
 * AuditLog - point d'entrée unique pour toute action sensible tracée.
 *
 * Corrige la faiblesse relevée par l'audit (section "Traçabilité") : les
 * écritures directes `DataStore.insert("auditLog", {...})` dispersées dans
 * chaque page avaient un format légèrement différent d'un endroit à l'autre
 * (rôle de l'acteur absent, module d'origine absent, aucun état avant/après,
 * aucun résultat explicite). `AuditLog.record()` impose un schéma unique :
 * qui (acteur + rôle), quand, sur quel objet, depuis quel module, avant/après,
 * avec quel résultat.
 */
const AuditLog = (() => {
  /**
   * record({ actor, action, targetType, targetId, module, before, after, result, details })
   * `actor` = { id, label, role } (role = rôle applicatif ou accessLevel staff)
   */
  async function record({ actor, action, targetType, targetId, module, before = null, after = null, result = "success", details = "" }) {
    const entry = {
      id: DataStore.nextId("audit"),
      actorId: actor.id,
      actorName: actor.label,
      actorRole: actor.role || "inconnu",
      action,
      targetType,
      targetId,
      module: module || targetType,
      date: new Date().toISOString(),
      before,
      after,
      result,
      details,
    };
    await DataStore.insert("auditLog", entry);
    return entry;
  }

  return { record };
})();
