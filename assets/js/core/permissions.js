/**
 * Permissions - accès aux modules internes selon le niveau d'accès (accessLevel)
 * d'un membre de l'équipe. La liste des modules autorisés par niveau vit dans
 * assets/data/permissions.json (remplaçable demain par une vraie table de
 * permissions côté serveur, avec la même interface `can()` / `getFor()`).
 */
const Permissions = (() => {
  let cache;

  async function all() {
    if (!cache) cache = await DataStore.getPermissions();
    return cache;
  }

  async function getFor(accessLevel) {
    const list = await all();
    return list.find((p) => p.accessLevel === accessLevel) || null;
  }

  async function can(accessLevel, moduleId) {
    if (accessLevel === "super_admin") return true;
    const perm = await getFor(accessLevel);
    return !!perm && perm.modules.includes(moduleId);
  }

  async function canManageAllTickets(accessLevel) {
    if (accessLevel === "super_admin") return true;
    const perm = await getFor(accessLevel);
    return !!perm && perm.canManageAllTickets;
  }

  async function canManagePermissions(accessLevel) {
    if (accessLevel === "super_admin") return true;
    const perm = await getFor(accessLevel);
    return !!perm && perm.canManagePermissions;
  }

  async function landingPageFor(accessLevel) {
    const perm = await getFor(accessLevel);
    return perm ? perm.landingPage : "staff-dashboard.html";
  }

  return { all, getFor, can, canManageAllTickets, canManagePermissions, landingPageFor };
})();
