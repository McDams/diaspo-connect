(function () {
  const STEP_ORDER = ["en_attente", "validee", "active", "terminee"];

  function renderTimeline(matching) {
    const host = document.getElementById("matching-timeline");
    host.innerHTML = matching.statusHistory.map((h, i) => {
      const isLast = i === matching.statusHistory.length - 1;
      const cls = isLast && matching.status !== "terminee" ? "is-current" : "is-done";
      return `<li class="${cls}"><span class="dc-timeline-dot"></span>
        <strong>${DCUtils.statusBadge(h.status)}</strong>
        <div>${DCUtils.escapeHtml(h.note)}</div>
        <div class="dc-timeline-date">${DCUtils.formatDateTime(h.date)}</div>
      </li>`;
    }).join("");
  }

  async function init() {
    const user = await Auth.guard(["filleul"]);
    if (!user) return;
    await Layout.mountApp("filleul", "matching", user);

    const [mentees, matchings, mentors, users] = await Promise.all([
      DataStore.getMentees(), DataStore.getMatchings(), DataStore.getMentors(), DataStore.getUsers(),
    ]);
    const mentee = mentees.find((m) => m.userId === user.id);
    const matching = matchings.find((m) => m.id === mentee.matchingId);

    if (!matching) {
      document.getElementById("matching-body").innerHTML = `
        <div class="dc-empty-state">
          <div class="dc-empty-icon mx-auto"><i class="bi bi-search-heart"></i></div>
          <h5>Aucun accompagnement en cours</h5>
          <p class="small">Lancez une recherche pour recevoir des propositions de parrainage compatibles.</p>
          <a href="recherche-parrains.html" class="btn btn-primary">Rechercher un parrain</a>
        </div>`;
      return;
    }

    const mentor = mentors.find((m) => m.id === matching.mentorId);
    const mentorUser = users.find((u) => u.id === mentor.userId);

    document.getElementById("matching-body").innerHTML = `
      <div class="row g-4">
        <div class="col-lg-5">
          <div class="dc-card p-3">
            <div class="d-flex gap-3 align-items-center mb-3">
              <span class="dc-avatar dc-avatar-lg" style="background:${mentorUser.avatarColor}">${mentorUser.avatarInitials}</span>
              <div>
                <h5 class="mb-0">${DCUtils.escapeHtml(mentorUser.firstName)} ${DCUtils.escapeHtml(mentorUser.lastName)}</h5>
                <div class="small text-muted-dc">${DCUtils.escapeHtml(mentor.city)} · ${DCUtils.escapeHtml(mentor.studyField)}</div>
              </div>
            </div>
            <div class="mb-2">${DCUtils.statusBadge(matching.status)}</div>
            <div class="dc-compat-score mb-3">
              <span class="small text-muted-dc">Compatibilité</span>
              <div class="dc-compat-bar"><span style="width:${matching.compatibilityScore}%"></span></div>
              <strong class="small">${matching.compatibilityScore}%</strong>
            </div>
            <div class="d-grid gap-2">
              <a href="messagerie.html" class="btn btn-primary btn-sm">Aller à la messagerie</a>
              <button class="btn btn-outline-danger btn-sm" id="report-btn"><i class="bi bi-flag me-1"></i>Signaler ce parrain</button>
              ${matching.status !== "terminee" ? `<button class="btn btn-outline-secondary btn-sm" id="end-btn"><i class="bi bi-x-circle me-1"></i>Mettre fin à l'accompagnement</button>` : ""}
            </div>
          </div>
        </div>
        <div class="col-lg-7">
          <div class="dc-card p-3">
            <h6 class="mb-3"><i class="bi bi-clock-history text-primary me-2"></i>Historique du suivi</h6>
            <ol class="dc-timeline" id="matching-timeline"></ol>
          </div>
        </div>
      </div>`;

    renderTimeline(matching);

    document.getElementById("report-btn").addEventListener("click", () => {
      ReportModal.open({ reporterId: user.id, targetType: "user", targetId: mentorUser.id });
    });

    const endBtn = document.getElementById("end-btn");
    if (endBtn) {
      endBtn.addEventListener("click", () => {
        ConfirmModal.open({
          title: "Mettre fin à l'accompagnement",
          body: "Cette action mettra fin définitivement à votre accompagnement actuel. Vous pourrez ensuite rechercher un nouveau parrain. Confirmez-vous ?",
          confirmLabel: "Mettre fin",
          variant: "danger",
          onConfirm: async () => {
            const now = new Date().toISOString();
            matching.status = "terminee";
            matching.endReason = "Fin anticipée à la demande du filleul";
            matching.statusHistory.push({ status: "terminee", date: now, note: "Accompagnement terminé à la demande du filleul" });
            await DataStore.update("mentees", mentee.id, { matchingId: null });
            DCUtils.toast("L'accompagnement a été terminé.", "info");
            setTimeout(() => window.location.reload(), 600);
          },
        });
      });
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
