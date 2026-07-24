(function () {
  async function init() {
    const ctx = await StaffGuard.require("compliance-dashboard");
    if (!ctx) return;
    await Layout.mountStaffApp("compliance-dashboard", ctx);
    document.getElementById("welcome-name").textContent = ctx.user.firstName;

    const [users, mentors, housing] = await Promise.all([DataStore.getUsers(), DataStore.getMentors(), DataStore.getHousing()]);

    const toVerify = users.filter((u) => !u.verified && u.status === "actif");
    const suspended = users.filter((u) => u.status === "suspendu");
    const pendingListings = housing.filter((h) => h.moderationStatus === "soumise");

    document.getElementById("kpi-to-verify").textContent = toVerify.length;
    document.getElementById("kpi-pending-docs").textContent = pendingListings.length;
    document.getElementById("kpi-suspended").textContent = suspended.length;
    document.getElementById("kpi-verified-mentors").textContent = mentors.filter((m) => m.status === "actif").length;

    document.getElementById("to-verify-tbody").innerHTML = toVerify.length ? toVerify.map((u) => `<tr>
      <td><div class="d-flex align-items-center gap-2"><span class="dc-avatar dc-avatar-sm" style="background:${u.avatarColor}">${u.avatarInitials}</span>${DCUtils.escapeHtml(u.firstName)} ${DCUtils.escapeHtml(u.lastName)}</div></td>
      <td class="text-capitalize">${u.role}</td>
      <td>${DCUtils.escapeHtml(u.city)}</td>
      <td>${DCUtils.formatDate(u.createdAt)}</td>
    </tr>`).join("") : `<tr><td colspan="4"><div class="dc-empty-state py-3"><p class="small mb-0">Aucun profil en attente de vérification.</p></div></td></tr>`;

    document.getElementById("suspended-tbody").innerHTML = suspended.length ? suspended.map((u) => `<tr>
      <td>${DCUtils.escapeHtml(u.firstName)} ${DCUtils.escapeHtml(u.lastName)}</td>
      <td class="text-capitalize">${u.role}</td>
      <td>${DCUtils.statusBadge(u.status)}</td>
    </tr>`).join("") : `<tr><td colspan="3"><div class="dc-empty-state py-3"><p class="small mb-0">Aucun compte suspendu.</p></div></td></tr>`;
  }

  document.addEventListener("DOMContentLoaded", init);
})();
