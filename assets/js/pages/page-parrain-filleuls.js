(function () {
  let mentor, mentees, users, matchings;

  function row(matching) {
    const mentee = mentees.find((m) => m.id === matching.menteeId);
    const menteeUser = users.find((u) => u.id === mentee.userId);
    const { pct } = Checklist.progress(mentee);
    const canEnd = ["validee", "active"].includes(matching.status);
    return { matching, mentee, menteeUser, pct, canEnd };
  }

  function myMatchings() {
    return matchings.filter((m) => m.mentorId === mentor.id).sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));
  }

  function render() {
    const rows = myMatchings().map(row);
    const tbody = document.getElementById("mentees-tbody");
    const cardsHost = document.getElementById("mentees-cards");
    if (!rows.length) {
      document.getElementById("empty-state").classList.remove("d-none");
      tbody.innerHTML = ""; cardsHost.innerHTML = "";
      return;
    }
    document.getElementById("empty-state").classList.add("d-none");

    tbody.innerHTML = rows.map((r) => `
      <tr>
        <td><div class="d-flex align-items-center gap-2">
          <span class="dc-avatar dc-avatar-sm" style="background:${r.menteeUser.avatarColor}">${r.menteeUser.avatarInitials}</span>
          <span>${DCUtils.escapeHtml(r.menteeUser.firstName)} ${DCUtils.escapeHtml(r.menteeUser.lastName)}</span>
        </div></td>
        <td>${DCUtils.escapeHtml(r.mentee.desiredCity)}</td>
        <td>${DCUtils.statusBadge(r.matching.status)}</td>
        <td style="width:140px;"><div class="progress" style="height:6px;"><div class="progress-bar bg-primary" style="width:${r.pct}%"></div></div><span class="small text-muted-dc">${r.pct}%</span></td>
        <td class="text-end">
          <a href="messagerie.html" class="btn btn-sm btn-outline-primary">Message</a>
          ${r.canEnd ? `<button class="btn btn-sm btn-outline-danger" data-action="end" data-id="${r.matching.id}">Terminer</button>` : ""}
        </td>
      </tr>`).join("");

    cardsHost.innerHTML = rows.map((r) => `
      <div class="dc-card p-3 mb-2 dc-row-card">
        <div class="d-flex justify-content-between align-items-start mb-2">
          <div class="d-flex align-items-center gap-2">
            <span class="dc-avatar dc-avatar-sm" style="background:${r.menteeUser.avatarColor}">${r.menteeUser.avatarInitials}</span>
            <span class="fw-semibold">${DCUtils.escapeHtml(r.menteeUser.firstName)} ${DCUtils.escapeHtml(r.menteeUser.lastName)}</span>
          </div>
          ${DCUtils.statusBadge(r.matching.status)}
        </div>
        <div class="small text-muted-dc mb-2">${DCUtils.escapeHtml(r.mentee.desiredCity)} · Checklist ${r.pct}%</div>
        <div class="d-flex gap-2">
          <a href="messagerie.html" class="btn btn-sm btn-outline-primary flex-fill">Message</a>
          ${r.canEnd ? `<button class="btn btn-sm btn-outline-danger flex-fill" data-action="end" data-id="${r.matching.id}">Terminer</button>` : ""}
        </div>
      </div>`).join("");
  }

  function bindActions(container) {
    container.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action='end']");
      if (!btn) return;
      ConfirmModal.open({
        title: "Mettre fin à l'accompagnement",
        body: "Le filleul sera notifié et pourra rechercher un nouveau parrain. Confirmez-vous ?",
        confirmLabel: "Mettre fin",
        onConfirm: async () => {
          const matching = matchings.find((m) => m.id === btn.dataset.id);
          const now = new Date().toISOString();
          matching.status = "terminee";
          matching.endReason = "Fin décidée par le parrain/la marraine";
          matching.statusHistory.push({ status: "terminee", date: now, note: "Accompagnement terminé par le parrain/la marraine" });
          const mentee = mentees.find((m) => m.id === matching.menteeId);
          await DataStore.update("mentees", mentee.id, { matchingId: null });
          DCUtils.toast("Accompagnement terminé.", "info");
          render();
        },
      });
    });
  }

  async function init() {
    const user = await Auth.guard(["parrain"]);
    if (!user) return;
    await Layout.mountApp("parrain", "filleuls", user);

    const mentors = await DataStore.getMentors();
    mentor = mentors.find((m) => m.userId === user.id);
    [mentees, users, matchings] = await Promise.all([DataStore.getMentees(), DataStore.getUsers(), DataStore.getMatchings()]);
    mentees.forEach((m) => Checklist.ensure(m));

    render();
    bindActions(document.getElementById("mentees-tbody"));
    bindActions(document.getElementById("mentees-cards"));
  }

  document.addEventListener("DOMContentLoaded", init);
})();
