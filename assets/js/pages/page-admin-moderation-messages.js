/**
 * Modération de la messagerie : liste des signalements (tous types), avec
 * lecture du message signalé en contexte lorsque targetType === "message",
 * et actions de résolution admin.
 */
(function () {
  let reports, users, messages;

  function currentFilters() {
    return { status: DCUtils.qs("#f-status").value, reason: DCUtils.qs("#f-reason").value };
  }

  function applyFilters() {
    const f = currentFilters();
    render(reports.filter((r) => Filters.selectMatch(r.status, f.status) && Filters.selectMatch(r.reason, f.reason)));
  }

  function messageContext(report) {
    if (report.targetType !== "message") return "";
    const conv = messages.find((c) => c.id === report.conversationId);
    const msg = conv?.messages.find((m) => m.id === report.targetId);
    if (!msg) return "";
    const sender = users.find((u) => u.id === msg.senderId);
    return `<div class="dc-bubble dc-bubble-in dc-bubble-flagged mt-2 mb-1">${DCUtils.escapeHtml(msg.text)}</div>
      <div class="small text-muted-dc">Envoyé par ${DCUtils.escapeHtml(sender?.firstName)} ${DCUtils.escapeHtml(sender?.lastName)} · ${DCUtils.formatDateTime(msg.sentAt)}</div>`;
  }

  function card(r) {
    const reporter = users.find((u) => u.id === r.reporterId);
    return `<div class="dc-card p-3 mb-3">
      <div class="d-flex justify-content-between flex-wrap gap-2 mb-2">
        <div>
          <span class="dc-badge dc-badge-danger text-capitalize">${DCUtils.escapeHtml(r.reason.replace(/_/g, " "))}</span>
          <span class="small text-muted-dc ms-2">Signalé par ${DCUtils.escapeHtml(reporter?.firstName)} ${DCUtils.escapeHtml(reporter?.lastName)} · ${DCUtils.timeAgo(r.createdAt)}</span>
        </div>
        ${DCUtils.statusBadge(r.status)}
      </div>
      <p class="small mb-1">${DCUtils.escapeHtml(r.description)}</p>
      ${messageContext(r)}
      ${r.adminNote ? `<div class="dc-banner dc-banner-info mt-2"><i class="bi bi-info-circle"></i><span>Note admin : ${DCUtils.escapeHtml(r.adminNote)}</span></div>` : ""}
      ${r.status === "ouvert" || r.status === "en_cours" ? `
        <div class="d-flex gap-2 mt-3">
          <button class="btn btn-sm btn-success" data-action="resolve" data-id="${r.id}"><i class="bi bi-check2 me-1"></i>Marquer résolu</button>
          <button class="btn btn-sm btn-outline-secondary" data-action="reject" data-id="${r.id}">Rejeter le signalement</button>
        </div>` : ""}
    </div>`;
  }

  function render(list) {
    document.getElementById("results-count").textContent = `${list.length} signalement${list.length > 1 ? "s" : ""}`;
    const host = document.getElementById("reports-list");
    host.innerHTML = list.length ? list.map(card).join("") : `
      <div class="dc-empty-state"><div class="dc-empty-icon mx-auto"><i class="bi bi-flag"></i></div><h6>Aucun signalement</h6></div>`;
  }

  async function init() {
    const admin = await Auth.guard(["admin"]);
    if (!admin) return;
    await Layout.mountApp("admin", "moderation-messages", admin);

    [reports, users, messages] = await Promise.all([DataStore.getReports(), DataStore.getUsers(), DataStore.getMessages()]);
    render(reports);

    document.getElementById("filters-form").addEventListener("input", applyFilters);
    document.getElementById("reports-list").addEventListener("click", async (e) => {
      const resolveBtn = e.target.closest("button[data-action='resolve']");
      const rejectBtn = e.target.closest("button[data-action='reject']");
      const btn = resolveBtn || rejectBtn;
      if (!btn) return;
      const report = reports.find((r) => r.id === btn.dataset.id);
      const previousStatus = report.status;
      report.status = resolveBtn ? "resolu" : "rejete";
      report.adminNote = resolveBtn ? "Signalement traité, mesures appliquées si nécessaire." : "Signalement examiné, aucune action requise.";
      await AuditLog.record({
        actor: { id: admin.id, label: `${admin.firstName} ${admin.lastName}`, role: admin.role }, module: "moderation",
        action: resolveBtn ? "resolution_signalement" : "rejet_signalement", targetType: "report", targetId: report.id,
        before: { status: previousStatus }, after: { status: report.status }, details: report.adminNote,
      });
      DCUtils.toast("Signalement mis à jour.", "success");
      applyFilters();
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
