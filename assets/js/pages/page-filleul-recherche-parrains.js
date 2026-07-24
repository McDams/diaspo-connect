/**
 * Recherche de parrains côté filleul connecté : classement par compatibilité
 * (MatchingEngine.rankMentors) + envoi réel d'une demande de matching.
 */
(function () {
  let mentee, mentors, users, matchings;

  function ranked() {
    return MatchingEngine.rankMentors(mentee, mentors, matchings);
  }

  function currentFilters() {
    return {
      q: DCUtils.qs("#f-recherche").value.trim(),
      ville: DCUtils.qs("#f-ville").value,
    };
  }

  function applyFilters() {
    const f = currentFilters();
    const results = ranked().filter((r) => (
      Filters.textMatch(`${r.mentor.city} ${r.mentor.school} ${r.mentor.bio}`, f.q) &&
      Filters.selectMatch(r.mentor.city, f.ville)
    ));
    render(results);
  }

  function populateSelects() {
    const citySel = document.getElementById("f-ville");
    [...new Set(mentors.map((m) => m.city))].sort().forEach((c) => citySel.insertAdjacentHTML("beforeend", `<option value="${c}">${c}</option>`));
  }

  function card(entry) {
    const { mentor, score, quotaReached } = entry;
    const user = users.find((u) => u.id === mentor.userId);
    const alreadyRequested = mentee.matchingId && matchings.find((m) => m.id === mentee.matchingId && m.mentorId === mentor.id && ["en_attente", "validee", "active"].includes(m.status));
    let actionBtn = `<button class="btn btn-primary btn-sm flex-fill" data-action="request" data-id="${mentor.id}" ${quotaReached ? "disabled" : ""}>Demander un matching</button>`;
    if (quotaReached) actionBtn = `<button class="btn btn-secondary btn-sm flex-fill" disabled>Quota atteint</button>`;
    if (alreadyRequested) actionBtn = `<button class="btn btn-outline-success btn-sm flex-fill" disabled><i class="bi bi-check2"></i> Déjà demandé</button>`;

    return `
    <div class="col-md-6 col-xl-4">
      <div class="dc-card dc-card-hover h-100 p-3 d-flex flex-column">
        <div class="d-flex gap-3 align-items-start mb-2">
          <span class="dc-avatar dc-avatar-lg" style="background:${user.avatarColor}">${user.avatarInitials}</span>
          <div class="flex-grow-1">
            <h5 class="mb-0">${DCUtils.escapeHtml(user.firstName)} ${DCUtils.escapeHtml(user.lastName)}</h5>
            <div class="small text-muted-dc">${DCUtils.escapeHtml(mentor.city)} · ${DCUtils.escapeHtml(mentor.studyField)}</div>
          </div>
        </div>
        <div class="dc-compat-score mb-2">
          <span class="small text-muted-dc">Compatibilité</span>
          <div class="dc-compat-bar"><span style="width:${score}%"></span></div>
          <strong class="small">${score}%</strong>
        </div>
        <p class="small text-body-secondary mb-2">${DCUtils.escapeHtml(mentor.bio).slice(0, 100)}…</p>
        <div class="d-flex flex-wrap gap-1 mb-3">${mentor.helpTypes.map((h) => `<span class="badge text-bg-light border">${DCUtils.escapeHtml(h)}</span>`).join("")}</div>
        <div class="mt-auto d-flex gap-2">${actionBtn}</div>
      </div>
    </div>`;
  }

  function render(results) {
    const host = document.getElementById("mentors-grid");
    document.getElementById("results-count").textContent = `${results.length} profil${results.length > 1 ? "s" : ""} compatible${results.length > 1 ? "s" : ""}`;
    host.innerHTML = results.length ? results.map(card).join("") : `
      <div class="col-12"><div class="dc-empty-state">
        <div class="dc-empty-icon mx-auto"><i class="bi bi-search"></i></div>
        <h6>Aucun profil ne correspond</h6>
        <p class="small">Essayez d'élargir votre recherche.</p>
      </div></div>`;
  }

  async function requestMatching(mentorId) {
    const mentor = mentors.find((m) => m.id === mentorId);
    const result = MatchingEngine.requestMatching(mentee, mentor, matchings);
    if (!result.ok) {
      DCUtils.toast(result.message, "danger");
      return;
    }
    await DataStore.insert("matchings", result.matching);
    await DataStore.update("mentees", mentee.id, { matchingId: result.matching.id });
    mentee.matchingId = result.matching.id;
    const mentorUser = users.find((u) => u.id === mentor.userId);
    await NotificationCenter.push(mentorUser.id, {
      type: "nouvelle_demande",
      title: "Nouvelle demande de matching",
      text: `${DCUtils.escapeHtml(document.querySelector('.dc-current-user-name')?.textContent || 'Un filleul')} souhaite être accompagné(e) par vous.`,
      link: "pages/parrain/demandes.html",
    });
    DCUtils.toast("Votre demande de matching a bien été envoyée !", "success");
    applyFilters();
  }

  async function init() {
    const user = await Auth.guard(["filleul"]);
    if (!user) return;
    await Layout.mountApp("filleul", "recherche-parrains", user);

    const mentees = await DataStore.getMentees();
    mentee = mentees.find((m) => m.userId === user.id);
    [mentors, users, matchings] = await Promise.all([DataStore.getMentors(), DataStore.getUsers(), DataStore.getMatchings()]);

    if (mentee.sexPreference && mentee.sexPreference !== "aucune") {
      document.getElementById("sex-pref-banner").classList.remove("d-none");
      document.getElementById("sex-pref-banner-text").textContent =
        `Votre préférence "${mentee.sexPreference}" est appliquée en priorité dans les résultats ci-dessous.`;
    }

    populateSelects();
    render(ranked());

    document.getElementById("filters-form").addEventListener("input", DCUtils.debounce(applyFilters, 150));
    document.getElementById("mentors-grid").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action='request']");
      if (btn) requestMatching(btn.dataset.id);
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
