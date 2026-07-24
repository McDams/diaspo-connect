/**
 * Annuaire interne - liste complète des membres de l'équipe (indépendamment
 * de leur visibilité publique, puisque cet outil est réservé à l'interne).
 */
(function () {
  let staffList, users, departments, ctx;

  function currentFilters() {
    return {
      q: DCUtils.qs("#f-recherche").value.trim(),
      department: DCUtils.qs("#f-departement").value,
      status: DCUtils.qs("#f-status").value,
    };
  }

  function applyFilters() {
    const f = currentFilters();
    const results = staffList.filter((s) => {
      const u = users.find((x) => x.id === s.userId);
      return (
        Filters.textMatch(`${u.firstName} ${u.lastName} ${s.position}`, f.q) &&
        Filters.selectMatch(s.department, f.department) &&
        Filters.selectMatch(s.collaboratorStatus, f.status)
      );
    });
    render(results);
  }

  function card(s) {
    const u = users.find((x) => x.id === s.userId);
    const dept = departments.find((d) => d.id === s.department);
    const isSelf = s.id === ctx.staff.id;
    return `<div class="col-md-6 col-xl-4">
      <div class="dc-card dc-card-hover h-100 p-3 ${isSelf ? "border-primary" : ""}">
        <div class="d-flex gap-3 align-items-start mb-2">
          <span class="dc-avatar" style="background:${u.avatarColor}">${u.avatarInitials}</span>
          <div class="flex-grow-1">
            <h6 class="mb-0">${DCUtils.escapeHtml(u.firstName)} ${DCUtils.escapeHtml(u.lastName)} ${isSelf ? '<span class="badge text-bg-light border">Vous</span>' : ""}</h6>
            <div class="small text-muted-dc">${DCUtils.escapeHtml(s.position)}</div>
          </div>
        </div>
        <div class="d-flex flex-wrap gap-1 mb-2">
          <span class="badge text-bg-light border"><i class="bi ${dept ? dept.icon : "bi-diagram-3"} me-1"></i>${dept ? dept.name : s.department}</span>
          <span class="badge text-bg-light border text-capitalize">${DCUtils.escapeHtml(s.collaboratorStatus)}</span>
        </div>
        <div class="small text-muted-dc mb-1"><i class="bi bi-geo-alt me-1"></i>${DCUtils.escapeHtml(s.city)}</div>
        <div class="mb-2">
          <div class="d-flex justify-content-between small text-muted-dc"><span>Charge de travail</span><span>${s.workloadPct}%</span></div>
          <div class="progress" style="height:6px;"><div class="progress-bar ${s.workloadPct >= 70 ? "bg-danger" : "bg-primary"}" style="width:${s.workloadPct}%"></div></div>
        </div>
        <div class="small text-muted-dc mb-2"><i class="bi bi-circle-fill me-1" style="font-size:0.5rem;"></i>Disponibilité : ${DCUtils.escapeHtml(s.availability)}</div>
        <div class="small text-muted-dc">
          <i class="bi ${s.consentPublicDisplay ? "bi-eye" : "bi-eye-slash"} me-1"></i>
          ${s.consentPublicDisplay ? `Visible publiquement (${s.publicVisibility.replace(/_/g, " ")})` : "Non visible publiquement"}
        </div>
      </div>
    </div>`;
  }

  function render(list) {
    document.getElementById("results-count").textContent = `${list.length} membre${list.length > 1 ? "s" : ""}`;
    document.getElementById("staff-grid").innerHTML = list.length ? list.map(card).join("") : `
      <div class="col-12"><div class="dc-empty-state"><p class="small mb-0">Aucun membre ne correspond à ces filtres.</p></div></div>`;
  }

  async function init() {
    ctx = await StaffGuard.require("staff-directory");
    if (!ctx) return;
    await Layout.mountStaffApp("staff-directory", ctx);

    [staffList, users, departments] = await Promise.all([DataStore.getStaff(), DataStore.getUsers(), DataStore.getDepartments()]);

    const deptSelect = document.getElementById("f-departement");
    departments.forEach((d) => deptSelect.insertAdjacentHTML("beforeend", `<option value="${d.id}">${d.name}</option>`));

    render(staffList);
    document.getElementById("filters-form").addEventListener("input", DCUtils.debounce(applyFilters, 150));
  }

  document.addEventListener("DOMContentLoaded", init);
})();
