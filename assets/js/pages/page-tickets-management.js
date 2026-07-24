/**
 * Centre de tickets - vue transverse utilisée par le secrétariat, la direction
 * et (en lecture/action limitée à leurs propres dossiers) les conseillers,
 * la modération, le support et les partenariats. La portée des tickets
 * visibles est filtrée selon `canManageAllTickets` : un conseiller ne voit
 * que les tickets qui lui sont assignés ou qui relèvent de son service.
 */
(function () {
  let tickets, staffList, users, ctx, canManageAll;

  function visibleTickets() {
    if (canManageAll) return tickets;
    return tickets.filter((t) => t.assignedTo === ctx.staff.id || t.targetService === ctx.staff.department);
  }

  function currentFilters() {
    return {
      status: DCUtils.qs("#f-status").value,
      priority: DCUtils.qs("#f-priority").value,
      service: DCUtils.qs("#f-service").value,
      q: DCUtils.qs("#f-recherche").value.trim(),
    };
  }

  function applyFilters() {
    const f = currentFilters();
    const results = visibleTickets().filter((t) => (
      Filters.selectMatch(t.status, f.status) &&
      Filters.selectMatch(t.priority, f.priority) &&
      Filters.selectMatch(t.targetService, f.service) &&
      Filters.textMatch(`${t.id} ${t.requesterName} ${t.requesterEmail}`, f.q)
    ));
    render(results);
  }

  function row(t) {
    const overdue = TicketHelpers.isOverdue(t);
    return `<tr data-id="${t.id}" style="cursor:pointer;" class="${overdue ? "table-danger" : ""}">
      <td class="fw-semibold small">${t.id}</td>
      <td>${DCUtils.escapeHtml(t.requesterName)}</td>
      <td>${TicketHelpers.categoryLabel(t.category)}</td>
      <td>${TicketHelpers.serviceLabel(t.targetService)}</td>
      <td>${DCUtils.priorityBadge(t.priority)}</td>
      <td>${DCUtils.statusBadge(t.status)}</td>
      <td class="small">${TicketHelpers.assigneeName(t, staffList, users)}</td>
      <td class="small">${DCUtils.timeAgo(t.createdAt)}</td>
    </tr>`;
  }

  function render(list) {
    document.getElementById("results-count").textContent = `${list.length} ticket${list.length > 1 ? "s" : ""}`;
    document.getElementById("tickets-tbody").innerHTML = list.length
      ? list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(row).join("")
      : `<tr><td colspan="8"><div class="dc-empty-state py-4"><p class="small mb-0">Aucun ticket pour ces filtres.</p></div></td></tr>`;
  }

  function staffOptionsForService(service) {
    return staffList
      .filter((s) => canManageAll || s.department === service || s.id === ctx.staff.id)
      .map((s) => {
        const u = users.find((x) => x.id === s.userId);
        return `<option value="${s.id}">${u.firstName} ${u.lastName} — ${s.position}</option>`;
      }).join("");
  }

  function openDetail(id) {
    const t = tickets.find((x) => x.id === id);
    if (!t) return;
    document.getElementById("detailModalLabel").textContent = `${t.id} — ${t.requesterName}`;
    document.getElementById("detailModalBody").innerHTML = `
      <div class="row g-3 mb-3 small">
        <div class="col-6"><strong>Email</strong><div class="text-muted-dc">${DCUtils.escapeHtml(t.requesterEmail)}</div></div>
        <div class="col-6"><strong>Rôle</strong><div class="text-muted-dc text-capitalize">${DCUtils.escapeHtml(t.requesterRole)}</div></div>
        <div class="col-6"><strong>Catégorie</strong><div class="text-muted-dc">${TicketHelpers.categoryLabel(t.category)}</div></div>
        <div class="col-6"><strong>Canal</strong><div class="text-muted-dc text-capitalize">${DCUtils.escapeHtml(t.channel.replace(/_/g, " "))}</div></div>
      </div>
      <div class="row g-2 mb-3">
        <div class="col-md-4">
          <label class="form-label small">Priorité</label>
          <select class="form-select form-select-sm" id="detail-priority">
            ${["basse", "normale", "haute", "urgente"].map((p) => `<option value="${p}" ${t.priority === p ? "selected" : ""}>${p}</option>`).join("")}
          </select>
        </div>
        <div class="col-md-4">
          <label class="form-label small">Statut</label>
          <select class="form-select form-select-sm" id="detail-status">
            ${["nouveau", "en_cours", "en_attente_reponse", "resolu", "ferme"].map((s) => `<option value="${s}" ${t.status === s ? "selected" : ""}>${s.replace(/_/g, " ")}</option>`).join("")}
          </select>
        </div>
        <div class="col-md-4">
          <label class="form-label small">Assigné à</label>
          <select class="form-select form-select-sm" id="detail-assignee">
            <option value="">Non assigné</option>
            ${staffOptionsForService(t.targetService)}
          </select>
        </div>
      </div>
      <h6 class="small">Historique</h6>
      <ol class="dc-timeline mb-3" id="detail-history"></ol>
      <h6 class="small">Notes internes</h6>
      <div id="detail-notes" class="mb-2"></div>
      <div class="input-group input-group-sm mb-3">
        <input type="text" class="form-control" id="new-note-input" placeholder="Ajouter une note interne...">
        <button class="btn btn-outline-secondary" id="add-note-btn" type="button">Ajouter</button>
      </div>
      <label class="form-label small">Réponse envoyée au demandeur</label>
      <textarea class="form-control form-control-sm mb-3" id="detail-response" rows="2">${DCUtils.escapeHtml(t.responseText || "")}</textarea>
    `;
    document.getElementById("detail-history").innerHTML = t.history.map((h) => `
      <li class="is-done"><span class="dc-timeline-dot"></span>${DCUtils.statusBadge(h.status)} <span class="small">${DCUtils.escapeHtml(h.note)}</span><div class="dc-timeline-date">${DCUtils.formatDateTime(h.date)}</div></li>`).join("");
    document.getElementById("detail-notes").innerHTML = t.internalNotes.length
      ? t.internalNotes.map((n) => `<div class="small border-bottom py-1"><span class="text-muted-dc">${DCUtils.formatDateTime(n.date)}</span> — ${DCUtils.escapeHtml(n.note)}</div>`).join("")
      : `<p class="small text-muted-dc">Aucune note interne.</p>`;

    document.getElementById("detail-assignee").value = t.assignedTo || "";
    document.getElementById("save-ticket-btn").dataset.id = t.id;
    new bootstrap.Modal(document.getElementById("detailModal")).show();
  }

  async function saveTicket(id) {
    const t = tickets.find((x) => x.id === id);
    const newStatus = document.getElementById("detail-status").value;
    const newPriority = document.getElementById("detail-priority").value;
    const newAssignee = document.getElementById("detail-assignee").value || null;
    const responseText = document.getElementById("detail-response").value.trim();
    const now = new Date().toISOString();

    if (newStatus !== t.status) {
      t.history.push({ date: now, status: newStatus, note: `Statut changé en "${newStatus.replace(/_/g, " ")}" par ${ctx.staff.position}.`, byStaffId: ctx.staff.id });
      if (["resolu", "ferme"].includes(newStatus)) t.closedAt = now;
    }
    if (newAssignee !== t.assignedTo) {
      t.history.push({ date: now, status: t.status, note: `Ticket réassigné.`, byStaffId: ctx.staff.id });
      await DataStore.insert("auditLog", {
        id: DataStore.nextId("audit"), actorId: ctx.staff.id, actorName: `${ctx.user.firstName} ${ctx.user.lastName}`,
        action: "assignation_ticket", targetType: "ticket", targetId: t.id, date: now, details: `Ticket assigné.`,
      });
    }
    t.status = newStatus;
    t.priority = newPriority;
    t.assignedTo = newAssignee;
    if (responseText && responseText !== t.responseText) {
      t.responseText = responseText;
      t.responseSent = true;
    }

    bootstrap.Modal.getInstance(document.getElementById("detailModal")).hide();
    DCUtils.toast("Ticket mis à jour.", "success");
    applyFilters();
  }

  async function init() {
    ctx = await StaffGuard.require("tickets-management");
    if (!ctx) return;
    await Layout.mountStaffApp("tickets-management", ctx);

    [tickets, staffList, users] = await Promise.all([DataStore.getTickets(), DataStore.getStaff(), DataStore.getUsers()]);
    canManageAll = await Permissions.canManageAllTickets(ctx.staff.accessLevel);

    if (!canManageAll) {
      document.getElementById("scope-banner").classList.remove("d-none");
    }

    render(visibleTickets());

    document.getElementById("filters-form").addEventListener("input", DCUtils.debounce(applyFilters, 150));
    document.getElementById("tickets-tbody").addEventListener("click", (e) => {
      const tr = e.target.closest("tr[data-id]");
      if (tr) openDetail(tr.dataset.id);
    });
    document.getElementById("add-note-btn").addEventListener("click", () => {
      const input = document.getElementById("new-note-input");
      const text = input.value.trim();
      if (!text) return;
      const id = document.getElementById("save-ticket-btn").dataset.id;
      const t = tickets.find((x) => x.id === id);
      t.internalNotes.push({ date: new Date().toISOString(), byStaffId: ctx.staff.id, note: text });
      input.value = "";
      openDetail(id);
    });
    document.getElementById("save-ticket-btn").addEventListener("click", () => saveTicket(document.getElementById("save-ticket-btn").dataset.id));

    const params = new URLSearchParams(window.location.search);
    const preselect = params.get("id");
    if (preselect && tickets.some((t) => t.id === preselect)) openDetail(preselect);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
