/**
 * Page "À propos" - organigramme public + fiches équipe.
 * Respecte strictement le consentement d'affichage : seules les personnes
 * présentes dans public-team.json (déjà filtré par consentPublicDisplay et
 * publicVisibility) apparaissent avec leur identité. Les postes occupés par
 * des membres non consentants restent visibles dans l'organigramme, mais
 * sans aucune information personnelle.
 */
(function () {
  const AVAILABILITY_LABELS = { "élevée": "Disponible", "moyenne": "Disponibilité modérée", "faible": "Disponibilité limitée" };

  function founderCard(publicTeam) {
    const founder = publicTeam.find((p) => p.staffId === "staff-001");
    if (!founder) return "";
    return `
      <div class="dc-orgchart-founder">
        <span class="dc-avatar dc-avatar-lg" style="background:${founder.avatarColor}">${founder.avatarInitials}</span>
        <h5 class="text-white mb-0">${DCUtils.escapeHtml(founder.fullName)}</h5>
        <div class="small opacity-75 mb-2">${DCUtils.escapeHtml(founder.position)}</div>
        <a href="team-member-detail.html?id=${founder.staffId}" class="btn btn-sm btn-light">Voir le profil</a>
      </div>
      <div class="dc-orgchart-connector"></div>`;
  }

  function memberLine(staffId, orgNodes, publicTeam) {
    const pub = publicTeam.find((p) => p.staffId === staffId);
    if (pub) {
      return `<div class="dc-orgchart-member">
        <span class="dc-avatar dc-avatar-sm" style="background:${pub.avatarColor}">${pub.avatarInitials}</span>
        <div>
          <a href="team-member-detail.html?id=${pub.staffId}" class="dc-orgchart-member-name text-decoration-none">${DCUtils.escapeHtml(pub.fullName)}</a>
          <div class="dc-orgchart-member-role">${DCUtils.escapeHtml(pub.position)}</div>
        </div>
      </div>`;
    }
    return `<div class="dc-orgchart-member"><i class="bi bi-person-fill-lock text-muted-dc me-1"></i><span class="dc-orgchart-hidden">Poste occupé — profil non public</span></div>`;
  }

  function orgChartGrid(orgNodes, departments, publicTeam) {
    // Noeuds de premier niveau (poles) : enfants directs du fondateur, hors sous-membres du pôle conseil.
    const poles = orgNodes.filter((n) => n.parentId === "node-1");
    return poles.map((pole) => {
      const dept = departments.find((d) => d.id === pole.departmentId);
      const children = orgNodes.filter((n) => n.parentId === pole.id);
      const members = children.length
        ? children.map((c) => memberLine(c.staffId, orgNodes, publicTeam)).join("")
        : memberLine(pole.staffId, orgNodes, publicTeam);
      return `<div class="dc-orgchart-card">
        <h6><i class="bi ${dept ? dept.icon : "bi-diagram-3"} text-primary me-2"></i>${DCUtils.escapeHtml(pole.title)}</h6>
        ${members}
      </div>`;
    }).join("");
  }

  function teamCard(member) {
    return `<div class="col-sm-6 col-lg-4 col-xl-3">
      <div class="dc-card dc-card-hover p-3 dc-team-card">
        <span class="dc-avatar dc-avatar-lg" style="background:${member.avatarColor}">${member.avatarInitials}</span>
        <h6 class="mb-0">${DCUtils.escapeHtml(member.fullName)}</h6>
        <div class="dc-team-badge-post badge text-bg-light border mb-2">${DCUtils.escapeHtml(member.position)}</div>
        <div class="small text-muted-dc mb-1"><i class="bi bi-geo-alt me-1"></i>${DCUtils.escapeHtml(member.city)}</div>
        ${member.specialty ? `<p class="small text-body-secondary mb-2">${DCUtils.escapeHtml(member.specialty)}</p>` : ""}
        ${member.languages?.length ? `<div class="d-flex flex-wrap gap-1 justify-content-center mb-2">${member.languages.map((l) => `<span class="badge text-bg-light border">${DCUtils.escapeHtml(l)}</span>`).join("")}</div>` : ""}
        <div class="small text-muted-dc mb-2">${AVAILABILITY_LABELS[member.availability] || ""}</div>
        <a href="team-member-detail.html?id=${member.staffId}" class="btn btn-outline-primary btn-sm w-100">Voir le profil</a>
      </div>
    </div>`;
  }

  async function init() {
    const [publicTeam, orgNodes, departments] = await Promise.all([
      DataStore.getPublicTeam(), DataStore.getOrgChart(), DataStore.getDepartments(),
    ]);

    document.getElementById("orgchart-founder").innerHTML = founderCard(publicTeam);
    document.getElementById("orgchart-grid").innerHTML = orgChartGrid(orgNodes, departments, publicTeam);

    const others = publicTeam.filter((p) => p.staffId !== "staff-001");
    document.getElementById("team-grid").innerHTML = others.map(teamCard).join("");
  }

  document.addEventListener("DOMContentLoaded", init);
})();
