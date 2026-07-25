(function () {
  async function findMenteeByUser(userId) {
    const mentees = await DataStore.getMentees();
    return mentees.find((m) => m.userId === userId);
  }

  function renderChecklist(mentee) {
    const items = Checklist.ensure(mentee);
    const { done, total, pct } = Checklist.progress(mentee);
    document.getElementById("checklist-progress-label").textContent = `${done} / ${total} étapes complétées`;
    document.getElementById("checklist-progress-bar").style.width = `${pct}%`;
    const host = document.getElementById("checklist-preview");
    host.innerHTML = items.slice(0, 4).map((i) => `
      <div class="dc-checklist-item ${i.done ? "is-checked" : ""}">
        <input class="form-check-input mt-1" type="checkbox" data-item="${i.id}" ${i.done ? "checked" : ""} id="chk-${i.id}">
        <label class="dc-checklist-label small mb-0" for="chk-${i.id}">${DCUtils.escapeHtml(i.label)}</label>
      </div>`).join("");
    host.querySelectorAll("input[type=checkbox]").forEach((cb) => {
      cb.addEventListener("change", () => {
        Checklist.toggle(mentee, cb.dataset.item);
        renderChecklist(mentee);
      });
    });
  }

  async function renderMatchingCard(mentee, matchings, mentors, users) {
    const host = document.getElementById("matching-card-body");
    const matching = matchings.find((m) => m.id === mentee.matchingId && ["en_attente", "validee", "active"].includes(m.status));
    if (!matching) {
      host.innerHTML = `
        <div class="dc-empty-state py-4">
          <div class="dc-empty-icon mx-auto"><i class="bi bi-search-heart"></i></div>
          <h6>Vous n'avez pas encore de mentor</h6>
          <p class="small mb-3">Lancez une recherche pour recevoir des propositions compatibles avec votre profil.</p>
          <a href="recherche-mentors.html" class="btn btn-primary btn-sm">Rechercher un mentor</a>
        </div>`;
      return;
    }
    const mentor = mentors.find((m) => m.id === matching.mentorId);
    const mentorUser = users.find((u) => u.id === mentor.userId);
    host.innerHTML = `
      <div class="d-flex gap-3 align-items-center mb-3">
        <span class="dc-avatar dc-avatar-lg" style="background:${mentorUser.avatarColor}">${mentorUser.avatarInitials}</span>
        <div>
          <h6 class="mb-0">${DCUtils.escapeHtml(mentorUser.firstName)} ${DCUtils.escapeHtml(mentorUser.lastName)}</h6>
          <div class="small text-muted-dc">${DCUtils.escapeHtml(mentor.city)} · ${DCUtils.escapeHtml(mentor.studyField)}</div>
        </div>
        <div class="ms-auto">${DCUtils.statusBadge(matching.status)}</div>
      </div>
      <div class="dc-compat-score mb-3">
        <span class="small text-muted-dc">Compatibilité</span>
        <div class="dc-compat-bar"><span style="width:${matching.compatibilityScore}%"></span></div>
        <strong class="small">${matching.compatibilityScore}%</strong>
      </div>
      <div class="d-flex gap-2">
        <a href="matching.html" class="btn btn-outline-primary btn-sm">Voir le suivi</a>
        <a href="messagerie.html" class="btn btn-primary btn-sm">Envoyer un message</a>
      </div>`;
  }

  function housingCard(h) {
    return `<div class="col-md-4">
      <div class="dc-card p-3 h-100">
        <h6 class="mb-1">${DCUtils.escapeHtml(h.title)}</h6>
        <div class="small text-muted-dc mb-2">${DCUtils.escapeHtml(h.city)} · ${DCUtils.currency(h.budget)}/mois</div>
        <a href="logements.html" class="btn btn-outline-primary btn-sm w-100">Voir</a>
      </div></div>`;
  }
  function oppCard(o) {
    return `<div class="col-md-4">
      <div class="dc-card p-3 h-100">
        <h6 class="mb-1">${DCUtils.escapeHtml(o.title)}</h6>
        <div class="small text-muted-dc mb-2">${DCUtils.escapeHtml(o.city)} · ${DCUtils.escapeHtml(o.compensation)}</div>
        <a href="opportunites.html" class="btn btn-outline-primary btn-sm w-100">Voir</a>
      </div></div>`;
  }

  function renderOnboarding(mentee) {
    const { done: checklistDone } = Checklist.progress(mentee);
    const hasAccompaniment = !!mentee.matchingId;
    const steps = [
      { label: "Créer mon compte", done: true },
      { label: "Compléter mon profil", done: mentee.profileCompleteness >= 80 },
      { label: "Trouver un mentor", done: hasAccompaniment },
      { label: "Suivre mes démarches d'arrivée", done: checklistDone > 0 },
    ];
    let firstPendingFound = false;
    document.getElementById("onboarding-steps").innerHTML = steps.map((s, i) => {
      let stateClass = "is-done";
      if (!s.done) { stateClass = firstPendingFound ? "" : "is-active"; firstPendingFound = true; }
      return `<div class="d-flex flex-column align-items-center text-center" style="width:23%;">
        <div class="dc-onboarding-step ${stateClass}">${s.done ? '<i class="bi bi-check2"></i>' : i + 1}</div>
        <div class="small mt-2">${DCUtils.escapeHtml(s.label)}</div>
      </div>`;
    }).join("");
  }

  async function init() {
    const user = await Auth.guard(["mentore"]);
    if (!user) return;
    await Layout.mountApp("mentore", "dashboard", user);

    const mentee = await findMenteeByUser(user.id);
    document.getElementById("welcome-name").textContent = user.firstName;

    if (!mentee) return;

    renderOnboarding(mentee);

    const ringPct = mentee.profileCompleteness;
    document.getElementById("completeness-ring").style.setProperty("--pct", ringPct);
    document.getElementById("completeness-value").textContent = `${ringPct}%`;
    document.getElementById("file-status-badge").innerHTML = DCUtils.fileStatusBadge(mentee.fileStatus);

    renderChecklist(mentee);

    const [matchings, mentors, users, housing, opportunities] = await Promise.all([
      DataStore.getMatchings(), DataStore.getMentors(), DataStore.getUsers(),
      DataStore.getHousing(), DataStore.getOpportunities(),
    ]);
    await renderMatchingCard(mentee, matchings, mentors, users);

    const recoHousing = housing.filter((h) => h.moderationStatus === "validee" && h.city === mentee.desiredCity && h.budget <= mentee.budget + 100).slice(0, 3);
    document.getElementById("reco-housing").innerHTML = recoHousing.length
      ? recoHousing.map(housingCard).join("")
      : `<div class="col-12"><div class="dc-empty-state py-3"><p class="small mb-0">Aucun logement recommandé pour l'instant à ${DCUtils.escapeHtml(mentee.desiredCity)}.</p></div></div>`;

    const recoOpp = opportunities.filter((o) => o.moderationStatus === "validee" && o.city === mentee.desiredCity).slice(0, 3);
    document.getElementById("reco-opp").innerHTML = recoOpp.length
      ? recoOpp.map(oppCard).join("")
      : `<div class="col-12"><div class="dc-empty-state py-3"><p class="small mb-0">Aucune opportunité recommandée pour l'instant à ${DCUtils.escapeHtml(mentee.desiredCity)}.</p></div></div>`;
  }

  document.addEventListener("DOMContentLoaded", init);
})();
