(function () {
  let documents, users;

  function ownerName(id) {
    const u = users.find((x) => x.id === id);
    return u ? `${u.firstName} ${u.lastName}` : id;
  }

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
  }

  function row(d) {
    return `<tr>
      <td class="small fw-semibold">${DCUtils.escapeHtml(d.title)}${d.relatedRecordType ? `<div class="text-muted-dc fw-normal">${DCUtils.escapeHtml(d.relatedRecordType)} ${DCUtils.escapeHtml(d.relatedRecordId || "")}</div>` : ""}</td>
      <td class="small">${DCUtils.escapeHtml(ownerName(d.ownerId))}<div class="text-muted-dc">${DCUtils.escapeHtml(d.ownerRole)}</div></td>
      <td class="small">${DCUtils.escapeHtml(d.type)}</td>
      <td class="small">${DCUtils.formatDate(d.uploadedAt)}</td>
      <td>${DCUtils.statusBadge(d.status === "valide" ? "validee_annonce" : d.status === "rejete" ? "rejetee" : "en_attente_verification")}</td>
      <td class="text-end">
        ${d.status === "en_attente" ? `
          <button class="btn btn-sm btn-outline-success" data-action="validate" data-id="${d.id}">Valider</button>
          <button class="btn btn-sm btn-outline-danger" data-action="reject" data-id="${d.id}">Rejeter</button>
        ` : `<span class="small text-muted-dc">${d.notes ? DCUtils.escapeHtml(d.notes) : "-"}</span>`}
      </td>
    </tr>`;
  }

  function render(results) {
    document.getElementById("results-count").textContent = `${results.length} document${results.length > 1 ? "s" : ""}`;
    document.getElementById("docs-tbody").innerHTML = results.length
      ? results.map(row).join("")
      : `<tr><td colspan="6"><div class="dc-empty-state py-4"><p class="small mb-0">Aucun document ne correspond à ces filtres.</p></div></td></tr>`;
  }

  async function decide(id, decision, admin) {
    const doc = documents.find((d) => d.id === id);
    await DataStore.update("documents", id, { status: decision, reviewedBy: "staff-011", reviewedAt: new Date().toISOString() });
    await DataStore.insert("auditLog", {
      id: DataStore.nextId("audit"), actorId: admin.id, actorName: `${admin.firstName} ${admin.lastName}`,
      action: decision === "valide" ? "document_valide" : "document_rejete", targetType: "document", targetId: id, date: new Date().toISOString(),
      details: `Document « ${doc.title} » (${ownerName(doc.ownerId)}) ${decision === "valide" ? "validé" : "rejeté"} par l'administration.`,
    });
    DCUtils.toast(decision === "valide" ? "Document validé." : "Document rejeté.", decision === "valide" ? "success" : "danger");
    applyFilters();
  }

  async function init() {
    const admin = await Auth.guard(["admin"]);
    if (!admin) return;
    await Layout.mountApp("admin", "documents", admin);

    [documents, users] = await Promise.all([DataStore.getDocuments(), DataStore.getUsers()]);
    render(documents);
    document.getElementById("filters-form").addEventListener("input", DCUtils.debounce(applyFilters, 150));
    document.getElementById("filters-form").addEventListener("change", applyFilters);
    document.getElementById("docs-tbody").addEventListener("click", (e) => {
      const validateBtn = e.target.closest("button[data-action='validate']");
      const rejectBtn = e.target.closest("button[data-action='reject']");
      if (validateBtn) decide(validateBtn.dataset.id, "valide", admin);
      if (rejectBtn) {
        ConfirmModal.open({
          title: "Rejeter ce document",
          body: "Le déposant devra fournir un nouveau document. Confirmez-vous le rejet ?",
          confirmLabel: "Rejeter",
          onConfirm: () => decide(rejectBtn.dataset.id, "rejete", admin),
        });
      }
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
