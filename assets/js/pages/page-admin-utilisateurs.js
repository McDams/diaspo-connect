/**
 * Gestion des utilisateurs (admin) : tableau complet, filtres par rôle et
 * statut, création manuelle, édition complète, changement de rôle,
 * suspension de compte, détail utilisateur avec journal d'activité.
 */
(function () {
  let users, mentors, mentees, matchings, reports, adminUser;
  const DEMO_TODAY = new Date("2026-07-25T09:00:00");

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

  const ROLE_LABELS = { mentore: "Mentoré", mentor: "Mentor", proprietaire: "Propriétaire", admin: "Admin" };

  function isRecent(u) {
    return (DEMO_TODAY - new Date(u.createdAt)) / 86400000 <= 30;
  }

  function currentFilters() {
    return {
      q: DCUtils.qs("#f-recherche").value.trim(),
      role: DCUtils.qs("#f-role").value,
      status: DCUtils.qs("#f-status").value,
      verified: DCUtils.qs("#f-verified").value,
      recentOnly: DCUtils.qs("#f-recent").checked,
    };
  }

  function applyFilters() {
    const f = currentFilters();
    const results = users.filter((u) => (
      Filters.textMatch(`${u.firstName} ${u.lastName} ${u.email}`, f.q) &&
      Filters.selectMatch(u.role, f.role) &&
      Filters.selectMatch(u.status, f.status) &&
      (f.verified === "all" || String(u.verified) === f.verified) &&
      (!f.recentOnly || isRecent(u))
    ));
    render(results);
  }

  function row(u) {
    return `<tr>
      <td><div class="d-flex align-items-center gap-2">
        <span class="dc-avatar dc-avatar-sm" style="background:${u.avatarColor}">${u.avatarInitials}</span>
        <div><div class="fw-semibold small">${DCUtils.escapeHtml(u.firstName)} ${DCUtils.escapeHtml(u.lastName)} ${isRecent(u) ? '<span class="dc-badge dc-badge-info">Nouveau</span>' : ""}</div><div class="small text-muted-dc">${DCUtils.escapeHtml(u.email)}</div></div>
      </div></td>
      <td>${ROLE_LABELS[u.role] || u.role}</td>
      <td>${DCUtils.escapeHtml(u.city || "-")}</td>
      <td>${u.verified ? '<span class="dc-verified-badge"><i class="bi bi-patch-check-fill"></i>Vérifié</span>' : '<span class="small text-muted-dc">Non vérifié</span>'}</td>
      <td>${DCUtils.statusBadge(u.status)}</td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-secondary" data-action="view" data-id="${u.id}">Détail</button>
        <button class="btn btn-sm btn-outline-secondary" data-action="edit" data-id="${u.id}">Modifier</button>
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
    if (u.role === "mentore") {
      const mentee = mentees.find((m) => m.userId === u.id);
      if (mentee) extra = `<div class="row g-2 small mt-2">
        <div class="col-6"><strong>Ville souhaitée</strong><div class="text-muted-dc">${DCUtils.escapeHtml(mentee.desiredCity)}</div></div>
        <div class="col-6"><strong>Domaine</strong><div class="text-muted-dc">${DCUtils.escapeHtml(mentee.studyField)}</div></div>
        <div class="col-6"><strong>Dossier</strong><div>${DCUtils.fileStatusBadge(mentee.fileStatus)}</div></div>
        <div class="col-6"><strong>Complétude</strong><div class="text-muted-dc">${mentee.profileCompleteness}%${mentee.profileCompleteness < 70 ? ' <span class="dc-badge dc-badge-warning">Incomplet</span>' : ""}</div></div>
      </div>`;
    } else if (u.role === "mentor") {
      const mentor = mentors.find((m) => m.userId === u.id);
      if (mentor) extra = `<div class="row g-2 small mt-2">
        <div class="col-6"><strong>Ville</strong><div class="text-muted-dc">${DCUtils.escapeHtml(mentor.city)}</div></div>
        <div class="col-6"><strong>Mentorés actifs</strong><div class="text-muted-dc">${MatchingEngine.countActiveMentees(mentor.id, matchings)} / ${mentor.maxMentees}</div></div>
      </div>`;
    }
    DCUtils.qs("#detailModalLabel").textContent = `${u.firstName} ${u.lastName}`;
    DCUtils.qs("#detailModalBody").innerHTML = `
      <div class="d-flex gap-3 align-items-center mb-3">
        <span class="dc-avatar dc-avatar-lg" style="background:${u.avatarColor}">${u.avatarInitials}</span>
        <div><div class="fw-semibold">${DCUtils.escapeHtml(u.email)}</div><div class="small text-muted-dc">${ROLE_LABELS[u.role]} · ${DCUtils.escapeHtml(u.city || "-")}</div></div>
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

  const USER_FORM_SCHEMA = {
    firstName: [FormValidation.rules.required],
    lastName: [FormValidation.rules.required],
    email: [FormValidation.rules.required, FormValidation.rules.email],
    phone: [FormValidation.rules.phone],
  };

  function openUserForm(user) {
    const form = document.getElementById("user-form");
    form.reset();
    ["uf-firstname", "uf-lastname", "uf-email", "uf-phone"].forEach((id) => document.getElementById(id).classList.remove("is-invalid", "is-valid"));
    document.getElementById("uf-id").value = user?.id || "";
    document.getElementById("uf-firstname").value = user?.firstName || "";
    document.getElementById("uf-lastname").value = user?.lastName || "";
    document.getElementById("uf-email").value = user?.email || "";
    document.getElementById("uf-phone").value = user?.phone || "";
    document.getElementById("uf-city").value = user?.city || "";
    document.getElementById("uf-role").value = user?.role || "mentore";
    document.getElementById("uf-status").value = user?.status || "actif";
    document.getElementById("uf-verified").checked = !!user?.verified;
    document.getElementById("uf-status-field").classList.toggle("d-none", !user);
    document.getElementById("uf-verified-field").classList.toggle("d-none", !user);
    document.getElementById("uf-role-hint").textContent = user
      ? "Changer le rôle est tracé dans le journal d'audit. Les profils mentore/mentor/propriétaire associés devront être complétés séparément si le rôle change."
      : "Le profil détaillé (mentore/mentor/propriétaire) sera à compléter séparément après création du compte.";
    document.getElementById("userFormModalLabel").textContent = user ? "Modifier l'utilisateur" : "Nouvel utilisateur";
    new bootstrap.Modal(document.getElementById("userFormModal")).show();
  }

  async function submitUserForm(e) {
    e.preventDefault();
    if (!FormValidation.validateForm(e.target, USER_FORM_SCHEMA)) return;

    const id = document.getElementById("uf-id").value;
    const firstName = document.getElementById("uf-firstname").value.trim();
    const lastName = document.getElementById("uf-lastname").value.trim();
    const email = document.getElementById("uf-email").value.trim();
    const phone = document.getElementById("uf-phone").value.trim();
    const city = document.getElementById("uf-city").value.trim();
    const role = document.getElementById("uf-role").value;

    if (id) {
      const user = users.find((u) => u.id === id);
      const roleChanged = user.role !== role;
      Object.assign(user, {
        firstName, lastName, email, phone, city, role,
        status: document.getElementById("uf-status").value,
        verified: document.getElementById("uf-verified").checked,
      });
      await DataStore.insert("auditLog", {
        id: DataStore.nextId("audit"), actorId: adminUser.id, actorName: `${adminUser.firstName} ${adminUser.lastName}`,
        action: roleChanged ? "changement_role" : "modification_utilisateur", targetType: "user", targetId: user.id,
        date: new Date().toISOString(),
        details: roleChanged
          ? `Rôle de ${firstName} ${lastName} changé vers « ${ROLE_LABELS[role]} » par l'administration.`
          : `Fiche de ${firstName} ${lastName} modifiée par l'administration.`,
      });
      DCUtils.toast("Utilisateur mis à jour.", "success");
    } else {
      const initials = `${firstName[0] || ""}${lastName[0] || ""}`.toUpperCase();
      const newUser = {
        id: DataStore.nextId("u"), role, firstName, lastName, email, phone, city,
        status: "actif", verified: false, avatarInitials: initials, avatarColor: DCUtils.initialsColor(email || firstName),
        createdAt: new Date().toISOString(), lastLoginAt: null,
      };
      await DataStore.insert("users", newUser);
      await DataStore.insert("auditLog", {
        id: DataStore.nextId("audit"), actorId: adminUser.id, actorName: `${adminUser.firstName} ${adminUser.lastName}`,
        action: "creation_utilisateur", targetType: "user", targetId: newUser.id,
        date: new Date().toISOString(), details: `Compte ${firstName} ${lastName} (${ROLE_LABELS[role]}) créé manuellement par l'administration.`,
      });
      DCUtils.toast("Utilisateur créé.", "success");
    }
    bootstrap.Modal.getInstance(document.getElementById("userFormModal")).hide();
    applyFilters();
  }

  async function init() {
    adminUser = await Auth.guard(["admin"]);
    if (!adminUser) return;
    await Layout.mountApp("admin", "utilisateurs", adminUser);

    [users, mentors, mentees, matchings, reports] = await Promise.all([
      DataStore.getUsers(), DataStore.getMentors(), DataStore.getMentees(), DataStore.getMatchings(), DataStore.getReports(),
    ]);
    render(users);

    document.getElementById("filters-form").addEventListener("input", DCUtils.debounce(applyFilters, 150));
    document.getElementById("filters-form").addEventListener("change", applyFilters);
    document.getElementById("new-user-btn").addEventListener("click", () => openUserForm(null));
    document.getElementById("user-form").addEventListener("submit", submitUserForm);

    document.getElementById("users-tbody").addEventListener("click", (e) => {
      const viewBtn = e.target.closest("button[data-action='view']");
      const editBtn = e.target.closest("button[data-action='edit']");
      const suspendBtn = e.target.closest("button[data-action='suspend']");
      const reactivateBtn = e.target.closest("button[data-action='reactivate']");
      if (viewBtn) openDetail(viewBtn.dataset.id);
      if (editBtn) openUserForm(users.find((u) => u.id === editBtn.dataset.id));
      if (suspendBtn) {
        ConfirmModal.open({
          title: "Suspendre ce compte",
          body: "L'utilisateur ne pourra plus se connecter tant que le compte est suspendu. Confirmez-vous ?",
          confirmLabel: "Suspendre",
          onConfirm: async () => {
            const target = users.find((u) => u.id === suspendBtn.dataset.id);
            await DataStore.update("users", suspendBtn.dataset.id, { status: "suspendu" });
            await DataStore.insert("auditLog", {
              id: DataStore.nextId("audit"), actorId: adminUser.id, actorName: `${adminUser.firstName} ${adminUser.lastName}`,
              action: "suspension_compte", targetType: "user", targetId: target.id, date: new Date().toISOString(),
              details: `Compte ${target.firstName} ${target.lastName} (${target.role}) suspendu par l'administration.`,
            });
            DCUtils.toast("Compte suspendu.", "success");
            applyFilters();
          },
        });
      }
      if (reactivateBtn) {
        const target = users.find((u) => u.id === reactivateBtn.dataset.id);
        DataStore.update("users", reactivateBtn.dataset.id, { status: "actif" }).then(async () => {
          await DataStore.insert("auditLog", {
            id: DataStore.nextId("audit"), actorId: adminUser.id, actorName: `${adminUser.firstName} ${adminUser.lastName}`,
            action: "reactivation_compte", targetType: "user", targetId: target.id, date: new Date().toISOString(),
            details: `Compte ${target.firstName} ${target.lastName} (${target.role}) réactivé par l'administration.`,
          });
          DCUtils.toast("Compte réactivé.", "success");
          applyFilters();
        });
      }
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
