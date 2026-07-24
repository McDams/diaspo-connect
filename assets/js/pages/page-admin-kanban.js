(function () {
  async function init() {
    const user = await Auth.guard(["admin"]);
    if (!user) return;
    await Layout.mountApp("admin", "kanban", user);

    const staff = await DataStore.getStaff();
    const users = await DataStore.getUsers();
    const assignableUsers = staff.map((s) => {
      const u = users.find((x) => x.id === s.userId);
      return { id: s.id, label: u ? `${u.firstName} ${u.lastName}` : s.position };
    });

    await KanbanBoard.mount(document.getElementById("kanban-host"), {
      mode: "central",
      currentUser: { id: user.id, label: `${user.firstName} ${user.lastName}`, matchId: user.id },
      assignableUsers,
      canCreate: true,
      showDepartmentFilter: true,
      showAssigneeFilter: true,
      defaultBoardId: "board-direction",
    });

    await refreshKpis();
  }

  async function refreshKpis() {
    const cards = (await DataStore.getCards()).filter((c) => c.boardId !== "board-central");
    document.getElementById("kpi-total").textContent = `${cards.length} cartes`;
    document.getElementById("kpi-overdue").textContent = `${cards.filter((c) => KanbanEngine.isOverdue(c)).length} en retard`;
    document.getElementById("kpi-unassigned").textContent = `${cards.filter((c) => !(c.assignees || []).length && !c.ownerId).length} non assignées`;
  }

  document.addEventListener("DOMContentLoaded", init);
})();
