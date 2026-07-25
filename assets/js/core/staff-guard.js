/**
 * StaffGuard - protège les pages de l'espace interne (pages/staff/*).
 * Vérifie la session, résout la fiche staff associée à l'utilisateur connecté,
 * puis vérifie que son accessLevel autorise le module demandé (cf. Permissions).
 * Un collaborateur qui n'a pas accès est renvoyé vers son propre tableau de bord.
 */
const StaffGuard = (() => {
  async function require(moduleId) {
    const root = window.DC_ROOT || "./";
    const session = await Auth.getSession();
    if (!session || (session.role !== "staff" && session.role !== "admin")) {
      window.location.href = `${root}pages/public/login.html`;
      return null;
    }
    const user = await Auth.getCurrentUser();
    if (!user) {
      window.location.href = `${root}pages/public/login.html`;
      return null;
    }
    // L'admin plateforme (rôle legacy "admin") a la même mainmise que le super_admin
    // sur l'espace interne : accès total, sans fiche staff réelle à résoudre.
    if (user.role === "admin") {
      return { user, staff: { id: null, userId: user.id, accessLevel: "super_admin", position: "Administrateur plateforme" } };
    }
    const staffList = await DataStore.getStaff();
    const staff = staffList.find((s) => s.userId === session.userId);
    if (!staff) {
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
