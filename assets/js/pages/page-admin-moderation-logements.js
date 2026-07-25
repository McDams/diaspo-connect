(function () {
  let housing, users;

  function currentFilters() { return { status: DCUtils.qs("#f-status").value }; }
  function applyFilters() {
    const f = currentFilters();
    render(housing.filter((h) => Filters.selectMatch(h.moderationStatus, f.status)));
  }

  function card(h) {
    const owner = users.find((u) => u.id === h.ownerId);
    const pending = h.moderationStatus === "soumise";
    return `<div class="dc-card p-3 mb-3">
      <div class="d-flex justify-content-between flex-wrap gap-2 mb-2">
        <div>
          <h6 class="mb-0">${DCUtils.escapeHtml(h.title)}</h6>
          <span class="small text-muted-dc">Par ${DCUtils.escapeHtml(owner?.firstName)} ${DCUtils.escapeHtml(owner?.lastName)} · ${DCUtils.escapeHtml(h.city)}</span>
        </div>
        ${DCUtils.statusBadge(h.moderationStatus)}
      </div>
      <p class="small text-body-secondary mb-2">${DCUtils.escapeHtml(h.description)}</p>
      <div class="d-flex flex-wrap gap-3 small text-muted-dc mb-2">
        <span><i class="bi bi-cash-coin me-1"></i>${DCUtils.currency(h.budget)}/mois</span>
        <span><i class="bi bi-rulers me-1"></i>${h.surface} m²</span>
        <span><i class="bi bi-calendar me-1"></i>${h.immediateAvailability ? "Disponible de suite" : DCUtils.formatDate(h.availableFrom)}</span>
      </div>
      ${pending ? `<div class="d-flex gap-2">
        <button class="btn btn-sm btn-success" data-action="approve" data-id="${h.id}"><i class="bi bi-check2 me-1"></i>Valider</button>
        <button class="btn btn-sm btn-outline-danger" data-action="reject" data-id="${h.id}">Rejeter</button>
      </div>` : ""}
    </div>`;
  }

  function render(list) {
    document.getElementById("results-count").textContent = `${list.length} annonce${list.length > 1 ? "s" : ""}`;
    document.getElementById("listings-list").innerHTML = list.length ? list.map(card).join("") : `
      <div class="dc-empty-state"><div class="dc-empty-icon mx-auto"><i class="bi bi-house-check"></i></div><h6>Aucune annonce pour ce filtre</h6></div>`;
  }

  async function init() {
    const admin = await Auth.guard(["admin"]);
    if (!admin) return;
    await Layout.mountApp("admin", "moderation-logements", admin);

    [housing, users] = await Promise.all([DataStore.getHousing(), DataStore.getUsers()]);
    render(housing.filter((h) => h.moderationStatus === "soumise"));
    document.getElementById("f-status").value = "soumise";

    document.getElementById("filters-form").addEventListener("input", applyFilters);
    document.getElementById("listings-list").addEventListener("click", async (e) => {
      const approveBtn = e.target.closest("button[data-action='approve']");
      const rejectBtn = e.target.closest("button[data-action='reject']");
      const btn = approveBtn || rejectBtn;
      if (!btn) return;
      const listing = housing.find((h) => h.id === btn.dataset.id);
      const previousStatus = listing.moderationStatus;
      listing.moderationStatus = approveBtn ? "validee" : "rejetee";
      listing.verified = !!approveBtn;
      await NotificationCenter.push(listing.ownerId, {
        type: "annonce_validee",
        title: approveBtn ? "Annonce validée" : "Annonce rejetée",
        text: `Votre annonce "${listing.title}" a été ${approveBtn ? "validée" : "rejetée"} par l'équipe de modération.`,
        link: "pages/proprietaire/annonces.html",
      });
      await AuditLog.record({
        actor: { id: admin.id, label: `${admin.firstName} ${admin.lastName}`, role: admin.role }, module: "housing",
        action: approveBtn ? "validation_annonce" : "rejet_annonce", targetType: "housing", targetId: listing.id,
        before: { moderationStatus: previousStatus }, after: { moderationStatus: listing.moderationStatus },
        details: `Annonce "${listing.title}" ${approveBtn ? "validée" : "rejetée"}.`,
      });
      DCUtils.toast(approveBtn ? "Annonce validée." : "Annonce rejetée.", "success");
      applyFilters();
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
