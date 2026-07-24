/**
 * Page "À propos" - organigramme FONCTIONNEL uniquement.
 * Aucune identité n'est affichée publiquement : ni nom, ni avatar, ni photo.
 * Seuls les pôles, leurs missions et leurs responsabilités sont présentés.
 * Les annuaires nominatifs (staff-directory, team-member-detail) restent
 * réservés à l'espace interne authentifié.
 */
(function () {
  function poleCard(pole, dept) {
    if (!dept) return "";
    const subPoles = dept.subPoles?.length
      ? `<div class="dc-pole-subpoles">${dept.subPoles.map((s) => `<span class="badge text-bg-light border dc-pole-subpole-badge"><i class="bi ${s.icon} me-1"></i>${DCUtils.escapeHtml(s.name)}</span>`).join("")}</div>`
      : "";
    return `<div class="col-md-6 col-lg-4">
      <div class="dc-pole-card">
        <h6><i class="bi ${dept.icon} text-primary"></i>${DCUtils.escapeHtml(pole.title)}</h6>
        <p class="dc-pole-mission">${DCUtils.escapeHtml(dept.mission || dept.description)}</p>
        <ul class="dc-pole-responsibilities">
          ${(dept.responsibilities || []).map((r) => `<li><i class="bi bi-check2"></i><span>${DCUtils.escapeHtml(r)}</span></li>`).join("")}
        </ul>
        ${subPoles}
      </div>
    </div>`;
  }

  function orgChartGrid(orgNodes, departments) {
    // Pôles de premier niveau : enfants directs de la direction (node-1).
    const poles = orgNodes.filter((n) => n.parentId === "node-1");
    return poles.map((pole) => poleCard(pole, departments.find((d) => d.id === pole.departmentId))).join("");
  }

  async function init() {
    const [orgNodes, departments] = await Promise.all([
      DataStore.getOrgChart(), DataStore.getDepartments(),
    ]);
    const direction = departments.find((d) => d.id === "direction");
    document.getElementById("orgchart-founder").innerHTML = `
      <div class="dc-orgchart-founder">
        <i class="bi ${direction.icon} fs-3 text-white mb-2 d-block"></i>
        <h5 class="text-white mb-1">Direction</h5>
        <div class="small opacity-75">${DCUtils.escapeHtml(direction.mission)}</div>
      </div>
      <div class="dc-orgchart-connector"></div>`;
    document.getElementById("orgchart-grid").innerHTML = `<div class="row g-3">${orgChartGrid(orgNodes, departments)}</div>`;
  }

  document.addEventListener("DOMContentLoaded", init);
})();
