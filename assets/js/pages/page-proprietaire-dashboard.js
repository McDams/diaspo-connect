(function () {
  function card(h) {
    return `<div class="col-md-6">
      <div class="dc-card p-3 h-100">
        <div class="d-flex justify-content-between align-items-start mb-2">
          <h6 class="mb-0">${DCUtils.escapeHtml(h.title)}</h6>
          ${DCUtils.statusBadge(h.moderationStatus)}
        </div>
        <div class="small text-muted-dc mb-2">${DCUtils.escapeHtml(h.city)} · ${DCUtils.currency(h.budget)}/mois</div>
        <a href="annonces.html" class="btn btn-outline-primary btn-sm w-100">Gérer</a>
      </div>
    </div>`;
  }

  async function init() {
    const user = await Auth.guard(["proprietaire"]);
    if (!user) return;
    await Layout.mountApp("proprietaire", "dashboard", user);
    document.getElementById("welcome-name").textContent = user.firstName;

    const housing = await DataStore.getHousing();
    const mine = housing.filter((h) => h.ownerId === user.id);

    document.getElementById("kpi-published").textContent = mine.filter((h) => h.moderationStatus === "validee").length;
    document.getElementById("kpi-pending").textContent = mine.filter((h) => h.moderationStatus === "soumise").length;
    document.getElementById("kpi-rejected").textContent = mine.filter((h) => h.moderationStatus === "rejetee").length;
    document.getElementById("kpi-total").textContent = mine.length;

    document.getElementById("listings-grid").innerHTML = mine.length
      ? mine.slice(0, 4).map(card).join("")
      : `<div class="col-12"><div class="dc-empty-state">
          <div class="dc-empty-icon mx-auto"><i class="bi bi-house"></i></div>
          <h6>Vous n'avez publié aucune annonce</h6>
          <p class="small mb-3">Créez votre première annonce pour la proposer aux étudiants.</p>
          <a href="creer-annonce.html" class="btn btn-primary btn-sm">Créer une annonce</a>
        </div></div>`;
  }

  document.addEventListener("DOMContentLoaded", init);
})();
