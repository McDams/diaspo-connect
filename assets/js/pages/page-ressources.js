/**
 * Page publique "Ressources" - guides pratiques classés par catégorie,
 * alimentés dynamiquement depuis resources.json (hors FAQ, affichée à part).
 */
(function () {
  const CATEGORY_LABELS = {
    demarches_administratives: "Démarches administratives",
    logement: "Logement",
    banque: "Banque",
    assurance: "Assurance",
    transport: "Transport",
    sante: "Santé",
    checklist_arrivee: "Checklist d'arrivée",
  };
  const CATEGORY_ICONS = {
    demarches_administratives: "bi-file-earmark-text",
    logement: "bi-house-door",
    banque: "bi-bank",
    assurance: "bi-shield-check",
    transport: "bi-bus-front",
    sante: "bi-heart-pulse",
    checklist_arrivee: "bi-list-check",
  };

  function groupByCategory(resources) {
    const groups = {};
    resources.filter((r) => r.category !== "faq").forEach((r) => {
      groups[r.category] = groups[r.category] || [];
      groups[r.category].push(r);
    });
    return groups;
  }

  function render(resources) {
    const groups = groupByCategory(resources);
    const nav = document.getElementById("res-nav");
    const content = document.getElementById("res-content");
    nav.innerHTML = "";
    content.innerHTML = "";

    Object.keys(CATEGORY_LABELS).forEach((cat, i) => {
      if (!groups[cat]) return;
      nav.insertAdjacentHTML("beforeend", `
        <button class="list-group-item list-group-item-action ${i === 0 ? "active" : ""}" data-target="cat-${cat}">
          <i class="bi ${CATEGORY_ICONS[cat]} me-2"></i>${CATEGORY_LABELS[cat]}
        </button>`);

      content.insertAdjacentHTML("beforeend", `
        <div class="dc-res-pane ${i === 0 ? "" : "d-none"}" id="cat-${cat}">
          <h4 class="mb-3"><i class="bi ${CATEGORY_ICONS[cat]} text-primary me-2"></i>${CATEGORY_LABELS[cat]}</h4>
          <div class="accordion" id="accordion-${cat}">
            ${groups[cat].sort((a,b)=>a.order-b.order).map((r, idx) => `
              <div class="accordion-item">
                <h2 class="accordion-header">
                  <button class="accordion-button ${idx === 0 ? "" : "collapsed"}" type="button" data-bs-toggle="collapse" data-bs-target="#a-${r.id}">
                    ${DCUtils.escapeHtml(r.title)}
                  </button>
                </h2>
                <div id="a-${r.id}" class="accordion-collapse collapse ${idx === 0 ? "show" : ""}" data-bs-parent="#accordion-${cat}">
                  <div class="accordion-body">
                    <p class="text-body-secondary">${DCUtils.escapeHtml(r.content)}</p>
                    <div class="d-flex flex-wrap gap-1">${r.tags.map((t) => `<span class="badge text-bg-light border">${DCUtils.escapeHtml(t)}</span>`).join("")}</div>
                  </div>
                </div>
              </div>`).join("")}
          </div>
        </div>`);
    });

    nav.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-target]");
      if (!btn) return;
      nav.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      content.querySelectorAll(".dc-res-pane").forEach((p) => p.classList.add("d-none"));
      document.getElementById(btn.dataset.target).classList.remove("d-none");
    });
  }

  async function init() {
    const resources = await DataStore.getResources();
    render(resources);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
