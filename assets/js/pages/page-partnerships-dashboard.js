(function () {
  // Partenaires déjà actifs : donnée de démonstration (pas de flux d'inscription dédié dans ce prototype).
  const ACTIVE_PARTNERS = [
    { name: "Résidence Étudiante Vauban", type: "Logement", city: "Lille", since: "2025-09-01" },
    { name: "École Supérieure de Commerce Nantes", type: "Établissement", city: "Nantes", since: "2025-11-15" },
    { name: "Association des Étudiants Béninois de Lyon", type: "Association", city: "Lyon", since: "2025-04-01" },
  ];

  async function init() {
    const ctx = await StaffGuard.require("partnerships-dashboard");
    if (!ctx) return;
    await Layout.mountStaffApp("partnerships-dashboard", ctx);
    document.getElementById("welcome-name").textContent = ctx.user.firstName;

    const tickets = await DataStore.getTickets();
    const partnershipTickets = tickets.filter((t) => t.targetService === "partenariats" || t.category === "partenariat");
    const prospects = partnershipTickets.filter((t) => !["resolu", "ferme"].includes(t.status));

    document.getElementById("kpi-prospects").textContent = prospects.length;
    document.getElementById("kpi-active-partners").textContent = ACTIVE_PARTNERS.length;
    document.getElementById("kpi-collab-requests").textContent = partnershipTickets.length;

    document.getElementById("prospects-tbody").innerHTML = prospects.length ? prospects.map((t) => `<tr>
      <td class="fw-semibold small">${t.id}</td>
      <td>${DCUtils.escapeHtml(t.requesterName)}</td>
      <td>${DCUtils.escapeHtml(t.requesterEmail)}</td>
      <td>${DCUtils.statusBadge(t.status)}</td>
      <td class="text-end"><a href="tickets-management.html?id=${t.id}" class="btn btn-sm btn-outline-primary">Suivre</a></td>
    </tr>`).join("") : `<tr><td colspan="5"><div class="dc-empty-state py-3"><p class="small mb-0">Aucun prospect en cours.</p></div></td></tr>`;

    document.getElementById("active-partners-list").innerHTML = ACTIVE_PARTNERS.map((p) => `
      <div class="d-flex justify-content-between align-items-center py-2 border-bottom">
        <div><span class="small fw-semibold">${p.name}</span><div class="small text-muted-dc">${p.type} · ${p.city}</div></div>
        <span class="small text-muted-dc">Depuis ${DCUtils.formatDate(p.since)}</span>
      </div>`).join("");
  }

  document.addEventListener("DOMContentLoaded", init);
})();
