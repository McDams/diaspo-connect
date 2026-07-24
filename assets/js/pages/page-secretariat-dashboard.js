/**
 * Dashboard Secrétariat - centralisation, tri et affectation des demandes.
 * Le secrétariat voit large (tous les tickets) mais ne peut qu'assigner /
 * marquer urgent / relancer, pas modérer ni administrer les permissions.
 */
(function () {
  let tickets, staffList, users, mentees;

  function incompleteMentees() {
    return mentees.filter((m) => m.profileCompleteness < 70);
  }

  function unassignedTickets() {
    return tickets.filter((t) => !t.assignedTo && !["resolu", "ferme"].includes(t.status));
  }

  function renderIncoming() {
    const list = tickets.filter((t) => t.status === "nouveau").sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    document.getElementById("incoming-count").textContent = `${list.length} nouvelle${list.length > 1 ? "s" : ""} demande${list.length > 1 ? "s" : ""}`;
    document.getElementById("incoming-tbody").innerHTML = list.length ? list.map(row).join("") : emptyRow("Aucune nouvelle demande.");
  }

  function emptyRow(msg) {
    return `<tr><td colspan="6"><div class="dc-empty-state py-3"><p class="small mb-0">${msg}</p></div></td></tr>`;
  }

  function row(t) {
    const assignee = TicketHelpers.assigneeName(t, staffList, users);
    const overdue = TicketHelpers.isOverdue(t);
    return `<tr class="${t.urgent ? "table-danger" : ""}">
      <td class="fw-semibold small">${t.id}</td>
      <td>${DCUtils.escapeHtml(t.requesterName)}<div class="small text-muted-dc">${DCUtils.escapeHtml(t.requesterEmail)}</div></td>
      <td>${TicketHelpers.categoryLabel(t.category)}</td>
      <td>${TicketHelpers.serviceLabel(t.targetService)}</td>
      <td>${DCUtils.priorityBadge(t.priority)}</td>
      <td>${DCUtils.statusBadge(t.status)} ${overdue ? '<i class="bi bi-alarm text-danger" title="En retard"></i>' : ""}</td>
      <td class="small">${assignee}</td>
      <td class="text-end">
        <a href="tickets-management.html?id=${t.id}" class="btn btn-sm btn-outline-primary">Traiter</a>
      </td>
    </tr>`;
  }

  function renderUnassigned() {
    const list = unassignedTickets();
    document.getElementById("unassigned-count").textContent = list.length;
    document.getElementById("unassigned-tbody").innerHTML = list.length ? list.map(row).join("") : emptyRow("Toutes les demandes sont assignées.");
  }

  function renderIncomplete() {
    const list = incompleteMentees();
    document.getElementById("incomplete-count").textContent = list.length;
    const host = document.getElementById("incomplete-list");
    host.innerHTML = list.length ? list.map((m) => {
      const u = users.find((x) => x.id === m.userId);
      return `<div class="d-flex align-items-center gap-2 py-2 border-bottom">
        <span class="dc-avatar dc-avatar-sm" style="background:${u.avatarColor}">${u.avatarInitials}</span>
        <div class="flex-grow-1">
          <div class="small fw-semibold">${DCUtils.escapeHtml(u.firstName)} ${DCUtils.escapeHtml(u.lastName)}</div>
          <div class="progress" style="height:5px;"><div class="progress-bar bg-warning" style="width:${m.profileCompleteness}%"></div></div>
        </div>
        <span class="small text-muted-dc">${m.profileCompleteness}%</span>
        <button class="btn btn-sm btn-outline-secondary" data-action="remind" data-email="${u.email}">Relancer</button>
      </div>`;
    }).join("") : `<div class="dc-empty-state py-3"><p class="small mb-0">Tous les dossiers filleuls sont complets.</p></div>`;
  }

  async function init() {
    const ctx = await StaffGuard.require("secretariat-dashboard");
    if (!ctx) return;
    await Layout.mountStaffApp("secretariat-dashboard", ctx);
    document.getElementById("welcome-name").textContent = ctx.user.firstName;

    [tickets, staffList, users, mentees] = await Promise.all([
      DataStore.getTickets(), DataStore.getStaff(), DataStore.getUsers(), DataStore.getMentees(),
    ]);

    renderIncoming();
    renderUnassigned();
    renderIncomplete();

    document.body.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action='remind']");
      if (btn) DCUtils.toast(`Relance envoyée à ${btn.dataset.email} (simulation).`, "success");
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
