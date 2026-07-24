(function () {
  function kpiCard(icon, color, value, label) {
    return `<div class="col-6 col-md-3">
      <div class="dc-stat-card"><div class="dc-stat-icon dc-icon-${color} mb-2"><i class="bi ${icon}"></i></div><div class="dc-stat-value">${value}</div><div class="dc-stat-label">${label}</div></div>
    </div>`;
  }

  function barRow(label, count, total, color) {
    const pct = total ? Math.round((count / total) * 100) : 0;
    return `<div class="mb-2">
      <div class="d-flex justify-content-between small mb-1"><span>${DCUtils.escapeHtml(label)}</span><span class="text-muted-dc">${count}</span></div>
      <div class="progress" style="height:8px;"><div class="progress-bar bg-${color}" style="width:${pct}%"></div></div>
    </div>`;
  }

  async function init() {
    const admin = await Auth.guard(["admin"]);
    if (!admin) return;
    await Layout.mountApp("admin", "reports", admin);

    const [tickets, cards, departments, matchings] = await Promise.all([
      DataStore.getTickets(), DataStore.getCards(), DataStore.getDepartments(), DataStore.getMatchings(),
    ]);

    const resolved = tickets.filter((t) => t.closedAt);
    const avgDays = resolved.length
      ? Math.round(resolved.reduce((sum, t) => sum + (new Date(t.closedAt) - new Date(t.createdAt)) / 86400000, 0) / resolved.length * 10) / 10
      : 0;
    const activeCards = cards.filter((c) => c.boardId !== "board-central");

    document.getElementById("kpi-row").innerHTML = [
      kpiCard("bi-ticket-perforated", "navy", tickets.length, "Tickets créés"),
      kpiCard("bi-clock-history", "teal", `${avgDays} j`, "Délai moyen de clôture"),
      kpiCard("bi-diagram-3", "terracotta", matchings.filter((m) => m.status === "active").length, "Matchings actifs"),
      kpiCard("bi-kanban", "purple", activeCards.length, "Cartes actives"),
    ].join("");

    const statusCounts = {};
    tickets.forEach((t) => { statusCounts[t.status] = (statusCounts[t.status] || 0) + 1; });
    const statusColors = { nouveau: "info", en_cours: "warning", en_attente_reponse: "warning", resolu: "success", ferme: "secondary" };
    document.getElementById("tickets-breakdown").innerHTML = Object.entries(statusCounts)
      .map(([status, count]) => barRow(status.replace(/_/g, " "), count, tickets.length, statusColors[status] || "secondary")).join("");

    document.getElementById("cards-breakdown").innerHTML = departments
      .map((d) => barRow(d.shortName || d.name, activeCards.filter((c) => c.department === d.id).length, activeCards.length, "primary")).join("");

    document.getElementById("export-btn").addEventListener("click", () => DCUtils.toast("Export généré (simulation) — à connecter à un vrai moteur de reporting côté backend.", "info"));
  }

  document.addEventListener("DOMContentLoaded", init);
})();
