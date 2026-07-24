(function () {
  async function init() {
    const ctx = await StaffGuard.require("moderation-dashboard");
    if (!ctx) return;
    await Layout.mountStaffApp("moderation-dashboard", ctx);
    document.getElementById("welcome-name").textContent = ctx.user.firstName;

    const [reports, messages, users, mentors] = await Promise.all([
      DataStore.getReports(), DataStore.getMessages(), DataStore.getUsers(), DataStore.getMentors(),
    ]);

    const openReports = reports.filter((r) => r.status === "ouvert" || r.status === "en_cours");
    document.getElementById("kpi-open-reports").textContent = openReports.length;
    const flagged = messages.flatMap((c) => c.messages.filter((m) => m.flagged).map((m) => ({ ...m, conv: c })));
    document.getElementById("kpi-flagged-messages").textContent = flagged.length;
    const toReview = users.filter((u) => (u.role === "parrain" || u.role === "proprietaire") && !u.verified);
    document.getElementById("kpi-to-review").textContent = toReview.length;
    const decided = reports.filter((r) => r.status === "resolu" || r.status === "rejete");
    document.getElementById("kpi-decided").textContent = decided.length;

    document.getElementById("reports-list").innerHTML = openReports.length ? openReports.map((r) => {
      const reporter = users.find((u) => u.id === r.reporterId);
      return `<div class="d-flex justify-content-between align-items-start py-2 border-bottom">
        <div>
          <span class="dc-badge dc-badge-danger text-capitalize">${DCUtils.escapeHtml(r.reason.replace(/_/g, " "))}</span>
          <div class="small mt-1">${DCUtils.escapeHtml(r.description).slice(0, 90)}…</div>
          <div class="small text-muted-dc">Par ${DCUtils.escapeHtml(reporter?.firstName)} ${DCUtils.escapeHtml(reporter?.lastName)} · ${DCUtils.timeAgo(r.createdAt)}</div>
        </div>
        ${DCUtils.statusBadge(r.status)}
      </div>`;
    }).join("") : `<div class="dc-empty-state py-3"><p class="small mb-0">Aucun signalement ouvert.</p></div>`;

    document.getElementById("flagged-messages-list").innerHTML = flagged.length ? flagged.map((m) => {
      const sender = users.find((u) => u.id === m.senderId);
      return `<div class="py-2 border-bottom">
        <div class="dc-bubble dc-bubble-in dc-bubble-flagged small mb-1">${DCUtils.escapeHtml(m.text)}</div>
        <div class="small text-muted-dc">${DCUtils.escapeHtml(sender?.firstName)} ${DCUtils.escapeHtml(sender?.lastName)} · ${DCUtils.formatDateTime(m.sentAt)}</div>
      </div>`;
    }).join("") : `<div class="dc-empty-state py-3"><p class="small mb-0">Aucun message signalé.</p></div>`;

    document.getElementById("accounts-review-list").innerHTML = toReview.length ? toReview.map((u) => `
      <div class="d-flex align-items-center gap-2 py-2 border-bottom">
        <span class="dc-avatar dc-avatar-sm" style="background:${u.avatarColor}">${u.avatarInitials}</span>
        <div class="flex-grow-1"><div class="small fw-semibold">${DCUtils.escapeHtml(u.firstName)} ${DCUtils.escapeHtml(u.lastName)}</div><div class="small text-muted-dc text-capitalize">${u.role}</div></div>
        <span class="dc-badge dc-badge-warning">Non vérifié</span>
      </div>`).join("") : `<div class="dc-empty-state py-3"><p class="small mb-0">Aucun compte en attente de vérification.</p></div>`;

    document.getElementById("decisions-list").innerHTML = decided.length ? decided.slice(0, 5).map((r) => `
      <div class="d-flex justify-content-between align-items-center py-2 border-bottom">
        <div><span class="small">${DCUtils.escapeHtml(r.reason.replace(/_/g, " "))}</span><div class="small text-muted-dc">${DCUtils.escapeHtml(r.adminNote || "")}</div></div>
        ${DCUtils.statusBadge(r.status)}
      </div>`).join("") : `<div class="dc-empty-state py-3"><p class="small mb-0">Aucune décision récente.</p></div>`;
  }

  document.addEventListener("DOMContentLoaded", init);
})();
