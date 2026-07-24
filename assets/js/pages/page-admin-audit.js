(function () {
  let entries;

  function currentFilters() {
    return {
      q: DCUtils.qs("#f-q").value.trim().toLowerCase(),
      action: DCUtils.qs("#f-action").value,
      target: DCUtils.qs("#f-target").value,
    };
  }

  function applyFilters() {
    const f = currentFilters();
    const results = entries.filter((e) => (
      (!f.q || `${e.actorName} ${e.details} ${e.targetId}`.toLowerCase().includes(f.q)) &&
      Filters.selectMatch(e.action, f.action) &&
      Filters.selectMatch(e.targetType, f.target)
    ));
    render(results);
  }

  function item(e) {
    return `<li class="is-done">
      <span class="dc-timeline-dot"></span>
      <strong>${DCUtils.escapeHtml(e.actorName)}</strong>
      <span class="dc-badge dc-badge-neutral ms-2">${DCUtils.escapeHtml(e.action.replace(/_/g, " "))}</span>
      <p class="mb-0 small">${DCUtils.escapeHtml(e.details)}</p>
      <div class="dc-timeline-date">${DCUtils.formatDateTime(e.date)} · cible : ${DCUtils.escapeHtml(e.targetType)} ${DCUtils.escapeHtml(e.targetId || "")}</div>
    </li>`;
  }

  function render(results) {
    document.getElementById("results-count").textContent = `${results.length} événement${results.length > 1 ? "s" : ""}`;
    const sorted = results.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
    document.getElementById("audit-list").innerHTML = sorted.length
      ? sorted.map(item).join("")
      : `<div class="dc-empty-state py-4"><p class="small mb-0">Aucun événement ne correspond à ces filtres.</p></div>`;
  }

  async function init() {
    const admin = await Auth.guard(["admin"]);
    if (!admin) return;
    await Layout.mountApp("admin", "audit", admin);

    entries = await DataStore.getAuditLog();

    const actionSelect = document.getElementById("f-action");
    [...new Set(entries.map((e) => e.action))].forEach((a) => {
      const opt = document.createElement("option");
      opt.value = a; opt.textContent = a.replace(/_/g, " ");
      actionSelect.appendChild(opt);
    });
    const targetSelect = document.getElementById("f-target");
    [...new Set(entries.map((e) => e.targetType))].forEach((t) => {
      const opt = document.createElement("option");
      opt.value = t; opt.textContent = t;
      targetSelect.appendChild(opt);
    });

    render(entries);
    document.getElementById("filters-form").addEventListener("input", DCUtils.debounce(applyFilters, 150));
    document.getElementById("filters-form").addEventListener("change", applyFilters);
    document.getElementById("export-btn").addEventListener("click", () => DCUtils.toast("Export généré (simulation) — à connecter à un vrai export CSV/PDF côté backend.", "info"));
  }

  document.addEventListener("DOMContentLoaded", init);
})();
