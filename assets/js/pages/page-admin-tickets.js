/**
 * Centre de tickets (admin) : vue transverse tous services, avec assignation,
 * réassignation et escalade — l'administration a la main sur tous les tickets,
 * là où chaque conseiller ne voit (côté staff) que les siens.
 */
(function () {
  let tickets, staff, users, departments;

  function staffName(staffId) {
    const s = staff.find((x) => x.id === staffId);
    if (!s) return null;
    const u = users.find((x) => x.id === s.userId);
    return u ? `${u.firstName} ${u.lastName}` : s.position;
  }

  function serviceLabel(code) {
    const d = departments.find((x) => x.id === code);
    return d ? (d.shortName || d.name) : code;
  }

  function currentFilters() {
    return {
      q: DCUtils.qs("#f-q").value.trim().toLowerCase(),
      status: DCUtils.qs("#f-status").value,
      priority: DCUtils.qs("#f-priority").value,
      service: DCUtils.qs("#f-service").value,
      unassigned: DCUtils.qs("#f-unassigned").value,
    };
  }

  function applyFilters() {
    const f = currentFilters();
    const results = tickets.filter((t) => (
      (!f.q || `${t.id} ${t.requesterName}`.toLowerCase().includes(f.q)) &&
      Filters.selectMatch(t.status, f.status) &&
      Filters.selectMatch(t.priority, f.priority) &&
      Filters.selectMatch(t.targetService, f.service) &&
      (f.unassigned === "all" || !t.assignedTo)
    ));
    render(results);
  }

  function row(t) {
    const assignee = t.assignedTo ? staffName(t.assignedTo) : null;
    return `<tr>
      <td><span class="fw-semibold small">${t.id}</span>${t.urgent ? ' <span class="dc-badge dc-badge-danger">Urgent</span>' : ""}</td>
      <td class="small">${DCUtils.escapeHtml(t.requesterName)}<div class="text-muted-dc">${DCUtils.escapeHtml(t.requesterRole || "")}</div></td>
      <td class="small">${serviceLabel(t.targetService)}</td>
      <td>${DCUtils.priorityBadge(t.priority)}</td>
      <td class="small">${assignee ? DCUtils.escapeHtml(assignee) : '<span class="text-muted-dc">Non assigné</span>'}</td>
      <td>${DCUtils.statusBadge(t.status)}</td>
      <td class="small">${t.dueAt ? DCUtils.formatDate(t.dueAt) : "-"}</td>
      <td class="text-end"><button class="btn btn-sm btn-outline-secondary" data-action="view" data-id="${t.id}">Traiter</button></td>
    </tr>`;
  }

  function render(results) {
    document.getElementById("results-count").textContent = `${results.length} ticket${results.length > 1 ? "s" : ""}`;
    document.getElementById("tickets-tbody").innerHTML = results.length
      ? results.map(row).join("")
      : `<tr><td colspan="8"><div class="dc-empty-state py-4"><p class="small mb-0">Aucun ticket ne correspond à ces filtres.</p></div></td></tr>`;
  }

  function assigneeOptions(selected) {
    return staff.map((s) => `<option value="${s.id}" ${s.id === selected ? "selected" : ""}>${DCUtils.escapeHtml(staffName(s.id))} — ${DCUtils.escapeHtml(s.position)}</option>`).join("");
  }

  function openDetail(id, admin) {
    const t = tickets.find((x) => x.id === id);
    DCUtils.qs("#detailModalLabel").textContent = `${t.id} — ${serviceLabel(t.targetService)}`;
    DCUtils.qs("#detailModalBody").innerHTML = `
      <div class="row g-2 small mb-3">
        <div class="col-6"><strong>Demandeur</strong><div class="text-muted-dc">${DCUtils.escapeHtml(t.requesterName)} (${DCUtils.escapeHtml(t.requesterEmail || "")})</div></div>
        <div class="col-6"><strong>Catégorie</strong><div class="text-muted-dc">${DCUtils.escapeHtml((t.category || "").replace(/_/g, " "))}</div></div>
        <div class="col-6"><strong>Créé le</strong><div class="text-muted-dc">${DCUtils.formatDateTime(t.createdAt)}</div></div>
        <div class="col-6"><strong>Échéance</strong><div class="text-muted-dc">${t.dueAt ? DCUtils.formatDateTime(t.dueAt) : "-"}</div></div>
      </div>
      <div class="row g-2 mb-3">
        <div class="col-md-6">
          <label class="form-label small">Réassigner à</label>
          <select class="form-select form-select-sm" id="td-assignee"><option value="">Non assigné</option>${assigneeOptions(t.assignedTo)}</select>
        </div>
        <div class="col-md-3">
          <label class="form-label small">Statut</label>
          <select class="form-select form-select-sm" id="td-status">${["nouveau", "en_cours", "en_attente_reponse", "resolu", "ferme"].map((s) => `<option value="${s}" ${s === t.status ? "selected" : ""}>${s.replace(/_/g, " ")}</option>`).join("")}</select>
        </div>
        <div class="col-md-3">
          <label class="form-label small">Priorité</label>
          <select class="form-select form-select-sm" id="td-priority">${["basse", "normale", "haute", "urgente"].map((s) => `<option value="${s}" ${s === t.priority ? "selected" : ""}>${s}</option>`).join("")}</select>
        </div>
      </div>
      <button class="btn btn-primary btn-sm mb-3" id="td-save">Enregistrer</button>
      <button class="btn btn-outline-danger btn-sm mb-3 ms-2" id="td-escalate"><i class="bi bi-arrow-up-circle me-1"></i>Escalader à la direction</button>
      <hr>
      <strong class="small d-block mb-2"><i class="bi bi-clock-history me-1"></i>Historique</strong>
      <ol class="dc-timeline dc-timeline-compact mb-3">
        ${(t.history || []).map((h) => `<li class="is-done"><span class="dc-timeline-dot"></span><strong>${h.status.replace(/_/g, " ")}</strong> — ${DCUtils.escapeHtml(h.note || "")}<div class="dc-timeline-date">${DCUtils.formatDateTime(h.date)}</div></li>`).join("") || "<p class='dc-empty-mini'>Aucun historique.</p>"}
      </ol>
      <strong class="small d-block mb-2"><i class="bi bi-sticky me-1"></i>Notes internes</strong>
      <ul class="list-unstyled small mb-0">
        ${(t.internalNotes || []).map((n) => `<li class="mb-1">${DCUtils.escapeHtml(n.note)} <span class="text-muted-dc">— ${DCUtils.formatDateTime(n.date)}</span></li>`).join("") || "<li class='dc-empty-mini'>Aucune note interne.</li>"}
      </ul>
    `;
    const modal = new bootstrap.Modal(document.getElementById("detailModal"));
    modal.show();

    document.getElementById("td-save").addEventListener("click", async () => {
      const newAssignee = DCUtils.qs("#td-assignee").value || null;
      const newStatus = DCUtils.qs("#td-status").value;
      const newPriority = DCUtils.qs("#td-priority").value;
      const before = { assignedTo: t.assignedTo, status: t.status, priority: t.priority };
      const historyEntry = { date: new Date().toISOString(), status: newStatus, note: "Mis à jour par l'administration.", byStaffId: null };
      t.history = t.history || [];
      t.history.push(historyEntry);
      await DataStore.update("tickets", t.id, { assignedTo: newAssignee, status: newStatus, priority: newPriority });
      await AuditLog.record({
        actor: { id: admin.id, label: `${admin.firstName} ${admin.lastName}`, role: admin.role }, module: "tickets",
        action: "ticket_reassigne", targetType: "ticket", targetId: t.id,
        before, after: { assignedTo: newAssignee, status: newStatus, priority: newPriority },
        details: `Ticket ${t.id} réassigné/mis à jour par l'administration (statut : ${newStatus}).`,
      });
      DCUtils.toast("Ticket mis à jour.", "success");
      modal.hide();
      applyFilters();
    });

    document.getElementById("td-escalate").addEventListener("click", async () => {
      const before = { priority: t.priority, urgent: t.urgent };
      await AuditLog.record({
        actor: { id: admin.id, label: `${admin.firstName} ${admin.lastName}`, role: admin.role }, module: "tickets",
        action: "ticket_escalade", targetType: "ticket", targetId: t.id,
        before, after: { priority: "urgente", urgent: true },
        details: `Ticket ${t.id} escaladé à la direction.`,
      });
      await DataStore.update("tickets", t.id, { priority: "urgente", urgent: true });
      DCUtils.toast("Ticket escaladé à la direction.", "info");
      modal.hide();
      applyFilters();
    });
  }

  async function init() {
    const admin = await Auth.guard(["admin"]);
    if (!admin) return;
    await Layout.mountApp("admin", "tickets", admin);

    [tickets, staff, users, departments] = await Promise.all([
      DataStore.getTickets(), DataStore.getStaff(), DataStore.getUsers(), DataStore.getDepartments(),
    ]);

    const serviceSelect = document.getElementById("f-service");
    [...new Set(tickets.map((t) => t.targetService))].forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s; opt.textContent = serviceLabel(s);
      serviceSelect.appendChild(opt);
    });

    render(tickets);
    document.getElementById("filters-form").addEventListener("input", DCUtils.debounce(applyFilters, 150));
    document.getElementById("filters-form").addEventListener("change", applyFilters);
    document.getElementById("tickets-tbody").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action='view']");
      if (btn) openDetail(btn.dataset.id, admin);
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
