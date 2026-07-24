(function () {
  let housing, user;

  function mine() {
    return housing.filter((h) => h.ownerId === user.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  function actionsFor(h) {
    const btns = [];
    if (h.moderationStatus === "brouillon") btns.push(`<button class="btn btn-sm btn-primary" data-action="submit" data-id="${h.id}">Soumettre</button>`);
    if (h.moderationStatus === "validee") btns.push(`<button class="btn btn-sm btn-outline-secondary" data-action="archive" data-id="${h.id}">Archiver</button>`);
    if (h.moderationStatus === "rejetee") btns.push(`<button class="btn btn-sm btn-outline-primary" data-action="resubmit" data-id="${h.id}">Modifier &amp; resoumettre</button>`);
    return btns.join(" ");
  }

  function render() {
    const list = mine();
    const tbody = document.getElementById("listings-tbody");
    const emptyState = document.getElementById("empty-state");
    if (!list.length) {
      emptyState.classList.remove("d-none");
      tbody.innerHTML = "";
      return;
    }
    emptyState.classList.add("d-none");
    tbody.innerHTML = list.map((h) => `
      <tr>
        <td>${DCUtils.escapeHtml(h.title)}</td>
        <td>${DCUtils.escapeHtml(h.city)}</td>
        <td>${DCUtils.currency(h.budget)}/mois</td>
        <td>${DCUtils.statusBadge(h.moderationStatus)}</td>
        <td>${DCUtils.formatDate(h.createdAt)}</td>
        <td class="text-end">${actionsFor(h)}</td>
      </tr>`).join("");
  }

  async function init() {
    user = await Auth.guard(["proprietaire"]);
    if (!user) return;
    await Layout.mountApp("proprietaire", "annonces", user);
    housing = await DataStore.getHousing();
    render();

    document.getElementById("listings-tbody").addEventListener("click", async (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;
      const listing = housing.find((h) => h.id === btn.dataset.id);
      if (btn.dataset.action === "submit" || btn.dataset.action === "resubmit") {
        listing.moderationStatus = "soumise";
        const users = await DataStore.getUsers();
        const admins = users.filter((u) => u.role === "admin");
        await Promise.all(admins.map((a) => NotificationCenter.push(a.id, {
          type: "annonce_validee",
          title: "Annonce à modérer",
          text: `L'annonce "${listing.title}" attend une validation.`,
          link: "pages/admin/moderation-logements.html",
        })));
        DCUtils.toast("Annonce soumise à la modération.", "success");
      }
      if (btn.dataset.action === "archive") {
        listing.moderationStatus = "archivee";
        DCUtils.toast("Annonce archivée.", "info");
      }
      render();
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
