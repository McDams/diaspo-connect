/**
 * Gestion des ressources et de la FAQ (admin) : création et modification
 * de guides pratiques et d'entrées FAQ affichés sur les pages publiques.
 */
(function () {
  let resources;
  const CATEGORY_LABELS = {
    demarches_administratives: "Démarches administratives", logement: "Logement", banque: "Banque",
    assurance: "Assurance", transport: "Transport", sante: "Santé", checklist_arrivee: "Checklist d'arrivée", faq: "FAQ",
  };

  function row(r) {
    const title = r.category === "faq" ? r.question : r.title;
    return `<tr>
      <td>${DCUtils.escapeHtml(title)}</td>
      <td><span class="badge text-bg-light border">${CATEGORY_LABELS[r.category] || r.category}</span></td>
      <td>${DCUtils.formatDate(r.updatedAt)}</td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-secondary" data-action="edit" data-id="${r.id}">Modifier</button>
        <button class="btn btn-sm btn-outline-danger" data-action="delete" data-id="${r.id}">Supprimer</button>
      </td>
    </tr>`;
  }

  function render() {
    document.getElementById("resources-tbody").innerHTML = resources.length
      ? resources.map(row).join("")
      : `<tr><td colspan="4"><div class="dc-empty-state py-4"><p class="small mb-0">Aucune ressource.</p></div></td></tr>`;
  }

  function openEditor(resource) {
    const isFaq = resource ? resource.category === "faq" : document.getElementById("modal-type").value === "faq";
    document.getElementById("guide-fields").classList.toggle("d-none", isFaq);
    document.getElementById("faq-fields").classList.toggle("d-none", !isFaq);
    document.getElementById("resource-id").value = resource?.id || "";
    document.getElementById("modal-type").value = isFaq ? "faq" : "guide";
    document.getElementById("modal-category").value = resource?.category && resource.category !== "faq" ? resource.category : "demarches_administratives";
    document.getElementById("modal-title").value = resource?.title || "";
    document.getElementById("modal-content").value = resource?.content || "";
    document.getElementById("modal-question").value = resource?.question || "";
    document.getElementById("modal-answer").value = resource?.answer || "";
    document.getElementById("resourceModalLabel").textContent = resource ? "Modifier la ressource" : "Nouvelle ressource";
    new bootstrap.Modal(document.getElementById("resourceModal")).show();
  }

  async function init() {
    const admin = await Auth.guard(["admin"]);
    if (!admin) return;
    await Layout.mountApp("admin", "ressources", admin);

    resources = await DataStore.getResources();
    render();

    document.getElementById("new-resource-btn").addEventListener("click", () => openEditor(null));
    document.getElementById("modal-type").addEventListener("change", () => openEditor(null));

    document.getElementById("resources-tbody").addEventListener("click", (e) => {
      const editBtn = e.target.closest("button[data-action='edit']");
      const deleteBtn = e.target.closest("button[data-action='delete']");
      if (editBtn) openEditor(resources.find((r) => r.id === editBtn.dataset.id));
      if (deleteBtn) {
        ConfirmModal.open({
          title: "Supprimer cette ressource",
          body: "Cette ressource ne sera plus visible sur les pages publiques. Confirmez-vous ?",
          confirmLabel: "Supprimer",
          onConfirm: () => {
            resources = resources.filter((r) => r.id !== deleteBtn.dataset.id);
            DCUtils.toast("Ressource supprimée.", "info");
            render();
          },
        });
      }
    });

    document.getElementById("resource-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const id = document.getElementById("resource-id").value;
      const isFaq = document.getElementById("modal-type").value === "faq";
      const now = new Date().toISOString();
      let resource = resources.find((r) => r.id === id);

      const base = isFaq
        ? { category: "faq", question: document.getElementById("modal-question").value, answer: document.getElementById("modal-answer").value }
        : { category: document.getElementById("modal-category").value, title: document.getElementById("modal-title").value, content: document.getElementById("modal-content").value, tags: [] };

      if (resource) {
        Object.assign(resource, base, { updatedAt: now });
      } else {
        resource = { id: DataStore.nextId("resource"), order: resources.length + 1, updatedAt: now, ...base };
        resources.push(resource);
      }
      bootstrap.Modal.getInstance(document.getElementById("resourceModal")).hide();
      DCUtils.toast("Ressource enregistrée.", "success");
      render();
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
