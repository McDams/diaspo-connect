(function () {
  async function init() {
    const user = await Auth.guard(["mentor"]);
    if (!user) return;
    await Layout.mountApp("mentor", "dashboard", user);

    const [mentors, mentees, matchings, users, messages] = await Promise.all([
      DataStore.getMentors(), DataStore.getMentees(), DataStore.getMatchings(), DataStore.getUsers(), DataStore.getMessages(),
    ]);
    const mentor = mentors.find((m) => m.userId === user.id);
    document.getElementById("welcome-name").textContent = user.firstName;
    if (!mentor) return;

    const activeCount = MatchingEngine.countActiveMentees(mentor.id, matchings);
    const pending = matchings.filter((m) => m.mentorId === mentor.id && m.status === "en_attente");
    const remaining = MatchingEngine.remainingQuota(mentor, matchings);

    document.getElementById("kpi-active").textContent = activeCount;
    document.getElementById("kpi-quota").textContent = `${remaining} / ${mentor.maxMentees}`;
    document.getElementById("kpi-pending").textContent = pending.length;
    document.getElementById("status-badge").innerHTML = mentor.status === "actif"
      ? '<span class="dc-verified-badge"><i class="bi bi-patch-check-fill"></i>Profil vérifié</span>'
      : '<span class="text-warning small"><i class="bi bi-hourglass-split me-1"></i>Vérification en cours</span>';

    if (remaining === 0) {
      document.getElementById("quota-banner").classList.remove("d-none");
    }

    const activeMatchings = matchings.filter((m) => m.mentorId === mentor.id && ["validee", "active"].includes(m.status));
    document.getElementById("active-mentees-list").innerHTML = activeMatchings.length
      ? activeMatchings.map((m) => {
          const mentee = mentees.find((x) => x.id === m.menteeId);
          const menteeUser = users.find((u) => u.id === mentee.userId);
          return `<div class="d-flex align-items-center gap-2 py-2 border-bottom">
            <span class="dc-avatar dc-avatar-sm" style="background:${menteeUser.avatarColor}">${menteeUser.avatarInitials}</span>
            <div class="flex-grow-1">
              <div class="small fw-semibold">${DCUtils.escapeHtml(menteeUser.firstName)} ${DCUtils.escapeHtml(menteeUser.lastName)}</div>
              <div class="small text-muted-dc">${DCUtils.escapeHtml(mentee.desiredCity)} · ${DCUtils.escapeHtml(mentee.studyField)}</div>
            </div>
            ${DCUtils.statusBadge(m.status)}
          </div>`;
        }).join("")
      : `<div class="dc-empty-state py-3"><p class="small mb-0">Aucun mentoré actif pour le moment.</p></div>`;

    const myConvs = messages.filter((c) => c.participants.includes(user.id));
    document.getElementById("recent-messages").innerHTML = myConvs.length
      ? myConvs.map((c) => {
          const otherId = c.participants.find((p) => p !== user.id);
          const otherUser = users.find((u) => u.id === otherId);
          const last = c.messages[c.messages.length - 1];
          return `<div class="d-flex align-items-center gap-2 py-2 border-bottom">
            <span class="dc-avatar dc-avatar-sm" style="background:${otherUser.avatarColor}">${otherUser.avatarInitials}</span>
            <div class="flex-grow-1 overflow-hidden">
              <div class="small fw-semibold">${DCUtils.escapeHtml(otherUser.firstName)} ${DCUtils.escapeHtml(otherUser.lastName)}</div>
              <div class="small text-muted-dc text-truncate">${DCUtils.escapeHtml(last.text)}</div>
            </div>
            <span class="small text-muted-dc">${DCUtils.timeAgo(last.sentAt)}</span>
          </div>`;
        }).join("")
      : `<div class="dc-empty-state py-3"><p class="small mb-0">Aucun message récent.</p></div>`;

    document.getElementById("tasks-list").innerHTML = `
      ${pending.length ? `<div class="dc-checklist-item"><i class="bi bi-inbox text-warning"></i><span class="ms-2 small">${pending.length} demande(s) de matching en attente de réponse</span></div>` : ""}
      ${activeMatchings.length ? `<div class="dc-checklist-item"><i class="bi bi-chat-dots text-primary"></i><span class="ms-2 small">Prendre des nouvelles de vos mentorés actifs</span></div>` : ""}
      ${mentor.status !== "actif" ? `<div class="dc-checklist-item"><i class="bi bi-hourglass text-warning"></i><span class="ms-2 small">Votre profil est en cours de vérification par l'équipe</span></div>` : ""}
      ${!pending.length && !activeMatchings.length ? `<div class="dc-empty-state py-3"><p class="small mb-0">Aucune tâche pour le moment.</p></div>` : ""}
    `;
  }

  document.addEventListener("DOMContentLoaded", init);
})();
