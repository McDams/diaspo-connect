(function () {
  let data = {};

  function section(title, icon, items) {
    if (!items.length) return "";
    return `<div class="dc-card p-3 mb-3">
      <h6 class="mb-2"><i class="bi ${icon} text-primary me-2"></i>${title} <span class="badge text-bg-light border">${items.length}</span></h6>
      <ul class="list-unstyled small mb-0">${items.join("")}</ul>
    </div>`;
  }

  function run(query) {
    const host = document.getElementById("search-results");
    const q = query.trim().toLowerCase();
    if (q.length < 2) { host.innerHTML = `<p class="text-muted-dc small">Saisissez au moins 2 caractères.</p>`; return; }

    const users = data.users.filter((u) => `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(q)).slice(0, 8)
      .map((u) => `<li class="mb-1"><a href="utilisateurs.html">${DCUtils.escapeHtml(u.firstName)} ${DCUtils.escapeHtml(u.lastName)}</a> <span class="text-muted-dc">— ${DCUtils.escapeHtml(u.email)} (${u.role})</span></li>`);

    const housing = data.housing.filter((h) => h.title.toLowerCase().includes(q) || h.city.toLowerCase().includes(q)).slice(0, 8)
      .map((h) => `<li class="mb-1"><a href="moderation-logements.html">${DCUtils.escapeHtml(h.title)}</a> <span class="text-muted-dc">— ${DCUtils.escapeHtml(h.city)}</span></li>`);

    const opportunities = data.opportunities.filter((o) => o.title.toLowerCase().includes(q)).slice(0, 8)
      .map((o) => `<li class="mb-1"><a href="moderation-opportunites.html">${DCUtils.escapeHtml(o.title)}</a></li>`);

    const tickets = data.tickets.filter((t) => `${t.id} ${t.requesterName}`.toLowerCase().includes(q)).slice(0, 8)
      .map((t) => `<li class="mb-1"><a href="tickets.html">${t.id}</a> <span class="text-muted-dc">— ${DCUtils.escapeHtml(t.requesterName)}</span></li>`);

    const cards = data.cards.filter((c) => c.title.toLowerCase().includes(q)).slice(0, 8)
      .map((c) => `<li class="mb-1"><a href="kanban.html">${DCUtils.escapeHtml(c.title)}</a></li>`);

    const total = users.length + housing.length + opportunities.length + tickets.length + cards.length;
    host.innerHTML = total
      ? [
          section("Utilisateurs", "bi-people", users),
          section("Logements", "bi-house-door", housing),
          section("Opportunités", "bi-briefcase", opportunities),
          section("Tickets", "bi-ticket-perforated", tickets),
          section("Cartes Kanban", "bi-kanban", cards),
        ].join("")
      : `<div class="dc-empty-state py-4"><p class="small mb-0">Aucun résultat pour « ${DCUtils.escapeHtml(query)} ».</p></div>`;
  }

  async function init() {
    const admin = await Auth.guard(["admin"]);
    if (!admin) return;
    await Layout.mountApp("admin", "search", admin);

    const [users, housing, opportunities, tickets, cards] = await Promise.all([
      DataStore.getUsers(), DataStore.getHousing(), DataStore.getOpportunities(), DataStore.getTickets(), DataStore.getCards(),
    ]);
    data = { users, housing, opportunities, tickets, cards };

    document.getElementById("search-input").addEventListener("input", DCUtils.debounce((e) => run(e.target.value), 200));
  }

  document.addEventListener("DOMContentLoaded", init);
})();
