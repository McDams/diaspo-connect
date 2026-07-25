(function () {
  let opportunities, users;
  const TYPE_LABELS = { job_saisonnier: "Job saisonnier", stage: "Stage", alternance: "Alternance" };

  function currentFilters() { return { status: DCUtils.qs("#f-status").value }; }
  function applyFilters() {
    const f = currentFilters();
    render(opportunities.filter((o) => Filters.selectMatch(o.moderationStatus, f.status)));
  }

  function card(o) {
    const publisher = users.find((u) => u.id === o.publisherId);
    const pending = o.moderationStatus === "soumise";
    return `<div class="dc-card p-3 mb-3">
      <div class="d-flex justify-content-between flex-wrap gap-2 mb-2">
        <div>
          <span class="badge text-bg-light border me-1">${TYPE_LABELS[o.type]}</span>
          <h6 class="d-inline mb-0">${DCUtils.escapeHtml(o.title)}</h6>
          <div class="small text-muted-dc">Par ${DCUtils.escapeHtml(publisher?.firstName)} ${DCUtils.escapeHtml(publisher?.lastName)} · ${DCUtils.escapeHtml(o.city)}</div>
        </div>
        ${DCUtils.statusBadge(o.moderationStatus)}
      </div>
      <p class="small text-body-secondary mb-2">${DCUtils.escapeHtml(o.description)}</p>
      <div class="d-flex flex-wrap gap-1 mb-2">${o.requirements.map((r) => `<span class="badge text-bg-light border">${DCUtils.escapeHtml(r)}</span>`).join("")}</div>
      ${pending ? `<div class="d-flex gap-2">
        <button class="btn btn-sm btn-success" data-action="approve" data-id="${o.id}"><i class="bi bi-check2 me-1"></i>Valider</button>
        <button class="btn btn-sm btn-outline-danger" data-action="reject" data-id="${o.id}">Rejeter</button>
      </div>` : ""}
    </div>`;
  }

  function render(list) {
    document.getElementById("results-count").textContent = `${list.length} offre${list.length > 1 ? "s" : ""}`;
    document.getElementById("opp-list").innerHTML = list.length ? list.map(card).join("") : `
      <div class="dc-empty-state"><div class="dc-empty-icon mx-auto"><i class="bi bi-briefcase"></i></div><h6>Aucune offre pour ce filtre</h6></div>`;
  }

  async function init() {
    const admin = await Auth.guard(["admin"]);
    if (!admin) return;
    await Layout.mountApp("admin", "moderation-opportunites", admin);

    [opportunities, users] = await Promise.all([DataStore.getOpportunities(), DataStore.getUsers()]);
    render(opportunities.filter((o) => o.moderationStatus === "soumise"));
    document.getElementById("f-status").value = "soumise";

    document.getElementById("filters-form").addEventListener("input", applyFilters);
    document.getElementById("opp-list").addEventListener("click", async (e) => {
      const approveBtn = e.target.closest("button[data-action='approve']");
      const rejectBtn = e.target.closest("button[data-action='reject']");
      const btn = approveBtn || rejectBtn;
      if (!btn) return;
      const opp = opportunities.find((o) => o.id === btn.dataset.id);
      const previousStatus = opp.moderationStatus;
      opp.moderationStatus = approveBtn ? "validee" : "rejetee";
      await AuditLog.record({
        actor: { id: admin.id, label: `${admin.firstName} ${admin.lastName}`, role: admin.role }, module: "opportunities",
        action: approveBtn ? "validation_offre" : "rejet_offre", targetType: "opportunity", targetId: opp.id,
        before: { moderationStatus: previousStatus }, after: { moderationStatus: opp.moderationStatus },
        details: `Offre "${opp.title}" ${approveBtn ? "validée" : "rejetée"}.`,
      });
      await NotificationCenter.push(opp.publisherId, {
        type: "offre_validee",
        title: approveBtn ? "Offre validée" : "Offre rejetée",
        text: `Votre offre "${opp.title}" a été ${approveBtn ? "validée" : "rejetée"}.`,
        link: "pages/public/opportunites.html",
      });
      DCUtils.toast(approveBtn ? "Offre validée." : "Offre rejetée.", "success");
      applyFilters();
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
