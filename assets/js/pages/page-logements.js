/**
 * Page publique "Logements" - liste filtrable des annonces validées.
 * Seules les annonces au statut "validee" sont visibles publiquement :
 * la modération protège les visiteurs des annonces frauduleuses ou en attente.
 */
(function () {
  let housing = [], owners = [];

  const TYPE_ICONS = { Studio: "bi-door-closed", "Chambre chez l'habitant": "bi-house-heart", Colocation: "bi-people", T1: "bi-building", T2: "bi-building" };

  function visiblePublic() {
    return housing.filter((h) => h.moderationStatus === "validee");
  }

  function populateSelects() {
    const cities = [...new Set(visiblePublic().map((h) => h.city))].sort();
    const types = [...new Set(visiblePublic().map((h) => h.type))].sort();
    const citySel = document.getElementById("f-ville");
    const typeSel = document.getElementById("f-type");
    cities.forEach((c) => citySel.insertAdjacentHTML("beforeend", `<option value="${c}">${c}</option>`));
    types.forEach((t) => typeSel.insertAdjacentHTML("beforeend", `<option value="${t}">${t}</option>`));
  }

  function currentFilters() {
    return {
      q: DCUtils.qs("#f-recherche").value.trim(),
      ville: DCUtils.qs("#f-ville").value,
      type: DCUtils.qs("#f-type").value,
      budget: DCUtils.qs("#f-budget").value,
      immediate: DCUtils.qs("#f-immediat").checked,
    };
  }

  function applyFilters() {
    const f = currentFilters();
    const results = visiblePublic().filter((h) => (
      Filters.textMatch(h.title + " " + h.city, f.q) &&
      Filters.selectMatch(h.city, f.ville) &&
      Filters.selectMatch(h.type, f.type) &&
      Filters.rangeMax(h.budget, f.budget) &&
      (!f.immediate || h.immediateAvailability)
    ));
    render(results);
  }

  function card(h) {
    const owner = owners.find((o) => o.id === h.ownerId);
    return `
    <div class="col-md-6 col-xl-4">
      <div class="dc-card dc-card-hover h-100 dc-media-card">
        <div class="dc-media-placeholder"><i class="bi ${TYPE_ICONS[h.type] || 'bi-house'}"></i></div>
        <div class="p-3 d-flex flex-column">
          <div class="d-flex justify-content-between align-items-start mb-1">
            <h6 class="mb-0">${DCUtils.escapeHtml(h.title)}</h6>
            ${h.verified ? '<span class="dc-verified-badge"><i class="bi bi-patch-check-fill"></i></span>' : ""}
          </div>
          <div class="small text-muted-dc mb-2"><i class="bi bi-geo-alt me-1"></i>${DCUtils.escapeHtml(h.city)} · ${DCUtils.escapeHtml(h.type)}</div>
          <div class="d-flex justify-content-between align-items-center mb-2">
            <span class="fw-bold">${DCUtils.currency(h.budget)}<span class="fw-normal small text-muted-dc">/mois</span></span>
            ${h.immediateAvailability ? '<span class="dc-badge dc-badge-success">Disponible de suite</span>' : `<span class="dc-badge dc-badge-neutral">Dès le ${DCUtils.formatDate(h.availableFrom)}</span>`}
          </div>
          <p class="small text-body-secondary mb-2">${DCUtils.escapeHtml(h.description).slice(0, 90)}…</p>
          <div class="d-flex flex-wrap gap-1 mb-3">${h.amenities.map((a) => `<span class="badge text-bg-light border">${DCUtils.escapeHtml(a)}</span>`).join("")}</div>
          <div class="mt-auto d-flex gap-2">
            <button class="btn btn-outline-primary btn-sm flex-fill" data-action="view" data-id="${h.id}">Voir le détail</button>
          </div>
        </div>
      </div>
    </div>`;
  }

  function render(results) {
    const host = document.getElementById("housing-grid");
    document.getElementById("results-count").textContent = `${results.length} logement${results.length > 1 ? "s" : ""} disponible${results.length > 1 ? "s" : ""}`;
    if (!results.length) {
      host.innerHTML = `<div class="col-12"><div class="dc-empty-state">
        <div class="dc-empty-icon mx-auto"><i class="bi bi-house-x"></i></div>
        <h6>Aucun logement ne correspond à ces critères</h6>
        <p class="small">Essayez d'augmenter le budget maximum ou de changer de ville.</p>
      </div></div>`;
      return;
    }
    host.innerHTML = results.map(card).join("");
  }

  function openDetail(id) {
    const h = housing.find((x) => x.id === id);
    if (!h) return;
    const owner = owners.find((o) => o.id === h.ownerId);
    DCUtils.qs("#detailModalLabel").textContent = h.title;
    DCUtils.qs("#detailModalBody").innerHTML = `
      <div class="dc-media-placeholder mb-3" style="height:180px;border-radius:12px;"><i class="bi ${TYPE_ICONS[h.type] || 'bi-house'}" style="font-size:2.5rem;"></i></div>
      <p>${DCUtils.escapeHtml(h.description)}</p>
      <div class="row g-3 small mb-3">
        <div class="col-6"><strong>Ville</strong><div class="text-muted-dc">${DCUtils.escapeHtml(h.city)}</div></div>
        <div class="col-6"><strong>Type</strong><div class="text-muted-dc">${DCUtils.escapeHtml(h.type)}</div></div>
        <div class="col-6"><strong>Loyer</strong><div class="text-muted-dc">${DCUtils.currency(h.budget)} + ${DCUtils.currency(h.charges)} charges</div></div>
        <div class="col-6"><strong>Dépôt de garantie</strong><div class="text-muted-dc">${DCUtils.currency(h.deposit)}</div></div>
        <div class="col-6"><strong>Surface</strong><div class="text-muted-dc">${h.surface} m²</div></div>
        <div class="col-6"><strong>Disponibilité</strong><div class="text-muted-dc">${h.immediateAvailability ? "Immédiate" : DCUtils.formatDate(h.availableFrom)}</div></div>
      </div>
      <div class="d-flex flex-wrap gap-1 mb-3">${h.amenities.map((a) => `<span class="badge text-bg-light border">${DCUtils.escapeHtml(a)}</span>`).join("")}</div>
      <div class="dc-banner dc-banner-info"><i class="bi bi-shield-check"></i><span>Cette annonce a été vérifiée par l'équipe de modération DiaspoConnect. Ne versez jamais d'argent avant une visite.</span></div>
    `;
    new bootstrap.Modal(document.getElementById("detailModal")).show();
  }

  async function init() {
    [housing, owners] = await Promise.all([DataStore.getHousing(), DataStore.getUsers()]);
    populateSelects();
    render(visiblePublic());
    document.getElementById("filters-form").addEventListener("input", DCUtils.debounce(applyFilters, 150));
    document.getElementById("reset-filters").addEventListener("click", () => { document.getElementById("filters-form").reset(); applyFilters(); });
    document.getElementById("housing-grid").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action='view']");
      if (btn) openDetail(btn.dataset.id);
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
