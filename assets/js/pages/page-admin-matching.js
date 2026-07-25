/**
 * Supervision des matchings (admin) : vue globale, charge des mentors,
 * matching manuel, réassignation de dossier, suspension/fin de binôme
 * avec motif tracé, et historique complet par binôme.
 */
(function () {
  let matchings, mentees, mentors, users, adminUser;

  function menteeUser(mentee) { return users.find((u) => u.id === mentee.userId); }
  function mentorUser(mentor) { return users.find((u) => u.id === mentor.userId); }
  function menteeLabel(mentee) { const u = menteeUser(mentee); return u ? `${u.firstName} ${u.lastName}` : mentee.id; }
  function mentorLabel(mentor) { const u = mentorUser(mentor); return u ? `${u.firstName} ${u.lastName}` : mentor.id; }

  function currentFilters() {
    return { status: DCUtils.qs("#f-status").value };
  }

  function applyFilters() {
    const f = currentFilters();
    render(matchings.filter((m) => Filters.selectMatch(m.status, f.status)));
  }

  function row(m) {
    const mentee = mentees.find((x) => x.id === m.menteeId);
    const mentor = mentors.find((x) => x.id === m.mentorId);
    return `<tr>
      <td>${DCUtils.escapeHtml(menteeLabel(mentee))}</td>
      <td>${DCUtils.escapeHtml(mentorLabel(mentor))}</td>
      <td>${m.compatibilityScore}%</td>
      <td>${DCUtils.statusBadge(m.status)}</td>
      <td>${DCUtils.formatDate(m.requestedAt)}</td>
      <td class="text-end"><button class="btn btn-sm btn-outline-secondary" data-action="detail" data-id="${m.id}">Détail</button></td>
    </tr>`;
  }

  function render(list) {
    document.getElementById("results-count").textContent = `${list.length} binôme${list.length > 1 ? "s" : ""}`;
    document.getElementById("matchings-tbody").innerHTML = list.length
      ? list.map(row).join("")
      : `<tr><td colspan="6"><div class="dc-empty-state py-4"><p class="small mb-0">Aucun binôme pour ce filtre.</p></div></td></tr>`;
  }

  function renderMentorLoad() {
    const host = document.getElementById("mentor-load");
    host.innerHTML = mentors.map((m) => {
      const count = MatchingEngine.countActiveMentees(m.id, matchings);
      const u = mentorUser(m);
      const overloaded = count >= m.maxMentees;
      return `<div class="d-flex align-items-center gap-2 py-2 border-bottom">
        <span class="dc-avatar dc-avatar-sm" style="background:${u.avatarColor}">${u.avatarInitials}</span>
        <div class="flex-grow-1">
          <div class="small fw-semibold">${DCUtils.escapeHtml(u.firstName)} ${DCUtils.escapeHtml(u.lastName)}</div>
          <div class="progress" style="height:6px;"><div class="progress-bar ${overloaded ? "bg-danger" : "bg-primary"}" style="width:${Math.min(100, (count / m.maxMentees) * 100)}%"></div></div>
        </div>
        <span class="small ${overloaded ? "text-danger fw-semibold" : "text-muted-dc"}">${count}/${m.maxMentees}</span>
      </div>`;
    }).join("");
  }

  // --- Détail / historique ---------------------------------------------

  function openDetail(id) {
    const m = matchings.find((x) => x.id === id);
    const mentee = mentees.find((x) => x.id === m.menteeId);
    const mentor = mentors.find((x) => x.id === m.mentorId);
    document.getElementById("detailModalLabel").textContent = `${menteeLabel(mentee)} ↔ ${mentorLabel(mentor)}`;

    const actions = [];
    if (["validee", "active"].includes(m.status)) {
      actions.push(`<button class="btn btn-sm btn-outline-warning" data-detail-action="suspend">Suspendre</button>`);
      actions.push(`<button class="btn btn-sm btn-outline-secondary" data-detail-action="reassign">Réassigner à un autre mentor</button>`);
    }
    if (m.status === "suspendue") {
      actions.push(`<button class="btn btn-sm btn-outline-success" data-detail-action="reactivate">Réactiver</button>`);
    }
    if (["validee", "active", "suspendue"].includes(m.status)) {
      actions.push(`<button class="btn btn-sm btn-outline-danger" data-detail-action="terminate">Mettre fin à l'accompagnement</button>`);
    }

    document.getElementById("detailModalBody").innerHTML = `
      <div class="row g-2 small mb-3">
        <div class="col-6"><strong>Score de compatibilité</strong><div class="text-muted-dc">${m.compatibilityScore}%</div></div>
        <div class="col-6"><strong>Statut actuel</strong><div>${DCUtils.statusBadge(m.status)}</div></div>
        <div class="col-6"><strong>Demandé le</strong><div class="text-muted-dc">${DCUtils.formatDateTime(m.requestedAt)}</div></div>
        <div class="col-6"><strong>Répondu le</strong><div class="text-muted-dc">${m.respondedAt ? DCUtils.formatDateTime(m.respondedAt) : "-"}</div></div>
        ${m.endReason ? `<div class="col-12"><strong>Motif de fin</strong><div class="text-muted-dc">${DCUtils.escapeHtml(m.endReason)}</div></div>` : ""}
      </div>
      ${actions.length ? `<div class="d-flex flex-wrap gap-2 mb-3">${actions.join("")}</div>` : ""}
      <hr>
      <strong class="small d-block mb-2"><i class="bi bi-clock-history me-1"></i>Historique du binôme</strong>
      <ol class="dc-timeline dc-timeline-compact mb-0">
        ${(m.statusHistory || []).map((h) => `<li class="is-done"><span class="dc-timeline-dot"></span><strong>${DCUtils.escapeHtml(h.status.replace(/_/g, " "))}</strong> — ${DCUtils.escapeHtml(h.note || "")}<div class="dc-timeline-date">${DCUtils.formatDateTime(h.date)}</div></li>`).join("") || "<p class='dc-empty-mini'>Aucun historique.</p>"}
      </ol>
    `;

    const modal = new bootstrap.Modal(document.getElementById("detailModal"));
    modal.show();

    document.getElementById("detailModalBody").querySelectorAll("[data-detail-action]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const action = btn.dataset.detailAction;
        modal.hide();
        if (action === "suspend") openReasonModal(m.id, "suspendue", "Suspendre l'accompagnement");
        else if (action === "terminate") openReasonModal(m.id, "terminee", "Mettre fin à l'accompagnement");
        else if (action === "reactivate") reactivate(m.id);
        else if (action === "reassign") openManualModal({ reassignOf: m.id, menteeId: m.menteeId });
      });
    });
  }

  function pushHistory(matching, status, note) {
    matching.statusHistory = matching.statusHistory || [];
    matching.statusHistory.push({ status, date: new Date().toISOString(), note });
  }

  async function reactivate(matchingId) {
    const m = matchings.find((x) => x.id === matchingId);
    const previousStatus = m.status;
    m.status = "active";
    pushHistory(m, "active", "Accompagnement réactivé par l'administration.");
    await AuditLog.record({
      actor: { id: adminUser.id, label: `${adminUser.firstName} ${adminUser.lastName}`, role: adminUser.role }, module: "mentorship",
      action: "reactivation_matching", targetType: "matching", targetId: m.id,
      before: { status: previousStatus }, after: { status: "active" },
      details: `Binôme ${m.id} réactivé par l'administration.`,
    });
    DCUtils.toast("Accompagnement réactivé.", "success");
    applyFilters(); renderMentorLoad();
  }

  // --- Suspension / fin avec motif --------------------------------------

  function openReasonModal(matchingId, targetStatus, title) {
    document.getElementById("reasonModalLabel").textContent = title;
    document.getElementById("reason-matching-id").value = matchingId;
    document.getElementById("reason-target-status").value = targetStatus;
    document.getElementById("reason-text").value = "";
    document.getElementById("reason-text").classList.remove("is-invalid", "is-valid");
    new bootstrap.Modal(document.getElementById("reasonModal")).show();
  }

  async function submitReason() {
    const matchingId = document.getElementById("reason-matching-id").value;
    const targetStatus = document.getElementById("reason-target-status").value;
    const reason = document.getElementById("reason-text").value.trim();
    const m = matchings.find((x) => x.id === matchingId);
    const previousStatus = m.status;
    m.status = targetStatus;
    if (targetStatus === "terminee") m.endReason = reason;
    pushHistory(m, targetStatus, reason);
    await AuditLog.record({
      actor: { id: adminUser.id, label: `${adminUser.firstName} ${adminUser.lastName}`, role: adminUser.role }, module: "mentorship",
      action: targetStatus === "terminee" ? "fin_matching" : "suspension_matching", targetType: "matching", targetId: m.id,
      before: { status: previousStatus }, after: { status: targetStatus }, details: `Binôme ${m.id} ${targetStatus === "terminee" ? "terminé" : "suspendu"} — ${reason}`,
    });
    bootstrap.Modal.getInstance(document.getElementById("reasonModal")).hide();
    DCUtils.toast(targetStatus === "terminee" ? "Accompagnement terminé." : "Accompagnement suspendu.", "success");
    applyFilters(); renderMentorLoad();
  }

  // --- Matching manuel / réassignation ----------------------------------

  function eligibleMenteesForNewMatch() {
    return mentees.filter((mt) => {
      const active = matchings.find((m) => m.menteeId === mt.id && ["en_attente", "validee", "active"].includes(m.status));
      return !active;
    });
  }

  function openManualModal({ reassignOf = null, menteeId = null } = {}) {
    const menteeSelect = document.getElementById("manual-mentee");
    const mentorSelect = document.getElementById("manual-mentor");
    document.getElementById("manual-reassign-of").value = reassignOf || "";
    document.getElementById("manual-reassign-banner").style.display = reassignOf ? "block" : "none";
    document.getElementById("manualModalLabel").textContent = reassignOf ? "Réassigner à un autre mentor" : "Nouveau matching manuel";

    const menteePool = menteeId ? mentees.filter((mt) => mt.id === menteeId) : eligibleMenteesForNewMatch();
    menteeSelect.innerHTML = menteePool.map((mt) => `<option value="${mt.id}">${DCUtils.escapeHtml(menteeLabel(mt))}</option>`).join("") || `<option value="">Aucun mentoré disponible</option>`;
    menteeSelect.disabled = !!menteeId;

    function refreshMentorOptions() {
      const mentee = mentees.find((mt) => mt.id === menteeSelect.value);
      const excludedMentorId = reassignOf ? (matchings.find((m) => m.id === reassignOf) || {}).mentorId : null;
      mentorSelect.innerHTML = mentors.map((mo) => {
        const eligible = MatchingEngine.isMentorEligible(mo, matchings) && mo.id !== excludedMentorId;
        const { score, hardBlock } = mentee ? MatchingEngine.computeScore(mentee, mo) : { score: 0, hardBlock: false };
        const label = `${mentorLabel(mo)} — ${MatchingEngine.remainingQuota(mo, matchings)} place(s) libre(s)${mentee ? ` · ${score}% compat.` : ""}${hardBlock ? " · préférence non respectée" : ""}`;
        return `<option value="${mo.id}" ${!eligible ? "disabled" : ""}>${DCUtils.escapeHtml(label)}</option>`;
      }).join("");
      updateScoreHint();
    }

    function updateScoreHint() {
      const mentee = mentees.find((mt) => mt.id === menteeSelect.value);
      const mentor = mentors.find((mo) => mo.id === mentorSelect.value);
      const hint = document.getElementById("manual-score-hint");
      if (!mentee || !mentor) { hint.textContent = ""; return; }
      const { score, hardBlock } = MatchingEngine.computeScore(mentee, mentor);
      hint.textContent = hardBlock
        ? "⚠ Ne respecte pas la préférence de sexe du mentoré — création possible mais déconseillée."
        : `Score de compatibilité estimé : ${score}%.`;
    }

    menteeSelect.onchange = refreshMentorOptions;
    mentorSelect.onchange = updateScoreHint;
    refreshMentorOptions();

    new bootstrap.Modal(document.getElementById("manualModal")).show();
  }

  async function submitManual(e) {
    e.preventDefault();
    const menteeId = document.getElementById("manual-mentee").value;
    const mentorId = document.getElementById("manual-mentor").value;
    const reassignOf = document.getElementById("manual-reassign-of").value || null;
    if (!menteeId || !mentorId) { DCUtils.toast("Sélectionnez un mentoré et un mentor.", "danger"); return; }

    const mentee = mentees.find((mt) => mt.id === menteeId);
    const mentor = mentors.find((mo) => mo.id === mentorId);
    const { score } = MatchingEngine.computeScore(mentee, mentor);
    const now = new Date().toISOString();
    const newMatching = {
      id: DataStore.nextId("match"), menteeId, mentorId, compatibilityScore: score, status: "validee",
      requestedAt: now, respondedAt: now,
      statusHistory: [{ status: "validee", date: now, note: reassignOf ? "Créé par réassignation administrative." : "Matching créé manuellement par l'administration." }],
      endReason: null,
    };
    await DataStore.insert("matchings", newMatching);
    mentee.matchingId = newMatching.id;

    if (reassignOf) {
      const old = matchings.find((m) => m.id === reassignOf);
      old.status = "terminee";
      old.endReason = "Réassignation à un autre mentor.";
      pushHistory(old, "terminee", `Remplacé par le binôme ${newMatching.id}.`);
    }

    await AuditLog.record({
      actor: { id: adminUser.id, label: `${adminUser.firstName} ${adminUser.lastName}`, role: adminUser.role }, module: "mentorship",
      action: reassignOf ? "reassignation_matching" : "matching_manuel", targetType: "matching", targetId: newMatching.id,
      before: reassignOf ? { previousMatchId: reassignOf } : null, after: { mentorId: mentor.id, menteeId: mentee.id, status: "validee" },
      details: `Binôme ${menteeLabel(mentee)} ↔ ${mentorLabel(mentor)} créé manuellement${reassignOf ? " (réassignation)" : ""}.`,
    });

    await NotificationCenter.push(menteeUser(mentee).id, {
      type: "matching_valide", title: "Nouveau mentor",
      text: `L'équipe DiaspoConnect vous a mis(e) en relation avec ${mentorLabel(mentor)}.`,
      link: "pages/mentore/matching.html",
    });

    bootstrap.Modal.getInstance(document.getElementById("manualModal")).hide();
    DCUtils.toast("Matching créé.", "success");
    applyFilters(); renderMentorLoad();
  }

  async function init() {
    adminUser = await Auth.guard(["admin"]);
    if (!adminUser) return;
    await Layout.mountApp("admin", "matching", adminUser);

    [matchings, mentees, mentors, users] = await Promise.all([
      DataStore.getMatchings(), DataStore.getMentees(), DataStore.getMentors(), DataStore.getUsers(),
    ]);
    render(matchings);
    renderMentorLoad();

    document.getElementById("filters-form").addEventListener("input", applyFilters);
    document.getElementById("matchings-tbody").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action='detail']");
      if (btn) openDetail(btn.dataset.id);
    });
    document.getElementById("new-matching-btn").addEventListener("click", () => openManualModal());
    document.getElementById("manual-form").addEventListener("submit", submitManual);
    document.getElementById("reason-form").addEventListener("submit", (e) => {
      e.preventDefault();
      if (!FormValidation.validateForm(e.target, { reason: [FormValidation.rules.required] })) return;
      submitReason();
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
