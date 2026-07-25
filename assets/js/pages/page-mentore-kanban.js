(function () {
  async function init() {
    const user = await Auth.guard(["mentore"]);
    if (!user) return;
    await Layout.mountApp("mentore", "kanban", user);

    await KanbanBoard.mount(document.getElementById("kanban-host"), {
      mode: "board",
      boardId: "board-mentore",
      currentUser: { id: user.id, label: `${user.firstName} ${user.lastName}`, matchId: user.id },
      assignableUsers: [],
      canCreate: true,
      selfOwned: true,
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
