/**
 * Kanban personnel d'un membre de l'équipe interne : ouvre automatiquement le
 * tableau de son propre pôle (staff.department -> board-{department}).
 * Un membre ne voit ici que le board de son pôle ; seule l'administration
 * (Kanban central) voit tous les pôles à la fois.
 */
(function () {
  const BOARD_LABELS = {
    direction: "Direction — pilotage", secretariat: "Secrétariat — tri & affectation", conseil: "Pôle Accompagnement — dossiers affectés",
    support: "Support — tickets", moderation: "Modération — signalements & incidents", partenariats: "Partenariats — prospects & suivi",
    contenu: "Contenu — ressources & FAQ", technique: "Technique — maintenance", conformite: "Conformité — vérifications",
  };

  async function init() {
    const ctx = await StaffGuard.require("kanban");
    if (!ctx) return;
    await Layout.mountStaffApp("kanban", ctx);

    const department = ctx.staff.department || "direction";
    const boardId = `board-${department}`;

    document.getElementById("board-desc").textContent = `Tableau du pôle ${BOARD_LABELS[department] || department} — priorités, échéances et dossiers affectés à votre équipe.`;

    const staffList = await DataStore.getStaff();
    const users = await DataStore.getUsers();
    const peers = ctx.staff.accessLevel === "super_admin" || ctx.staff.accessLevel === "direction_admin"
      ? staffList
      : staffList.filter((s) => s.department === department);
    const assignableUsers = peers.map((s) => {
      const u = users.find((x) => x.id === s.userId);
      return { id: s.id, label: u ? `${u.firstName} ${u.lastName}` : s.position };
    });

    await KanbanBoard.mount(document.getElementById("kanban-host"), {
      mode: "board",
      boardId,
      currentUser: { id: ctx.user.id, label: `${ctx.user.firstName} ${ctx.user.lastName}`, matchId: ctx.staff.id },
      assignableUsers,
      canCreate: true,
      showAssigneeFilter: assignableUsers.length > 1,
      departmentId: department,
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
