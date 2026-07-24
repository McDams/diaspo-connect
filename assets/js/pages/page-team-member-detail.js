(function () {
  const AVAILABILITY_LABELS = { "élevée": "Disponible", "moyenne": "Disponibilité modérée", "faible": "Disponibilité limitée" };

  async function init() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    const publicTeam = await DataStore.getPublicTeam();
    const member = publicTeam.find((p) => p.staffId === id);
    const host = document.getElementById("member-detail-host");

    if (!member) {
      host.innerHTML = `<div class="dc-empty-state">
        <div class="dc-empty-icon mx-auto"><i class="bi bi-person-x"></i></div>
        <h5>Profil indisponible</h5>
        <p class="small mb-3">Ce membre n'a pas souhaité rendre son profil public, ou le lien est incorrect.</p>
        <a href="about.html" class="btn btn-primary btn-sm">Retour à l'équipe</a>
      </div>`;
      return;
    }

    document.title = `${member.fullName} — DiaspoConnect`;
    host.innerHTML = `
      <div class="row g-4">
        <div class="col-lg-4">
          <div class="dc-card p-4 text-center">
            <span class="dc-avatar dc-avatar-lg mx-auto mb-3" style="background:${member.avatarColor}; width:96px; height:96px; font-size:2rem;">${member.avatarInitials}</span>
            <h4 class="mb-1">${DCUtils.escapeHtml(member.fullName)}</h4>
            <div class="badge text-bg-light border mb-2">${DCUtils.escapeHtml(member.position)}</div>
            <div class="small text-muted-dc mb-2"><i class="bi bi-geo-alt me-1"></i>${DCUtils.escapeHtml(member.city)}</div>
            <div class="small text-muted-dc mb-3">${AVAILABILITY_LABELS[member.availability] || ""}</div>
            ${member.contactLink ? `<a href="${member.contactLink}" class="btn btn-outline-primary btn-sm w-100 mb-2">Contacter directement</a>` : ""}
            <a href="contact-team.html" class="btn btn-primary btn-sm w-100">Passer par le formulaire de contact</a>
          </div>
        </div>
        <div class="col-lg-8">
          <div class="dc-card p-4">
            ${member.mainActivity ? `<p class="small text-muted-dc mb-1"><strong>Activité principale :</strong> ${DCUtils.escapeHtml(member.mainActivity)}</p>` : ""}
            ${member.specialty ? `<p class="small text-muted-dc mb-3"><strong>Spécialité :</strong> ${DCUtils.escapeHtml(member.specialty)}</p>` : ""}
            ${member.bio ? `<p class="text-body-secondary">${DCUtils.escapeHtml(member.bio)}</p>` : `<p class="text-body-secondary fst-italic">Ce membre n'a pas souhaité partager de biographie détaillée.</p>`}
            ${member.languages?.length ? `<div class="mt-3"><strong class="small d-block mb-1">Langues parlées</strong><div class="d-flex flex-wrap gap-1">${member.languages.map((l) => `<span class="badge text-bg-light border">${DCUtils.escapeHtml(l)}</span>`).join("")}</div></div>` : ""}
            <div class="dc-banner dc-banner-info mt-4">
              <i class="bi bi-shield-check"></i>
              <span>Ce membre a accepté que ces informations soient visibles publiquement. Aucune autre donnée personnelle n'est partagée.</span>
            </div>
          </div>
        </div>
      </div>`;
  }

  document.addEventListener("DOMContentLoaded", init);
})();
