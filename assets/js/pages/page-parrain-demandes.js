/**
 * Traitement des demandes de matching reçues par un parrain/marraine :
 * acceptation (avec re-vérification du quota au moment de l'action, car il
 * peut avoir changé depuis l'affichage de la liste) ou refus motivé.
 */
(function () {
  let mentor, mentees, users, matchings, currentUser;

  function pendingRequests() {
    return matchings.filter((m) => m.mentorId === mentor.id && m.status === "en_attente");
  }

  function card(matching) {
    const mentee = mentees.find((m) => m.id === matching.menteeId);
    const menteeUser = users.find((u) => u.id === mentee.userId);
    return `<div class="dc-card p-3 mb-3">
      <div class="d-flex gap-3 align-items-start">
        <span class="dc-avatar" style="background:${menteeUser.avatarColor}">${menteeUser.avatarInitials}</span>
        <div class="flex-grow-1">
          <div class="d-flex justify-content-between flex-wrap gap-2">
            <h6 class="mb-0">${DCUtils.escapeHtml(menteeUser.firstName)} ${DCUtils.escapeHtml(menteeUser.lastName)}</h6>
            <div class="dc-compat-score"><span class="small text-muted-dc">Compatibilité</span><div class="dc-compat-bar"><span style="width:${matching.compatibilityScore}%"></span></div><strong class="small">${matching.compatibilityScore}%</strong></div>
          </div>
          <div class="small text-muted-dc mb-2">${DCUtils.escapeHtml(mentee.desiredCity)} · ${DCUtils.escapeHtml(mentee.studyField)} · Budget ${DCUtils.currency(mentee.budget)}</div>
          <p class="small text-body-secondary mb-2">${DCUtils.escapeHtml(mentee.specificNeeds || "Aucun besoin spécifique renseigné.")}</p>
          <div class="d-flex flex-wrap gap-1 mb-3">${mentee.accompagnementType.map((a) => `<span class="badge text-bg-light border">${DCUtils.escapeHtml(a)}</span>`).join("")}</div>
          <div class="d-flex gap-2">
            <button class="btn btn-primary btn-sm" data-action="accept" data-id="${matching.id}"><i class="bi bi-check2 me-1"></i>Accepter</button>
            <button class="btn btn-outline-danger btn-sm" data-action="refuse" data-id="${matching.id}"><i class="bi bi-x me-1"></i>Refuser</button>
          </div>
        </div>
      </div>
    </div>`;
  }

  function render() {
    const list = pendingRequests();
    document.getElementById("pending-count").textContent = `${list.length} demande${list.length > 1 ? "s" : ""} en attente`;
    const host = document.getElementById("requests-list");
    host.innerHTML = list.length ? list.map(card).join("") : `
      <div class="dc-empty-state">
        <div class="dc-empty-icon mx-auto"><i class="bi bi-inbox"></i></div>
        <h6>Aucune demande en attente</h6>
        <p class="small mb-0">Les nouvelles demandes de matching apparaîtront ici.</p>
      </div>`;
  }

  async function accept(matchingId) {
    if (!MatchingEngine.isMentorEligible(mentor, matchings)) {
      DCUtils.toast("Vous avez atteint votre quota de 2 filleuls actifs, impossible d'accepter cette demande.", "danger");
      return;
    }
    const matching = matchings.find((m) => m.id === matchingId);
    const now = new Date().toISOString();
    matching.status = "active";
    matching.respondedAt = now;
    matching.statusHistory.push({ status: "validee", date: now, note: "Acceptée par le parrain/la marraine" });
    matching.statusHistory.push({ status: "active", date: now, note: "Accompagnement démarré" });
    const mentee = mentees.find((m) => m.id === matching.menteeId);
    const menteeUser = users.find((u) => u.id === mentee.userId);
    await NotificationCenter.push(menteeUser.id, {
      type: "matching_valide",
      title: "Matching validé",
      text: `Votre demande d'accompagnement avec ${currentUser.firstName} ${currentUser.lastName} a été acceptée.`,
      link: "pages/filleul/matching.html",
    });
    DCUtils.toast("Demande acceptée, l'accompagnement est actif.", "success");
    render();
  }

  async function refuse(matchingId) {
    const reason = document.getElementById("refuse-reason").value;
    const matching = matchings.find((m) => m.id === matchingId);
    const now = new Date().toISOString();
    matching.status = "terminee";
    matching.endReason = reason || "Refusée par le parrain/la marraine";
    matching.statusHistory.push({ status: "terminee", date: now, note: `Refusée : ${matching.endReason}` });
    const mentee = mentees.find((m) => m.id === matching.menteeId);
    await DataStore.update("mentees", mentee.id, { matchingId: null });
    bootstrap.Modal.getInstance(document.getElementById("refuseModal")).hide();
    DCUtils.toast("Demande refusée.", "info");
    render();
  }

  async function init() {
    const user = await Auth.guard(["parrain"]);
    if (!user) return;
    currentUser = user;
    await Layout.mountApp("parrain", "demandes", user);

    const mentors = await DataStore.getMentors();
    mentor = mentors.find((m) => m.userId === user.id);
    [mentees, users, matchings] = await Promise.all([DataStore.getMentees(), DataStore.getUsers(), DataStore.getMatchings()]);

    render();

    let refuseTargetId = null;
    document.getElementById("requests-list").addEventListener("click", (e) => {
      const acceptBtn = e.target.closest("button[data-action='accept']");
      const refuseBtn = e.target.closest("button[data-action='refuse']");
      if (acceptBtn) accept(acceptBtn.dataset.id);
      if (refuseBtn) {
        refuseTargetId = refuseBtn.dataset.id;
        new bootstrap.Modal(document.getElementById("refuseModal")).show();
      }
    });
    document.getElementById("confirm-refuse-btn").addEventListener("click", () => refuse(refuseTargetId));
  }

  document.addEventListener("DOMContentLoaded", init);
})();
