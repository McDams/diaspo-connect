/**
 * Gestion des utilisateurs (admin) : tableau complet, filtres par rôle et
 * statut, suspension de compte, détail utilisateur en modal.
 */
(function () {
  let users, mentors, mentees, matchings, reports;

  function buildActivityLog(u) {
    const events = [
      { date: u.createdAt, label: "Compte créé" },
      { date: u.lastLoginAt, label: "Dernière connexion" },
    ];
    matchings.forEach((m) => {
      const mentee = mentees.find((x) => x.id === m.menteeId);
      const mentor = mentors.find((x) => x.id === m.mentorId);
      if (mentee?.userId === u.id || mentor?.userId === u.id) {
        m.statusHistory.forEach((h) => events.push({ date: h.date, label: `Matching : ${h.note}` }));
      }
    });
    reports.filter((r) => r.reporterId === u.id || r.targetId === u.id).forEach((r) => {
      events.push({ date: r.createdAt, label: `Signalement (${r.reason.replace(/_/g, " ")}) — ${r.status}` });
    });
    return events.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8);
  }

  const ROLE_LABELS = { filleul: "Filleul", parrain: "Parrain/Marraine", proprietaire: "Propriétaire", admin: "Admin" };

  function currentFilters() {
    return {
      q: DCUtils.qs("#f-recherche").value.trim(),
      role: DCUtils.qs("#f-role").value,
      status: DCUtils.qs("#f-status").value,
      verified: DCUtils.qs("#f-verified").value,
    };
  }

  function applyFilters() {
    const f = currentFilters();
    const results = users.filter((u) => (
      Filters.textMatch(`${u.firstName} ${u.lastName} ${u.email}`, f.q) &&
      Filters.selectMatch(u.role, f.role) &&
      Filters.selectMatch(u.status, f.status) &&
      (f.verified === "all" || String(u.verified) === f.verified)
    ));
    render(results);
  }

  function row(u) {
    return `<tr>
      <td><div class="d-flex align-items-center gap-2">
        <span class="dc-avatar dc-avatar-sm" style="background:${u.avatarColor}">${u.avatarInitials}</span>
        <div><div class="fw-semibold small">${DCUtils.escapeHtml(u.firstName)} ${DCUtils.escapeHtml(u.lastName)}</div><div class="small text-muted-dc">${DCUtils.escapeHtml(u.email)}</div></div>
      </div></td>
      <td>${ROLE_LABELS[u.role] || u.role}</td>
      <td>${DCUtils.escapeHtml(u.city)}</td>
      <td>${u.verified ? '<span class="dc-verified-badge"><i class="bi bi-patch-check-fill"></i>Vérifié</span>' : '<span class="small text-muted-dc">Non vérifié</span>'}</td>
      <td>${DCUtils.statusBadge(u.status)}</td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-secondary" data-action="view" data-id="${u.id}">Détail</button>
        ${u.status === "actif"
          ? `<button class="btn btn-sm btn-outline-danger" data-action="suspend" data-id="${u.id}">Suspendre</button>`
          : `<button class="btn btn-sm btn-outline-success" data-action="reactivate" data-id="${u.id}">Réactiver</button>`}
      </td>
    </tr>`;
  }

  function render(results) {
    document.getElementById("results-count").textContent = `${results.length} utilisateur${results.length > 1 ? "s" : ""}`;
    document.getElementById("users-tbody").innerHTML = results.length
      ? results.map(row).join("")
      : `<tr><td colspan="6"><div class="dc-empty-state py-4"><p class="small mb-0">Aucun utilisateur ne correspond à ces filtres.</p></div></td></tr>`;
  }

  function openDetail(id) {
    const u = users.find((x) => x.id === id);
    let extra = "";
    if (u.role === "filleul") {
      const mentee = mentees.find((m) => m.userId === u.id);
      if (mentee) extra = `<div class="row g-2 small mt-2">
        <div class="col-6"><strong>Ville souhaitée</strong><div class="text-muted-dc">${DCUtils.escapeHtml(mentee.desiredCity)}</div></div>
        <div class="col-6"><strong>Domaine</strong><div class="text-muted-dc">${DCUtils.escapeHtml(mentee.studyField)}</div></div>
        <div class="col-6"><strong>Dossier</strong><div>${DCUtils.fileStatusBadge(mentee.fileStatus)}</div></div>
        <div class="col-6"><strong>Complétude</strong><div class="text-muted-dc">${mentee.profileCompleteness}%</div></div>
      </div>`;
    } else if (u.role === "parrain") {
      const mentor = mentors.find((m) => m.userId === u.id);
      if (mentor) extra = `<div class="row g-2 small mt-2">
        <div class="col-6"><strong>Ville</strong><div class="text-muted-dc">${DCUtils.escapeHtml(mentor.city)}</div></div>
        <div class="col-6"><strong>Filleuls actifs</strong><div class="text-muted-dc">${MatchingEngine.countActiveMentees(mentor.id, matchings)} / ${mentor.maxMentees}</div></div>
      </div>`;
    }
    DCUtils.qs("#detailModalLabel").textContent = `${u.firstName} ${u.lastName}`;
    DCUtils.qs("#detailModalBody").innerHTML = `
      <div class="d-flex gap-3 align-items-center mb-3">
        <span class="dc-avatar dc-avatar-lg" style="background:${u.avatarColor}">${u.avatarInitials}</span>
        <div><div class="fw-semibold">${DCUtils.escapeHtml(u.email)}</div><div class="small text-muted-dc">${ROLE_LABELS[u.role]} · ${DCUtils.escapeHtml(u.city)}</div></div>
      </div>
      <div class="row g-2 small">
        <div class="col-6"><strong>Statut</strong><div>${DCUtils.statusBadge(u.status)}</div></div>
        <div class="col-6"><strong>Vérification</strong><div>${u.verified ? "Vérifié" : "Non vérifié"}</div></div>
        <div class="col-6"><strong>Inscrit le</strong><div class="text-muted-dc">${DCUtils.formatDate(u.createdAt)}</div></div>
        <div class="col-6"><strong>Dernière connexion</strong><div class="text-muted-dc">${DCUtils.formatDateTime(u.lastLoginAt)}</div></div>
      </div>
      ${extra}
      <hr>
      <strong class="small d-block mb-2"><i class="bi bi-clock-history me-1"></i>Journal d'activité</strong>
      <ul class="list-unstyled small mb-0">
        ${buildActivityLog(u).map((ev) => `<li class="mb-1"><span class="text-muted-dc">${DCUtils.formatDateTime(ev.date)}</span> — ${DCUtils.escapeHtml(ev.label)}</li>`).join("")}
      </ul>
    `;
    new bootstrap.Modal(document.getElementById("detailModal")).show();
  }

  async function init() {
    const admin = await Auth.guard(["admin"]);
    if (!admin) return;
    await Layout.mountApp("admin", "utilisateurs", admin);

    [users, mentors, mentees, matchings, reports] = await Promise.all([
      DataStore.getUsers(), DataStore.getMentors(), DataStore.getMentees(), DataStore.getMatchings(), DataStore.getReports(),
    ]);
    render(users);

    document.getElementById("filters-form").addEventListener("input", DCUtils.debounce(applyFilters, 150));
    document.getElementById("users-tbody").addEventListener("click", (e) => {
      const viewBtn = e.target.closest("button[data-action='view']");
      const suspendBtn = e.target.closest("button[data-action='suspend']");
      const reactivateBtn = e.target.closest("button[data-action='reactivate']");
      if (viewBtn) openDetail(viewBtn.dataset.id);
      if (suspendBtn) {
        ConfirmModal.open({
          title: "Suspendre ce compte",
          body: "L'utilisateur ne pourra plus se connecter tant que le compte est suspendu. Confirmez-vous ?",
          confirmLabel: "Suspendre",
          onConfirm: async () => {
            await DataStore.update("users", suspendBtn.dataset.id, { status: "suspendu" });
            DCUtils.toast("Compte suspendu.", "success");
            applyFilters();
          },
        });
      }
      if (reactivateBtn) {
        DataStore.update("users", reactivateBtn.dataset.id, { status: "actif" }).then(() => {
          DCUtils.toast("Compte réactivé.", "success");
          applyFilters();
        });
      }
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
