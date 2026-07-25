(function () {
  async function init() {
    const user = await Auth.guard(["mentor"]);
    if (!user) return;
    await Layout.mountApp("mentor", "kanban", user);

    await KanbanBoard.mount(document.getElementById("kanban-host"), {
      mode: "board",
      boardId: "board-mentor",
      currentUser: { id: user.id, label: `${user.firstName} ${user.lastName}`, matchId: user.id },
      assignableUsers: [],
      canCreate: true,
      selfOwned: true,
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
