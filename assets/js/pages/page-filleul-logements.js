/**
 * Recherche de logement côté filleul connecté : mêmes filtres que la page
 * publique, avec favoris et candidature simulée (persistés en mémoire sur
 * le profil filleul le temps de la session).
 */
(function () {
  let housing, mentee;

  function ensureLists() {
    mentee.favoriteHousing = mentee.favoriteHousing || [];
    mentee.applications = mentee.applications || [];
  }

  function visiblePublic() { return housing.filter((h) => h.moderationStatus === "validee"); }

  function populateSelects() {
    const cities = [...new Set(visiblePublic().map((h) => h.city))].sort();
    const citySel = document.getElementById("f-ville");
    cities.forEach((c) => citySel.insertAdjacentHTML("beforeend", `<option value="${c}">${c}</option>`));
  }

  function currentFilters() {
    return {
      q: DCUtils.qs("#f-recherche").value.trim(),
      ville: DCUtils.qs("#f-ville").value,
      budget: DCUtils.qs("#f-budget").value,
      favoritesOnly: DCUtils.qs("#f-favoris").checked,
    };
  }

  function applyFilters() {
    const f = currentFilters();
    let results = visiblePublic().filter((h) => (
      Filters.textMatch(h.title + " " + h.city, f.q) &&
      Filters.selectMatch(h.city, f.ville) &&
      Filters.rangeMax(h.budget, f.budget)
    ));
    if (f.favoritesOnly) results = results.filter((h) => mentee.favoriteHousing.includes(h.id));
    render(results);
  }

  function card(h) {
    const isFav = mentee.favoriteHousing.includes(h.id);
    const applied = mentee.applications.includes(h.id);
    return `<div class="col-md-6 col-xl-4">
      <div class="dc-card dc-card-hover h-100 p-3 d-flex flex-column">
        <div class="d-flex justify-content-between align-items-start mb-1">
          <h6 class="mb-0">${DCUtils.escapeHtml(h.title)}</h6>
          <button class="btn btn-link p-0 fs-5" data-action="fav" data-id="${h.id}" aria-label="${isFav ? "Retirer des favoris" : "Ajouter aux favoris"}">
            <i class="bi ${isFav ? "bi-heart-fill text-danger" : "bi-heart"}"></i>
          </button>
        </div>
        <div class="small text-muted-dc mb-2">${DCUtils.escapeHtml(h.city)} · ${DCUtils.escapeHtml(h.type)}</div>
        <div class="fw-bold mb-2">${DCUtils.currency(h.budget)}<span class="fw-normal small text-muted-dc">/mois</span></div>
        <p class="small text-body-secondary mb-3">${DCUtils.escapeHtml(h.description).slice(0, 90)}…</p>
        <div class="mt-auto">
          ${applied
            ? `<button class="btn btn-success btn-sm w-100" disabled><i class="bi bi-check2"></i> Candidature envoyée</button>`
            : `<button class="btn btn-primary btn-sm w-100" data-action="apply" data-id="${h.id}">Candidater</button>`}
        </div>
      </div>
    </div>`;
  }

  function render(results) {
    const host = document.getElementById("housing-grid");
    document.getElementById("results-count").textContent = `${results.length} logement${results.length > 1 ? "s" : ""}`;
    host.innerHTML = results.length ? results.map(card).join("") : `
      <div class="col-12"><div class="dc-empty-state">
        <div class="dc-empty-icon mx-auto"><i class="bi bi-house-x"></i></div>
        <h6>Aucun logement trouvé</h6>
      </div></div>`;
  }

  async function init() {
    const user = await Auth.guard(["filleul"]);
    if (!user) return;
    await Layout.mountApp("filleul", "logements", user);

    const mentees = await DataStore.getMentees();
    mentee = mentees.find((m) => m.userId === user.id);
    ensureLists();
    housing = await DataStore.getHousing();

    populateSelects();
    render(visiblePublic());

    document.getElementById("filters-form").addEventListener("input", DCUtils.debounce(applyFilters, 150));
    document.getElementById("housing-grid").addEventListener("click", (e) => {
      const favBtn = e.target.closest("button[data-action='fav']");
      const applyBtn = e.target.closest("button[data-action='apply']");
      if (favBtn) {
        const id = favBtn.dataset.id;
        const idx = mentee.favoriteHousing.indexOf(id);
        if (idx >= 0) mentee.favoriteHousing.splice(idx, 1); else mentee.favoriteHousing.push(id);
        applyFilters();
      }
      if (applyBtn) {
        mentee.applications.push(applyBtn.dataset.id);
        DCUtils.toast("Votre candidature a été envoyée au propriétaire.", "success");
        applyFilters();
      }
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
