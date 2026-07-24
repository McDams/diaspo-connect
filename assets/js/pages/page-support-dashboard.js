(function () {
  async function init() {
    const ctx = await StaffGuard.require("support-dashboard");
    if (!ctx) return;
    await Layout.mountStaffApp("support-dashboard", ctx);
    document.getElementById("welcome-name").textContent = ctx.user.firstName;

    const tickets = await DataStore.getTickets();
    const supportTickets = tickets.filter((t) => t.targetService === "support" || t.category === "support_technique");
    const open = supportTickets.filter((t) => !["resolu", "ferme"].includes(t.status));
    const awaitingResponse = supportTickets.filter((t) => t.status === "en_attente_reponse" || (!t.responseSent && t.status !== "resolu"));

    document.getElementById("kpi-open").textContent = open.length;
    document.getElementById("kpi-awaiting").textContent = awaitingResponse.length;
    document.getElementById("kpi-resolved").textContent = supportTickets.filter((t) => t.status === "resolu").length;
    document.getElementById("kpi-satisfaction").textContent = "92%";

    document.getElementById("tickets-tbody").innerHTML = supportTickets.length ? supportTickets.map((t) => `<tr>
      <td class="fw-semibold small">${t.id}</td>
      <td>${DCUtils.escapeHtml(t.requesterName)}</td>
      <td>${DCUtils.priorityBadge(t.priority)}</td>
      <td>${DCUtils.statusBadge(t.status)}</td>
      <td class="small">${t.responseSent ? '<span class="text-success"><i class="bi bi-check2"></i> Répondu</span>' : '<span class="text-warning">En attente</span>'}</td>
      <td class="text-end"><a href="tickets-management.html?id=${t.id}" class="btn btn-sm btn-outline-primary">Ouvrir</a></td>
    </tr>`).join("") : `<tr><td colspan="6"><div class="dc-empty-state py-3"><p class="small mb-0">Aucun ticket support.</p></div></td></tr>`;
  }

  document.addEventListener("DOMContentLoaded", init);
})();
