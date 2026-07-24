/**
 * StaffGuard - protège les pages de l'espace interne (pages/staff/*).
 * Vérifie la session, résout la fiche staff associée à l'utilisateur connecté,
 * puis vérifie que son accessLevel autorise le module demandé (cf. Permissions).
 * Un collaborateur qui n'a pas accès est renvoyé vers son propre tableau de bord.
 */
const StaffGuard = (() => {
  async function require(moduleId) {
    const root = window.DC_ROOT || "./";
    const session = Auth.getSession();
    if (!session || session.role !== "staff") {
      window.location.href = `${root}pages/public/login.html`;
      return null;
    }
    const [user, staffList] = await Promise.all([Auth.getCurrentUser(), DataStore.getStaff()]);
    const staff = staffList.find((s) => s.userId === session.userId);
    if (!user || !staff) {
      window.location.href = `${root}pages/public/login.html`;
      return null;
    }
    const allowed = await Permissions.can(staff.accessLevel, moduleId);
    if (!allowed) {
      const landing = await Permissions.landingPageFor(staff.accessLevel);
      window.location.href = `${root}pages/staff/${landing}`;
      return null;
    }
    return { user, staff };
  }

  return { require };
})();
