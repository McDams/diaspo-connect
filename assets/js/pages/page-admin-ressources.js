/**
 * Gestion des ressources, de la FAQ et des bannières publiques (admin).
 * Les guides/FAQ alimentent la page publique "Ressources" ; les bannières
 * alimentent la barre d'information affichée en haut des pages publiques
 * (Layout.mountSiteBanner) pendant leur fenêtre de diffusion.
 */
(function () {
  let resources, announcements, adminUser;
  const CATEGORY_LABELS = {
    demarches_administratives: "Démarches administratives", logement: "Logement", banque: "Banque",
    assurance: "Assurance", transport: "Transport", sante: "Santé", checklist_arrivee: "Checklist d'arrivée", faq: "FAQ",
  };
  const AUDIENCE_LABELS = { tous: "Tous les visiteurs", mentore: "Mentorés", mentor: "Mentors", proprietaire: "Propriétaires" };

  async function logAudit(action, targetType, targetId, details, before, after) {
    await AuditLog.record({
      actor: { id: adminUser.id, label: `${adminUser.firstName} ${adminUser.lastName}`, role: adminUser.role },
      module: "content", action, targetType, targetId, before: before || null, after: after || null, details,
    });
  }

  // --- Guides & FAQ -------------------------------------------------------

  function resourceRow(r) {
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

  function renderResources() {
    document.getElementById("resources-tbody").innerHTML = resources.length
      ? resources.map(resourceRow).join("")
      : `<tr><td colspan="4"><div class="dc-empty-state py-4"><p class="small mb-0">Aucune ressource.</p></div></td></tr>`;
  }

  function openResourceEditor(resource) {
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

  async function submitResource(e) {
    e.preventDefault();
    const id = document.getElementById("resource-id").value;
    const isFaq = document.getElementById("modal-type").value === "faq";
    const now = new Date().toISOString();
    let resource = resources.find((r) => r.id === id);
    const isNew = !resource;

    const base = isFaq
      ? { category: "faq", question: document.getElementById("modal-question").value, answer: document.getElementById("modal-answer").value }
      : { category: document.getElementById("modal-category").value, title: document.getElementById("modal-title").value, content: document.getElementById("modal-content").value, tags: [] };

    if (resource) {
      Object.assign(resource, base, { updatedAt: now });
    } else {
      resource = { id: DataStore.nextId("resource"), order: resources.length + 1, updatedAt: now, ...base };
      await DataStore.insert("resources", resource);
    }
    await logAudit(isNew ? "creation_ressource" : "modification_ressource", "resource", resource.id,
      `Ressource « ${resource.title || resource.question} » ${isNew ? "créée" : "modifiée"}.`);
    bootstrap.Modal.getInstance(document.getElementById("resourceModal")).hide();
    DCUtils.toast("Ressource enregistrée.", "success");
    renderResources();
  }

  async function deleteResource(id) {
    const resource = resources.find((r) => r.id === id);
    await DataStore.remove("resources", id);
    await logAudit("suppression_ressource", "resource", id, `Ressource « ${resource.title || resource.question} » supprimée.`);
    DCUtils.toast("Ressource supprimée.", "info");
    renderResources();
  }

  // --- Bannières / annonces -----------------------------------------------

  function bannerStatus(a) {
    const now = new Date("2026-07-25T09:00:00");
    if (now < new Date(a.startsAt)) return { label: "Programmée", cls: "dc-badge-info" };
    if (now > new Date(a.endsAt)) return { label: "Expirée", cls: "dc-badge-neutral" };
    return { label: "Active", cls: "dc-badge-success" };
  }

  function bannerRow(a) {
    const status = bannerStatus(a);
    return `<tr>
      <td class="small fw-semibold">${DCUtils.escapeHtml(a.title)}</td>
      <td class="small">${AUDIENCE_LABELS[a.audience] || a.audience}</td>
      <td class="small">${DCUtils.formatDate(a.startsAt)} → ${DCUtils.formatDate(a.endsAt)}</td>
      <td><span class="dc-badge ${status.cls}">${status.label}</span></td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-secondary" data-action="edit-banner" data-id="${a.id}">Modifier</button>
        <button class="btn btn-sm btn-outline-danger" data-action="delete-banner" data-id="${a.id}">Supprimer</button>
      </td>
    </tr>`;
  }

  function renderBanners() {
    document.getElementById("banners-tbody").innerHTML = announcements.length
      ? announcements.map(bannerRow).join("")
      : `<tr><td colspan="5"><div class="dc-empty-state py-4"><p class="small mb-0">Aucune bannière programmée.</p></div></td></tr>`;
  }

  function openBannerEditor(banner) {
    document.getElementById("banner-id").value = banner?.id || "";
    document.getElementById("banner-title").value = banner?.title || "";
    document.getElementById("banner-body").value = banner?.body || "";
    document.getElementById("banner-audience").value = banner?.audience || "tous";
    document.getElementById("banner-start").value = banner ? banner.startsAt.slice(0, 10) : "";
    document.getElementById("banner-end").value = banner ? banner.endsAt.slice(0, 10) : "";
    document.getElementById("bannerModalLabel").textContent = banner ? "Modifier la bannière" : "Nouvelle bannière";
    ["banner-title", "banner-body", "banner-start", "banner-end"].forEach((id) => document.getElementById(id).classList.remove("is-invalid", "is-valid"));
    new bootstrap.Modal(document.getElementById("bannerModal")).show();
  }

  async function submitBanner(e) {
    e.preventDefault();
    const valid = FormValidation.validateForm(e.target, {
      title: [FormValidation.rules.required],
      body: [FormValidation.rules.required],
      startsAt: [FormValidation.rules.required],
      endsAt: [FormValidation.rules.required],
    });
    if (!valid) return;

    const id = document.getElementById("banner-id").value;
    const isNew = !id;
    const payload = {
      title: document.getElementById("banner-title").value.trim(),
      body: document.getElementById("banner-body").value.trim(),
      audience: document.getElementById("banner-audience").value,
      startsAt: `${document.getElementById("banner-start").value}T00:00:00`,
      endsAt: `${document.getElementById("banner-end").value}T23:59:59`,
    };

    if (isNew) {
      const banner = { id: DataStore.nextId("ann"), createdBy: adminUser.id, createdAt: new Date().toISOString(), ...payload };
      await DataStore.insert("announcements", banner);
    } else {
      await DataStore.update("announcements", id, payload);
    }
    await logAudit(isNew ? "creation_banniere" : "modification_banniere", "announcement", id || "nouvelle", `Bannière « ${payload.title} » ${isNew ? "créée" : "modifiée"}.`);
    bootstrap.Modal.getInstance(document.getElementById("bannerModal")).hide();
    DCUtils.toast("Bannière enregistrée.", "success");
    renderBanners();
  }

  async function deleteBanner(id) {
    const banner = announcements.find((a) => a.id === id);
    await DataStore.remove("announcements", id);
    await logAudit("suppression_banniere", "announcement", id, `Bannière « ${banner.title} » supprimée.`);
    DCUtils.toast("Bannière supprimée.", "info");
    renderBanners();
  }

  async function init() {
    adminUser = await Auth.guard(["admin"]);
    if (!adminUser) return;
    await Layout.mountApp("admin", "ressources", adminUser);

    [resources, announcements] = await Promise.all([DataStore.getResources(), DataStore.getAnnouncements()]);
    renderResources();
    renderBanners();

    document.getElementById("new-resource-btn").addEventListener("click", () => openResourceEditor(null));
    document.getElementById("modal-type").addEventListener("change", () => openResourceEditor(null));
    document.getElementById("resources-tbody").addEventListener("click", (e) => {
      const editBtn = e.target.closest("button[data-action='edit']");
      const deleteBtn = e.target.closest("button[data-action='delete']");
      if (editBtn) openResourceEditor(resources.find((r) => r.id === editBtn.dataset.id));
      if (deleteBtn) {
        ConfirmModal.open({
          title: "Supprimer cette ressource",
          body: "Cette ressource ne sera plus visible sur les pages publiques. Confirmez-vous ?",
          confirmLabel: "Supprimer",
          onConfirm: () => deleteResource(deleteBtn.dataset.id),
        });
      }
    });
    document.getElementById("resource-form").addEventListener("submit", submitResource);

    document.getElementById("new-banner-btn").addEventListener("click", () => openBannerEditor(null));
    document.getElementById("banners-tbody").addEventListener("click", (e) => {
      const editBtn = e.target.closest("button[data-action='edit-banner']");
      const deleteBtn = e.target.closest("button[data-action='delete-banner']");
      if (editBtn) openBannerEditor(announcements.find((a) => a.id === editBtn.dataset.id));
      if (deleteBtn) {
        ConfirmModal.open({
          title: "Supprimer cette bannière",
          body: "Elle ne sera plus diffusée sur les pages publiques. Confirmez-vous ?",
          confirmLabel: "Supprimer",
          onConfirm: () => deleteBanner(deleteBtn.dataset.id),
        });
      }
    });
    document.getElementById("banner-form").addEventListener("submit", submitBanner);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
