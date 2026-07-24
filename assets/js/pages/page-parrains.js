/**
 * Page publique "Trouver un parrain" - liste filtrable des parrains/marraines
 * vérifiés, avec détail en modal. Les actions de matching redirigent les
 * visiteurs non connectés vers l'inscription filleul.
 */
(function () {
  let mentors = [], users = [], mentees = [], matchings = [];

  function joined() {
    return mentors.map((m) => ({ ...m, user: users.find((u) => u.id === m.userId) }));
  }

  function uniqueOptions(list, key) {
    return [...new Set(list.map((m) => m[key]).filter(Boolean))].sort();
  }

  function populateSelects() {
    const cities = uniqueOptions(mentors, "city");
    const fields = uniqueOptions(mentors, "studyField");
    const langs = [...new Set(mentors.flatMap((m) => m.languages))].sort();

    const citySel = document.getElementById("f-ville");
    const fieldSel = document.getElementById("f-domaine");
    const langSel = document.getElementById("f-langue");

    cities.forEach((c) => citySel.insertAdjacentHTML("beforeend", `<option value="${c}">${c}</option>`));
    fields.forEach((f) => fieldSel.insertAdjacentHTML("beforeend", `<option value="${f}">${f}</option>`));
    langs.forEach((l) => langSel.insertAdjacentHTML("beforeend", `<option value="${l}">${l}</option>`));
  }

  function currentFilters() {
    return {
      q: DCUtils.qs("#f-recherche").value.trim(),
      sexe: DCUtils.qs("#f-sexe").value,
      ville: DCUtils.qs("#f-ville").value,
      domaine: DCUtils.qs("#f-domaine").value,
      langue: DCUtils.qs("#f-langue").value,
      dispo: DCUtils.qs("#f-dispo").value,
    };
  }

  function applyFilters() {
    const f = currentFilters();
    const results = joined().filter((m) => {
      const fullName = `${m.user?.firstName || ""} ${m.user?.lastName || ""}`;
      return (
        Filters.textMatch(fullName + " " + m.school + " " + m.bio, f.q) &&
        Filters.selectMatch(m.sex, f.sexe) &&
        Filters.selectMatch(m.city, f.ville) &&
        Filters.selectMatch(m.studyField, f.domaine) &&
        Filters.arrayIncludes(m.languages, f.langue) &&
        Filters.selectMatch(m.availability, f.dispo)
      );
    });
    render(results);
  }

  function mentorCard(m) {
    const activeCount = MatchingEngine.countActiveMentees(m.id, matchings);
    const quotaBadge = activeCount >= m.maxMentees
      ? `<span class="dc-badge dc-badge-danger">Quota atteint (${activeCount}/${m.maxMentees})</span>`
      : `<span class="dc-badge dc-badge-success">${m.maxMentees - activeCount} place(s) disponible(s)</span>`;
    const verifiedBadge = m.user?.verified
      ? `<span class="dc-verified-badge"><i class="bi bi-patch-check-fill"></i>Vérifié</span>`
      : `<span class="dc-verified-badge text-warning"><i class="bi bi-hourglass-split"></i>Vérification en cours</span>`;

    return `
    <div class="col-md-6 col-xl-4">
      <div class="dc-card dc-card-hover h-100 p-3 d-flex flex-column">
        <div class="d-flex gap-3 align-items-start mb-2">
          <span class="dc-avatar dc-avatar-lg" style="background:${m.user?.avatarColor || '#1F3A5F'}">${m.user?.avatarInitials || "?"}</span>
          <div class="flex-grow-1">
            <h5 class="mb-0">${DCUtils.escapeHtml(m.user?.firstName)} ${DCUtils.escapeHtml(m.user?.lastName)}</h5>
            <div class="small text-muted-dc">${DCUtils.escapeHtml(m.city)} · ${DCUtils.escapeHtml(m.studyField)}</div>
            ${verifiedBadge}
          </div>
        </div>
        <p class="small text-body-secondary mb-2">${DCUtils.escapeHtml(m.bio).slice(0, 120)}${m.bio.length > 120 ? "…" : ""}</p>
        <div class="d-flex flex-wrap gap-1 mb-2">
          ${m.languages.map((l) => `<span class="badge text-bg-light border">${DCUtils.escapeHtml(l)}</span>`).join("")}
        </div>
        <div class="d-flex flex-wrap gap-1 mb-3">
          ${m.helpTypes.map((h) => `<span class="badge text-bg-light border">${DCUtils.escapeHtml(h)}</span>`).join("")}
        </div>
        <div class="mt-auto">
          <div class="mb-2">${quotaBadge}</div>
          <div class="d-flex gap-2">
            <button class="btn btn-outline-primary btn-sm flex-fill" data-action="view" data-id="${m.id}">Voir le profil</button>
            <button class="btn btn-primary btn-sm flex-fill" data-action="request" data-id="${m.id}">Demander</button>
          </div>
        </div>
      </div>
    </div>`;
  }

  function render(results) {
    const host = document.getElementById("mentors-grid");
    document.getElementById("results-count").textContent = `${results.length} profil${results.length > 1 ? "s" : ""} trouvé${results.length > 1 ? "s" : ""}`;
    if (!results.length) {
      host.innerHTML = `<div class="col-12"><div class="dc-empty-state">
        <div class="dc-empty-icon mx-auto"><i class="bi bi-search"></i></div>
        <h6>Aucun parrain ne correspond à ces critères</h6>
        <p class="small">Essayez d'élargir votre recherche (ville, langue ou disponibilité).</p>
      </div></div>`;
      return;
    }
    host.innerHTML = results.map(mentorCard).join("");
  }

  function openDetail(id) {
    const m = joined().find((x) => x.id === id);
    if (!m) return;
    const activeCount = MatchingEngine.countActiveMentees(m.id, matchings);
    DCUtils.qs("#detailModalLabel").textContent = `${m.user.firstName} ${m.user.lastName}`;
    DCUtils.qs("#detailModalBody").innerHTML = `
      <div class="d-flex gap-3 align-items-center mb-3">
        <span class="dc-avatar dc-avatar-lg" style="background:${m.user.avatarColor}">${m.user.avatarInitials}</span>
        <div>
          <div class="fw-semibold">${DCUtils.escapeHtml(m.city)} · ${DCUtils.escapeHtml(m.studyField)}</div>
          <div class="small text-muted-dc">${DCUtils.escapeHtml(m.school)} · ${m.yearsInFrance} ans en France</div>
          ${m.user.verified ? '<span class="dc-verified-badge"><i class="bi bi-patch-check-fill"></i>Profil vérifié</span>' : ""}
        </div>
      </div>
      <p>${DCUtils.escapeHtml(m.bio)}</p>
      <div class="row g-3 small">
        <div class="col-6"><strong>Sexe</strong><div class="text-muted-dc text-capitalize">${DCUtils.escapeHtml(m.sex)}</div></div>
        <div class="col-6"><strong>Disponibilité</strong><div class="text-muted-dc text-capitalize">${DCUtils.escapeHtml(m.availability)}</div></div>
        <div class="col-6"><strong>Langues</strong><div class="text-muted-dc">${m.languages.join(", ")}</div></div>
        <div class="col-6"><strong>Aide proposée</strong><div class="text-muted-dc">${m.helpTypes.join(", ")}</div></div>
        <div class="col-12"><strong>Filleuls actifs</strong><div class="text-muted-dc">${activeCount} / ${m.maxMentees}</div></div>
      </div>
      <div class="dc-banner dc-banner-info mt-3"><i class="bi bi-info-circle"></i><span>Pour envoyer une demande de matching, vous devez d'abord créer votre profil filleul.</span></div>
    `;
    DCUtils.qs("#detailRequestBtn").dataset.id = m.id;
    new bootstrap.Modal(document.getElementById("detailModal")).show();
  }

  function requestFromVisitor(id) {
    DCUtils.toast("Créez votre profil filleul pour envoyer une demande de matching.", "info");
    setTimeout(() => { window.location.href = "register-filleul.html"; }, 900);
  }

  async function init() {
    [mentors, users, mentees, matchings] = await Promise.all([
      DataStore.getMentors(), DataStore.getUsers(), DataStore.getMentees(), DataStore.getMatchings(),
    ]);
    populateSelects();
    render(joined());

    document.getElementById("filters-form").addEventListener("input", DCUtils.debounce(applyFilters, 150));
    document.getElementById("reset-filters").addEventListener("click", () => {
      document.getElementById("filters-form").reset();
      applyFilters();
    });
    document.getElementById("mentors-grid").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;
      if (btn.dataset.action === "view") openDetail(btn.dataset.id);
      if (btn.dataset.action === "request") requestFromVisitor(btn.dataset.id);
    });
    document.getElementById("detailRequestBtn").addEventListener("click", (e) => requestFromVisitor(e.target.dataset.id));
  }

  document.addEventListener("DOMContentLoaded", init);
})();
