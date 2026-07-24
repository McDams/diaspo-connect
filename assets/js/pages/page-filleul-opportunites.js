(function () {
  let opportunities, mentee;
  const TYPE_LABELS = { job_saisonnier: "Job saisonnier", stage: "Stage", alternance: "Alternance" };
  const TYPE_BADGES = { job_saisonnier: "dc-badge-info", stage: "dc-badge-success", alternance: "dc-badge-warning" };

  function ensureLists() {
    mentee.favoriteOpportunities = mentee.favoriteOpportunities || [];
    mentee.opportunityApplications = mentee.opportunityApplications || [];
  }

  function visiblePublic() { return opportunities.filter((o) => o.moderationStatus === "validee"); }

  function currentFilters() {
    return {
      q: DCUtils.qs("#f-recherche").value.trim(),
      type: DCUtils.qs("#f-type").value,
      favoritesOnly: DCUtils.qs("#f-favoris").checked,
    };
  }

  function applyFilters() {
    const f = currentFilters();
    let results = visiblePublic().filter((o) => (
      Filters.textMatch(o.title + " " + o.description, f.q) &&
      Filters.selectMatch(o.type, f.type)
    ));
    if (f.favoritesOnly) results = results.filter((o) => mentee.favoriteOpportunities.includes(o.id));
    render(results);
  }

  function card(o) {
    const isFav = mentee.favoriteOpportunities.includes(o.id);
    const applied = mentee.opportunityApplications.includes(o.id);
    return `<div class="col-md-6">
      <div class="dc-card dc-card-hover h-100 p-3">
        <div class="d-flex justify-content-between align-items-start mb-2">
          <span class="dc-badge ${TYPE_BADGES[o.type]}">${TYPE_LABELS[o.type]}</span>
          <button class="btn btn-link p-0 fs-5" data-action="fav" data-id="${o.id}" aria-label="Favori">
            <i class="bi ${isFav ? "bi-heart-fill text-danger" : "bi-heart"}"></i>
          </button>
        </div>
        <h6 class="mb-1">${DCUtils.escapeHtml(o.title)}</h6>
        <div class="small text-muted-dc mb-2">${DCUtils.escapeHtml(o.city)} · ${DCUtils.escapeHtml(o.sector)}</div>
        <p class="small text-body-secondary mb-3">${DCUtils.escapeHtml(o.description).slice(0, 90)}…</p>
        ${applied
          ? `<button class="btn btn-success btn-sm w-100" disabled><i class="bi bi-check2"></i> Candidature envoyée</button>`
          : `<button class="btn btn-primary btn-sm w-100" data-action="apply" data-id="${o.id}">Candidater</button>`}
      </div>
    </div>`;
  }

  function render(results) {
    const host = document.getElementById("opp-grid");
    document.getElementById("results-count").textContent = `${results.length} offre${results.length > 1 ? "s" : ""}`;
    host.innerHTML = results.length ? results.map(card).join("") : `
      <div class="col-12"><div class="dc-empty-state"><div class="dc-empty-icon mx-auto"><i class="bi bi-briefcase"></i></div><h6>Aucune offre trouvée</h6></div></div>`;
  }

  async function init() {
    const user = await Auth.guard(["filleul"]);
    if (!user) return;
    await Layout.mountApp("filleul", "opportunites", user);

    const mentees = await DataStore.getMentees();
    mentee = mentees.find((m) => m.userId === user.id);
    ensureLists();
    opportunities = await DataStore.getOpportunities();

    render(visiblePublic());

    document.getElementById("filters-form").addEventListener("input", DCUtils.debounce(applyFilters, 150));
    document.getElementById("opp-grid").addEventListener("click", (e) => {
      const favBtn = e.target.closest("button[data-action='fav']");
      const applyBtn = e.target.closest("button[data-action='apply']");
      if (favBtn) {
        const id = favBtn.dataset.id;
        const idx = mentee.favoriteOpportunities.indexOf(id);
        if (idx >= 0) mentee.favoriteOpportunities.splice(idx, 1); else mentee.favoriteOpportunities.push(id);
        applyFilters();
      }
      if (applyBtn) {
        mentee.opportunityApplications.push(applyBtn.dataset.id);
        DCUtils.toast("Votre candidature a été envoyée.", "success");
        applyFilters();
      }
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
