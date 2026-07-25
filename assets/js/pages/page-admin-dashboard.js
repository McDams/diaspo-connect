(function () {
  async function init() {
    const user = await Auth.guard(["admin"]);
    if (!user) return;
    await Layout.mountApp("admin", "dashboard", user);

    const [users, mentees, mentors, matchings, housing, opportunities, reports, messages, tickets, documents, cards, auditLog] = await Promise.all([
      DataStore.getUsers(), DataStore.getMentees(), DataStore.getMentors(), DataStore.getMatchings(),
      DataStore.getHousing(), DataStore.getOpportunities(), DataStore.getReports(), DataStore.getMessages(),
      DataStore.getTickets(), DataStore.getDocuments(), DataStore.getCards(), DataStore.getAuditLog(),
    ]);

    document.getElementById("kpi-users").textContent = users.length;
    document.getElementById("kpi-mentees").textContent = mentees.length;
    document.getElementById("kpi-mentors").textContent = mentors.length;
    document.getElementById("kpi-active-matchings").textContent = matchings.filter((m) => m.status === "active").length;
    document.getElementById("kpi-housing-pending").textContent = housing.filter((h) => h.moderationStatus === "soumise").length;
    document.getElementById("kpi-reports-open").textContent = reports.filter((r) => r.status === "ouvert").length;
    const flaggedMessages = messages.flatMap((c) => c.messages.filter((m) => m.flagged));
    document.getElementById("kpi-flagged-messages").textContent = flaggedMessages.length;
    document.getElementById("kpi-opp-pending").textContent = opportunities.filter((o) => o.moderationStatus === "soumise").length;

    document.getElementById("kpi-tickets-open").textContent = tickets.filter((t) => !["resolu", "ferme"].includes(t.status)).length;
    document.getElementById("kpi-docs-pending").textContent = documents.filter((d) => d.status === "en_attente").length;
    document.getElementById("kpi-cards-overdue").textContent = cards.filter((c) => c.boardId !== "board-central" && KanbanEngine.isOverdue(c)).length;
    const DEMO_TODAY = new Date("2026-07-25T09:00:00");
    document.getElementById("kpi-new-users").textContent = users.filter((u) => (DEMO_TODAY - new Date(u.createdAt)) / 86400000 <= 30).length;

    // Alerte quota : mentors ayant dépassé (ou atteint) leur quota
    const overloaded = mentors.filter((m) => MatchingEngine.countActiveMentees(m.id, matchings) >= m.maxMentees);
    const alertHost = document.getElementById("quota-alerts");
    alertHost.innerHTML = overloaded.length
      ? overloaded.map((m) => {
          const u = users.find((x) => x.id === m.userId);
          return `<div class="dc-checklist-item"><i class="bi bi-people-fill text-warning"></i><span class="ms-2 small">${DCUtils.escapeHtml(u.firstName)} ${DCUtils.escapeHtml(u.lastName)} accompagne ${MatchingEngine.countActiveMentees(m.id, matchings)}/${m.maxMentees} mentorés (quota atteint)</span></div>`;
        }).join("")
      : `<div class="dc-empty-state py-3"><p class="small mb-0">Aucun dépassement de quota détecté.</p></div>`;

    const recentReports = reports.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
    document.getElementById("recent-reports").innerHTML = recentReports.length
      ? recentReports.map((r) => `<div class="d-flex justify-content-between align-items-center py-2 border-bottom">
          <div><span class="small fw-semibold text-capitalize">${DCUtils.escapeHtml(r.reason.replace(/_/g, " "))}</span><div class="small text-muted-dc">${DCUtils.timeAgo(r.createdAt)}</div></div>
          ${DCUtils.statusBadge(r.status)}
        </div>`).join("")
      : `<div class="dc-empty-state py-3"><p class="small mb-0">Aucun signalement.</p></div>`;

    const recentActivity = auditLog.slice().sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6);
    document.getElementById("recent-activity").innerHTML = recentActivity.length
      ? recentActivity.map((a) => `<div class="py-2 border-bottom">
          <div class="small"><strong>${DCUtils.escapeHtml(a.actorName)}</strong> — ${DCUtils.escapeHtml(a.action.replace(/_/g, " "))}</div>
          <div class="small text-muted-dc">${DCUtils.timeAgo(a.date)}</div>
        </div>`).join("")
      : `<div class="dc-empty-state py-3"><p class="small mb-0">Aucune activité récente.</p></div>`;
  }

  document.addEventListener("DOMContentLoaded", init);
})();
