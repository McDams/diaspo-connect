(function () {
  const STALE_DAYS = 45;

  function daysSince(dateStr) {
    return Math.round((Date.now() - new Date(dateStr).getTime()) / 86400000);
  }

  async function init() {
    const ctx = await StaffGuard.require("content-dashboard");
    if (!ctx) return;
    await Layout.mountStaffApp("content-dashboard", ctx);
    document.getElementById("welcome-name").textContent = ctx.user.firstName;

    const resources = await DataStore.getResources();
    const guides = resources.filter((r) => r.category !== "faq");
    const faqs = resources.filter((r) => r.category === "faq");
    const stale = resources.filter((r) => daysSince(r.updatedAt) > STALE_DAYS);

    document.getElementById("kpi-guides").textContent = guides.length;
    document.getElementById("kpi-faqs").textContent = faqs.length;
    document.getElementById("kpi-stale").textContent = stale.length;
    const lastUpdate = resources.reduce((max, r) => new Date(r.updatedAt) > new Date(max) ? r.updatedAt : max, resources[0]?.updatedAt);
    document.getElementById("kpi-last-update").textContent = DCUtils.formatDate(lastUpdate);

    document.getElementById("stale-list").innerHTML = stale.length ? stale.map((r) => `
      <div class="d-flex justify-content-between align-items-center py-2 border-bottom">
        <div><span class="small fw-semibold">${DCUtils.escapeHtml(r.title || r.question)}</span><div class="small text-muted-dc">Mis à jour il y a ${daysSince(r.updatedAt)} jours</div></div>
        <span class="dc-badge dc-badge-warning">À revoir</span>
      </div>`).join("") : `<div class="dc-empty-state py-3"><p class="small mb-0">Tout le contenu est à jour.</p></div>`;

    document.getElementById("all-content-tbody").innerHTML = resources.map((r) => `<tr>
      <td>${DCUtils.escapeHtml(r.title || r.question)}</td>
      <td>${r.category === "faq" ? "FAQ" : DCUtils.escapeHtml(r.category.replace(/_/g, " "))}</td>
      <td>${DCUtils.formatDate(r.updatedAt)}</td>
    </tr>`).join("");
  }

  document.addEventListener("DOMContentLoaded", init);
})();
