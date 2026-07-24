(function () {
  let matchings, mentees, mentors, users;

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
    const menteeUser = users.find((u) => u.id === mentee.userId);
    const mentorUser = users.find((u) => u.id === mentor.userId);
    return `<tr>
      <td>${DCUtils.escapeHtml(menteeUser.firstName)} ${DCUtils.escapeHtml(menteeUser.lastName)}</td>
      <td>${DCUtils.escapeHtml(mentorUser.firstName)} ${DCUtils.escapeHtml(mentorUser.lastName)}</td>
      <td>${m.compatibilityScore}%</td>
      <td>${DCUtils.statusBadge(m.status)}</td>
      <td>${DCUtils.formatDate(m.requestedAt)}</td>
    </tr>`;
  }

  function render(list) {
    document.getElementById("results-count").textContent = `${list.length} binôme${list.length > 1 ? "s" : ""}`;
    document.getElementById("matchings-tbody").innerHTML = list.length
      ? list.map(row).join("")
      : `<tr><td colspan="5"><div class="dc-empty-state py-4"><p class="small mb-0">Aucun binôme pour ce filtre.</p></div></td></tr>`;
  }

  function renderMentorLoad() {
    const host = document.getElementById("mentor-load");
    host.innerHTML = mentors.map((m) => {
      const count = MatchingEngine.countActiveMentees(m.id, matchings);
      const u = users.find((x) => x.id === m.userId);
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

  async function init() {
    const admin = await Auth.guard(["admin"]);
    if (!admin) return;
    await Layout.mountApp("admin", "matching", admin);

    [matchings, mentees, mentors, users] = await Promise.all([
      DataStore.getMatchings(), DataStore.getMentees(), DataStore.getMentors(), DataStore.getUsers(),
    ]);
    render(matchings);
    renderMentorLoad();

    document.getElementById("filters-form").addEventListener("input", applyFilters);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
