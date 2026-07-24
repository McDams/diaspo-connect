(function () {
  function cardLine(c, boards) {
    const board = boards.find((b) => b.id === c.boardId);
    return `<div class="dc-checklist-item">
      <i class="bi bi-kanban text-primary"></i>
      <span class="ms-2 small">${DCUtils.escapeHtml(c.title)} <span class="text-muted-dc">— ${DCUtils.escapeHtml(board ? board.name : c.boardId)}</span></span>
      ${DCUtils.priorityBadge(c.priority)}
    </div>`;
  }

  async function init() {
    const admin = await Auth.guard(["admin"]);
    if (!admin) return;
    await Layout.mountApp("admin", "calendar", admin);

    const [cards, boards] = await Promise.all([DataStore.getCards(), DataStore.getBoards()]);
    const dated = cards.filter((c) => c.dueDate && c.boardId !== "board-central");

    const overdue = dated.filter((c) => KanbanEngine.isOverdue(c)).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    document.getElementById("overdue-list").innerHTML = overdue.length
      ? overdue.map((c) => cardLine(c, boards)).join("")
      : `<div class="dc-empty-state py-3"><p class="small mb-0">Aucune échéance en retard.</p></div>`;

    const today = KanbanEngine.TODAY;
    const groups = {};
    dated.forEach((c) => {
      const due = new Date(c.dueDate + "T12:00:00");
      const diffDays = Math.round((due - today) / 86400000);
      if (diffDays < 0 || diffDays > 21) return;
      groups[c.dueDate] = groups[c.dueDate] || [];
      groups[c.dueDate].push(c);
    });
    const dates = Object.keys(groups).sort();
    document.getElementById("upcoming-list").innerHTML = dates.length
      ? dates.map((d) => `
          <div class="mb-3">
            <div class="fw-semibold small mb-1"><i class="bi bi-calendar-event me-1 text-primary"></i>${DCUtils.formatDate(d)} ${d === "2026-07-24" ? '<span class="dc-badge dc-badge-warning">Aujourd\'hui</span>' : ""}</div>
            ${groups[d].map((c) => cardLine(c, boards)).join("")}
          </div>`).join("")
      : `<div class="dc-empty-state py-3"><p class="small mb-0">Aucune échéance dans les 21 prochains jours.</p></div>`;
  }

  document.addEventListener("DOMContentLoaded", init);
})();
