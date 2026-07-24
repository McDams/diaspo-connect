(function () {
  async function init() {
    const user = await Auth.guard(["proprietaire"]);
    if (!user) return;
    await Layout.mountApp("proprietaire", "kanban", user);

    await KanbanBoard.mount(document.getElementById("kanban-host"), {
      mode: "board",
      boardId: "board-proprietaire",
      currentUser: { id: user.id, label: `${user.firstName} ${user.lastName}`, matchId: user.id },
      assignableUsers: [],
      canCreate: true,
      selfOwned: true,
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
