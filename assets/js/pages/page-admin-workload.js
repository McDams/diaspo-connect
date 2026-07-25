(function () {
  function poleCard(dept, cards) {
    const active = cards.filter((c) => c.department === dept.id && c.status !== "done");
    const overdue = active.filter((c) => KanbanEngine.isOverdue(c));
    const pct = Math.min(100, active.length * 10);
    return `<div class="col-md-4 col-lg-3">
      <div class="dc-stat-card h-100">
        <div class="dc-stat-icon dc-icon-teal mb-2"><i class="bi ${dept.icon}"></i></div>
        <div class="dc-stat-value">${active.length}</div>
        <div class="dc-stat-label">${DCUtils.escapeHtml(dept.shortName || dept.name)}</div>
        <div class="progress mt-2" style="height:6px;"><div class="progress-bar ${overdue.length ? "bg-danger" : "bg-success"}" style="width:${pct}%"></div></div>
        <div class="small text-muted-dc mt-1">${overdue.length} en retard</div>
      </div>
    </div>`;
  }

  function performanceRow(dept, cards, tickets) {
    const deptCards = cards.filter((c) => c.department === dept.id);
    const doneCards = deptCards.filter((c) => c.status === "done");
    const completionPct = deptCards.length ? Math.round((doneCards.length / deptCards.length) * 100) : 0;

    const deptTickets = tickets.filter((t) => t.targetService === dept.id);
    const resolvedTickets = deptTickets.filter((t) => ["resolu", "ferme"].includes(t.status));
    const withDuration = resolvedTickets.filter((t) => t.closedAt);
    const avgDays = withDuration.length
      ? Math.round((withDuration.reduce((sum, t) => sum + (new Date(t.closedAt) - new Date(t.createdAt)) / 86400000, 0) / withDuration.length) * 10) / 10
      : null;

    return `<tr>
      <td class="small fw-semibold"><i class="bi ${dept.icon} text-primary me-1"></i>${DCUtils.escapeHtml(dept.shortName || dept.name)}</td>
      <td class="small">${doneCards.length} / ${deptCards.length}</td>
      <td style="min-width:140px;">
        <div class="d-flex align-items-center gap-2">
          <div class="progress flex-grow-1" style="height:6px;"><div class="progress-bar bg-success" style="width:${completionPct}%"></div></div>
          <span class="small text-muted-dc">${completionPct}%</span>
        </div>
      </td>
      <td class="small">${resolvedTickets.length} / ${deptTickets.length}</td>
      <td class="small">${avgDays !== null ? `${avgDays} j` : "-"}</td>
    </tr>`;
  }

  function staffRow(s, users, departments, cards) {
    const u = users.find((x) => x.id === s.userId);
    const dept = departments.find((d) => d.id === s.department);
    const assigned = cards.filter((c) => (c.assignees || []).includes(s.id) && c.status !== "done");
    const overdue = assigned.filter((c) => KanbanEngine.isOverdue(c));
    return `<tr>
      <td class="small"><span class="dc-avatar dc-avatar-sm me-2" style="background:${u ? u.avatarColor : "#5B4B8A"}">${u ? u.avatarInitials : "?"}</span>${u ? DCUtils.escapeHtml(`${u.firstName} ${u.lastName}`) : s.position}</td>
      <td class="small">${dept ? DCUtils.escapeHtml(dept.shortName || dept.name) : "-"}</td>
      <td class="small">${assigned.length}</td>
      <td class="small">${overdue.length ? `<span class="text-danger fw-semibold">${overdue.length}</span>` : "0"}</td>
      <td style="min-width:160px;">
        <div class="d-flex align-items-center gap-2">
          <div class="progress flex-grow-1" style="height:6px;"><div class="progress-bar ${s.workloadPct > 80 ? "bg-danger" : s.workloadPct > 60 ? "bg-warning" : "bg-success"}" style="width:${s.workloadPct}%"></div></div>
          <span class="small text-muted-dc">${s.workloadPct}%</span>
        </div>
      </td>
    </tr>`;
  }

  async function init() {
    const admin = await Auth.guard(["admin"]);
    if (!admin) return;
    await Layout.mountApp("admin", "workload", admin);

    const [departments, staff, users, cards, tickets] = await Promise.all([
      DataStore.getDepartments(), DataStore.getStaff(), DataStore.getUsers(), DataStore.getCards(), DataStore.getTickets(),
    ]);
    const activeCards = cards.filter((c) => c.boardId !== "board-central");

    document.getElementById("pole-cards").innerHTML = departments.map((d) => poleCard(d, activeCards)).join("");
    document.getElementById("performance-tbody").innerHTML = departments.map((d) => performanceRow(d, activeCards, tickets)).join("");
    document.getElementById("staff-tbody").innerHTML = staff
      .slice().sort((a, b) => b.workloadPct - a.workloadPct)
      .map((s) => staffRow(s, users, departments, activeCards)).join("");
  }

  document.addEventListener("DOMContentLoaded", init);
})();
