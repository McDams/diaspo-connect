/**
 * Page publique "Opportunités" - jobs saisonniers, stages, alternances.
 * Seules les offres validées par la modération sont affichées.
 */
(function () {
  let opportunities = [];
  const TYPE_LABELS = { job_saisonnier: "Job saisonnier", stage: "Stage", alternance: "Alternance" };
  const TYPE_BADGES = { job_saisonnier: "dc-badge-info", stage: "dc-badge-success", alternance: "dc-badge-warning" };

  function visiblePublic() {
    return opportunities.filter((o) => o.moderationStatus === "validee");
  }

  function populateSelects() {
    const cities = [...new Set(visiblePublic().map((o) => o.city))].sort();
    const sectors = [...new Set(visiblePublic().map((o) => o.sector))].sort();
    const citySel = document.getElementById("f-ville");
    const sectorSel = document.getElementById("f-secteur");
    cities.forEach((c) => citySel.insertAdjacentHTML("beforeend", `<option value="${c}">${c}</option>`));
    sectors.forEach((s) => sectorSel.insertAdjacentHTML("beforeend", `<option value="${s}">${s}</option>`));
  }

  function currentFilters() {
    return {
      q: DCUtils.qs("#f-recherche").value.trim(),
      type: DCUtils.qs("#f-type").value,
      ville: DCUtils.qs("#f-ville").value,
      secteur: DCUtils.qs("#f-secteur").value,
    };
  }

  function applyFilters() {
    const f = currentFilters();
    const results = visiblePublic().filter((o) => (
      Filters.textMatch(o.title + " " + o.description, f.q) &&
      Filters.selectMatch(o.type, f.type) &&
      Filters.selectMatch(o.city, f.ville) &&
      Filters.selectMatch(o.sector, f.secteur)
    ));
    render(results);
  }

  function card(o) {
    return `
    <div class="col-md-6">
      <div class="dc-card dc-card-hover h-100 p-3">
        <div class="d-flex justify-content-between align-items-start mb-2">
          <span class="dc-badge ${TYPE_BADGES[o.type]}">${TYPE_LABELS[o.type]}</span>
          <span class="small text-muted-dc">${DCUtils.timeAgo(o.publishedAt)}</span>
        </div>
        <h6 class="mb-1">${DCUtils.escapeHtml(o.title)}</h6>
        <div class="small text-muted-dc mb-2"><i class="bi bi-geo-alt me-1"></i>${DCUtils.escapeHtml(o.city)} · ${DCUtils.escapeHtml(o.sector)}</div>
        <p class="small text-body-secondary mb-2">${DCUtils.escapeHtml(o.description).slice(0, 100)}…</p>
        <div class="d-flex justify-content-between align-items-center small mb-3">
          <span><i class="bi bi-clock-history me-1"></i>${DCUtils.escapeHtml(o.duration)}</span>
          <span class="fw-semibold">${DCUtils.escapeHtml(o.compensation)}</span>
        </div>
        <button class="btn btn-outline-primary btn-sm w-100" data-action="view" data-id="${o.id}">Voir l'offre</button>
      </div>
    </div>`;
  }

  function render(results) {
    const host = document.getElementById("opp-grid");
    document.getElementById("results-count").textContent = `${results.length} offre${results.length > 1 ? "s" : ""} disponible${results.length > 1 ? "s" : ""}`;
    if (!results.length) {
      host.innerHTML = `<div class="col-12"><div class="dc-empty-state">
        <div class="dc-empty-icon mx-auto"><i class="bi bi-briefcase"></i></div>
        <h6>Aucune offre ne correspond à ces critères</h6>
        <p class="small">Élargissez votre recherche par ville ou par secteur.</p>
      </div></div>`;
      return;
    }
    host.innerHTML = results.map(card).join("");
  }

  function openDetail(id) {
    const o = opportunities.find((x) => x.id === id);
    if (!o) return;
    DCUtils.qs("#detailModalLabel").textContent = o.title;
    DCUtils.qs("#detailModalBody").innerHTML = `
      <span class="dc-badge ${TYPE_BADGES[o.type]} mb-2">${TYPE_LABELS[o.type]}</span>
      <p>${DCUtils.escapeHtml(o.description)}</p>
      <div class="row g-3 small mb-3">
        <div class="col-6"><strong>Ville</strong><div class="text-muted-dc">${DCUtils.escapeHtml(o.city)}</div></div>
        <div class="col-6"><strong>Secteur</strong><div class="text-muted-dc">${DCUtils.escapeHtml(o.sector)}</div></div>
        <div class="col-6"><strong>Durée</strong><div class="text-muted-dc">${DCUtils.escapeHtml(o.duration)}</div></div>
        <div class="col-6"><strong>Rémunération</strong><div class="text-muted-dc">${DCUtils.escapeHtml(o.compensation)}</div></div>
      </div>
      <strong class="small d-block mb-1">Profil recherché</strong>
      <ul class="small text-body-secondary">${o.requirements.map((r) => `<li>${DCUtils.escapeHtml(r)}</li>`).join("")}</ul>
      <div class="dc-banner dc-banner-info"><i class="bi bi-shield-check"></i><span>Offre vérifiée par l'équipe de modération. Connectez-vous à votre espace mentoré pour candidater.</span></div>
    `;
    new bootstrap.Modal(document.getElementById("detailModal")).show();
  }

  async function init() {
    opportunities = await DataStore.getOpportunities();
    populateSelects();
    render(visiblePublic());
    document.getElementById("filters-form").addEventListener("input", DCUtils.debounce(applyFilters, 150));
    document.getElementById("reset-filters").addEventListener("click", () => { document.getElementById("filters-form").reset(); applyFilters(); });
    document.getElementById("opp-grid").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action='view']");
      if (btn) openDetail(btn.dataset.id);
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
