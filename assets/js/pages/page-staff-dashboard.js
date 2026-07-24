/**
 * Dashboard Direction - vue d'ensemble globale de la plateforme et de l'équipe.
 * Accessible aux accessLevel super_admin et direction_admin (cf. permissions.json).
 */
(function () {
  function staffRow(staff, user, matchings, tickets) {
    const myTickets = tickets.filter((t) => t.assignedTo === staff.id && !["resolu", "ferme"].includes(t.status));
    return `<tr>
      <td><div class="d-flex align-items-center gap-2">
        <span class="dc-avatar dc-avatar-sm" style="background:${user.avatarColor}">${user.avatarInitials}</span>
        <div><div class="fw-semibold small">${DCUtils.escapeHtml(user.firstName)} ${DCUtils.escapeHtml(user.lastName)}</div><div class="small text-muted-dc">${DCUtils.escapeHtml(staff.position)}</div></div>
      </div></td>
      <td>${DCUtils.escapeHtml(staff.collaboratorStatus)}</td>
      <td><div class="progress" style="height:6px;"><div class="progress-bar bg-primary" style="width:${staff.workloadPct}%"></div></div><span class="small text-muted-dc">${staff.workloadPct}%</span></td>
      <td>${myTickets.length}</td>
    </tr>`;
  }

  async function init() {
    const ctx = await StaffGuard.require("staff-dashboard");
    if (!ctx) return;
    await Layout.mountStaffApp("staff-dashboard", ctx);
    document.getElementById("welcome-name").textContent = ctx.user.firstName;

    const [users, mentees, mentors, matchings, housing, opportunities, reports, tickets, staffList] = await Promise.all([
      DataStore.getUsers(), DataStore.getMentees(), DataStore.getMentors(), DataStore.getMatchings(),
      DataStore.getHousing(), DataStore.getOpportunities(), DataStore.getReports(), DataStore.getTickets(), DataStore.getStaff(),
    ]);

    document.getElementById("kpi-active-users").textContent = users.filter((u) => u.status === "actif").length;
    const urgentTickets = tickets.filter((t) => ["haute", "urgente"].includes(t.priority) && !["resolu", "ferme"].includes(t.status));
    document.getElementById("kpi-urgent-tickets").textContent = urgentTickets.length;
    document.getElementById("kpi-critical-reports").textContent = reports.filter((r) => r.status === "ouvert").length;

    const closedTickets = tickets.filter((t) => ["resolu", "ferme"].includes(t.status));
    const perfPct = tickets.length ? Math.round((closedTickets.length / tickets.length) * 100) : 0;
    document.getElementById("kpi-performance").textContent = `${perfPct}%`;

    const activeMatchings = matchings.filter((m) => m.status === "active");
    const avgScore = activeMatchings.length ? Math.round(activeMatchings.reduce((s, m) => s + m.compatibilityScore, 0) / activeMatchings.length) : 0;
    document.getElementById("kpi-matching-quality").textContent = `${avgScore}%`;
    document.getElementById("kpi-housing-pending").textContent = housing.filter((h) => h.moderationStatus === "soumise").length;
    document.getElementById("kpi-opp-pending").textContent = opportunities.filter((o) => o.moderationStatus === "soumise").length;
    document.getElementById("kpi-mentees-total").textContent = mentees.length;

    document.getElementById("urgent-tickets-list").innerHTML = urgentTickets.length
      ? urgentTickets.slice(0, 6).map((t) => `<div class="d-flex justify-content-between align-items-center py-2 border-bottom">
          <div><span class="small fw-semibold">${t.id}</span> — <span class="small">${DCUtils.escapeHtml(t.requesterName)}</span><div class="small text-muted-dc">${TicketHelpers.categoryLabel(t.category)} · ${TicketHelpers.serviceLabel(t.targetService)}</div></div>
          <div class="text-end">${DCUtils.priorityBadge(t.priority)}<div>${DCUtils.statusBadge(t.status)}</div></div>
        </div>`).join("")
      : `<div class="dc-empty-state py-3"><p class="small mb-0">Aucun dossier urgent en attente.</p></div>`;

    document.getElementById("staff-activity-tbody").innerHTML = staffList.map((s) => {
      const u = users.find((x) => x.id === s.userId);
      return staffRow(s, u, matchings, tickets);
    }).join("");

    document.getElementById("tickets-management-link").href = "tickets-management.html";
  }

  document.addEventListener("DOMContentLoaded", init);
})();
