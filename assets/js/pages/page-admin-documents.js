/**
 * Centre de documents (admin) : suivi des vérifications de conformité.
 * Ouvre une fiche détail par document (profil du déposant, dossier lié,
 * note de vérification) avant toute décision de validation/rejet.
 */
(function () {
  let documents, users, adminUser;

  function owner(id) { return users.find((x) => x.id === id); }
  function ownerName(id) { const u = owner(id); return u ? `${u.firstName} ${u.lastName}` : id; }

  function currentFilters() {
    return {
      q: DCUtils.qs("#f-q").value.trim().toLowerCase(),
      status: DCUtils.qs("#f-status").value,
      role: DCUtils.qs("#f-role").value,
    };
  }

  function applyFilters() {
    const f = currentFilters();
    const results = documents.filter((d) => (
      (!f.q || `${d.title} ${ownerName(d.ownerId)}`.toLowerCase().includes(f.q)) &&
      Filters.selectMatch(d.status, f.status) &&
      Filters.selectMatch(d.ownerRole, f.role)
    ));
    render(results);
    renderKpis();
  }

  function renderKpis() {
    document.getElementById("kpi-doc-pending").textContent = documents.filter((d) => d.status === "en_attente").length;
    document.getElementById("kpi-doc-valid").textContent = documents.filter((d) => d.status === "valide").length;
    document.getElementById("kpi-doc-rejected").textContent = documents.filter((d) => d.status === "rejete").length;
    document.getElementById("kpi-doc-total").textContent = documents.length;
  }

  function row(d) {
    return `<tr class="dc-clickable-row" data-id="${d.id}" style="cursor:pointer;">
      <td class="small fw-semibold">${DCUtils.escapeHtml(d.title)}${d.relatedRecordType ? `<div class="text-muted-dc fw-normal">${DCUtils.escapeHtml(d.relatedRecordType)} ${DCUtils.escapeHtml(d.relatedRecordId || "")}</div>` : ""}</td>
      <td class="small">${DCUtils.escapeHtml(ownerName(d.ownerId))}<div class="text-muted-dc">${DCUtils.escapeHtml(d.ownerRole)}</div></td>
      <td class="small">${DCUtils.escapeHtml(d.type)}</td>
      <td class="small">${DCUtils.formatDate(d.uploadedAt)}</td>
      <td>${DCUtils.statusBadge(d.status === "valide" ? "validee_annonce" : d.status === "rejete" ? "rejetee" : "en_attente_verification")}</td>
      <td class="text-end"><button class="btn btn-sm btn-outline-secondary" data-action="open" data-id="${d.id}">Ouvrir</button></td>
    </tr>`;
  }

  function render(results) {
    document.getElementById("results-count").textContent = `${results.length} document${results.length > 1 ? "s" : ""}`;
    document.getElementById("docs-tbody").innerHTML = results.length
      ? results.map(row).join("")
      : `<tr><td colspan="6"><div class="dc-empty-state py-4"><p class="small mb-0">Aucun document ne correspond à ces filtres.</p></div></td></tr>`;
  }

  function openDoc(id) {
    const d = documents.find((x) => x.id === id);
    const u = owner(d.ownerId);
    document.getElementById("docModalLabel").textContent = d.title;
    document.getElementById("docModalBody").innerHTML = `
      <div class="d-flex gap-3 align-items-center mb-3">
        <span class="dc-avatar dc-avatar-sm" style="background:${u ? u.avatarColor : "#5B4B8A"}">${u ? u.avatarInitials : "?"}</span>
        <div><div class="fw-semibold small">${DCUtils.escapeHtml(ownerName(d.ownerId))}</div><div class="small text-muted-dc">${DCUtils.escapeHtml(d.ownerRole)}${u ? ` · ${DCUtils.escapeHtml(u.email)}` : ""}</div></div>
      </div>
      <div class="row g-2 small mb-3">
        <div class="col-6"><strong>Type</strong><div class="text-muted-dc">${DCUtils.escapeHtml(d.type)}</div></div>
        <div class="col-6"><strong>Déposé le</strong><div class="text-muted-dc">${DCUtils.formatDateTime(d.uploadedAt)}</div></div>
        <div class="col-6"><strong>Statut</strong><div>${DCUtils.statusBadge(d.status === "valide" ? "validee_annonce" : d.status === "rejete" ? "rejetee" : "en_attente_verification")}</div></div>
        <div class="col-6"><strong>Dossier lié</strong><div class="text-muted-dc">${d.relatedRecordType ? `${DCUtils.escapeHtml(d.relatedRecordType)} ${DCUtils.escapeHtml(d.relatedRecordId || "")}` : "-"}</div></div>
        ${d.reviewedAt ? `<div class="col-12"><strong>Dernière vérification</strong><div class="text-muted-dc">${DCUtils.formatDateTime(d.reviewedAt)}</div></div>` : ""}
      </div>
      <div class="mb-3">
        <label for="doc-notes" class="form-label small">Note de vérification</label>
        <textarea class="form-control" id="doc-notes" rows="2">${DCUtils.escapeHtml(d.notes || "")}</textarea>
      </div>
      ${d.status === "en_attente" ? `
        <div class="d-flex gap-2">
          <button class="btn btn-success btn-sm flex-fill" id="doc-validate-btn"><i class="bi bi-check2 me-1"></i>Valider</button>
          <button class="btn btn-outline-danger btn-sm flex-fill" id="doc-reject-btn"><i class="bi bi-x-lg me-1"></i>Rejeter</button>
        </div>
      ` : `<div class="dc-banner dc-banner-info"><i class="bi bi-info-circle"></i><span>Décision déjà prise. Vous pouvez mettre à jour la note ci-dessus.</span>
          <button class="btn btn-outline-secondary btn-sm ms-auto" id="doc-note-save-btn">Enregistrer la note</button></div>`}
    `;
    const modal = new bootstrap.Modal(document.getElementById("docModal"));
    modal.show();

    const validateBtn = document.getElementById("doc-validate-btn");
    const rejectBtn = document.getElementById("doc-reject-btn");
    const noteSaveBtn = document.getElementById("doc-note-save-btn");
    if (validateBtn) validateBtn.addEventListener("click", () => { modal.hide(); decide(d.id, "valide"); });
    if (rejectBtn) rejectBtn.addEventListener("click", () => {
      modal.hide();
      ConfirmModal.open({
        title: "Rejeter ce document",
        body: "Le déposant devra fournir un nouveau document. Confirmez-vous le rejet ?",
        confirmLabel: "Rejeter",
        onConfirm: () => decide(d.id, "rejete"),
      });
    });
    if (noteSaveBtn) noteSaveBtn.addEventListener("click", async () => {
      await DataStore.update("documents", d.id, { notes: document.getElementById("doc-notes").value.trim() });
      modal.hide();
      DCUtils.toast("Note enregistrée.", "success");
    });
  }

  async function decide(id, decision) {
    const doc = documents.find((d) => d.id === id);
    const notesInput = document.getElementById("doc-notes");
    const notes = notesInput ? notesInput.value.trim() : doc.notes;
    await DataStore.update("documents", id, { status: decision, notes, reviewedBy: "staff-011", reviewedAt: new Date().toISOString() });
    await DataStore.insert("auditLog", {
      id: DataStore.nextId("audit"), actorId: adminUser.id, actorName: `${adminUser.firstName} ${adminUser.lastName}`,
      action: decision === "valide" ? "document_valide" : "document_rejete", targetType: "document", targetId: id, date: new Date().toISOString(),
      details: `Document « ${doc.title} » (${ownerName(doc.ownerId)}) ${decision === "valide" ? "validé" : "rejeté"} par l'administration.`,
    });
    DCUtils.toast(decision === "valide" ? "Document validé." : "Document rejeté.", decision === "valide" ? "success" : "danger");
    applyFilters();
  }

  async function init() {
    adminUser = await Auth.guard(["admin"]);
    if (!adminUser) return;
    await Layout.mountApp("admin", "documents", adminUser);

    [documents, users] = await Promise.all([DataStore.getDocuments(), DataStore.getUsers()]);
    render(documents);
    renderKpis();
    document.getElementById("filters-form").addEventListener("input", DCUtils.debounce(applyFilters, 150));
    document.getElementById("filters-form").addEventListener("change", applyFilters);
    document.getElementById("docs-tbody").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action='open']") || e.target.closest("tr[data-id]");
      const id = btn?.dataset.id;
      if (id) openDoc(id);
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
