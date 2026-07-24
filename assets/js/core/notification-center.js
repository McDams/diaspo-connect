/**
 * NotificationCenter - centre de notifications par utilisateur.
 * Rendu de la cloche de notification (badge + dropdown) présent sur tous
 * les headers applicatifs, et création de notifications mock (ex: nouvelle
 * demande de matching, nouveau message, annonce validée...).
 */
const NotificationCenter = (() => {
  async function forUser(userId) {
    const all = await DataStore.getNotifications();
    return all.filter((n) => n.userId === userId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  async function unreadCount(userId) {
    const list = await forUser(userId);
    return list.filter((n) => !n.read).length;
  }

  async function markAllRead(userId) {
    const all = await DataStore.getNotifications();
    all.filter((n) => n.userId === userId).forEach((n) => (n.read = true));
  }

  async function push(userId, { type, title, text, link }) {
    const notif = {
      id: DataStore.nextId("notif"),
      userId,
      type,
      title,
      text,
      read: false,
      createdAt: new Date().toISOString(),
      link: link || "#",
    };
    await DataStore.insert("notifications", notif);
    return notif;
  }

  const ICONS = {
    nouvelle_demande: "bi-person-plus-fill",
    nouveau_message: "bi-chat-dots-fill",
    annonce_validee: "bi-house-check-fill",
    signalement_recu: "bi-flag-fill",
    matching_valide: "bi-people-fill",
    offre_validee: "bi-briefcase-fill",
  };

  async function mount(container, userId) {
    const list = await forUser(userId);
    const badge = document.getElementById("dc-notif-badge");
    const count = list.filter((n) => !n.read).length;
    if (badge) badge.classList.toggle("d-none", count === 0);

    if (!list.length) {
      container.innerHTML = `<div class="dc-empty-state py-4">
        <div class="dc-empty-icon mx-auto"><i class="bi bi-bell"></i></div>
        <p class="mb-0 small">Aucune notification pour le moment.</p>
      </div>`;
      return;
    }

    container.innerHTML = list
      .slice(0, 8)
      .map(
        (n) => `
      <a href="${(window.DC_ROOT || "./") + n.link}" class="dc-notif-item d-flex gap-2 text-decoration-none text-body ${n.read ? "" : "unread"}">
        <i class="bi ${ICONS[n.type] || "bi-bell"} text-primary mt-1"></i>
        <div>
          <div class="fw-semibold small">${DCUtils.escapeHtml(n.title)}</div>
          <div class="small text-muted-dc">${DCUtils.escapeHtml(n.text)}</div>
          <div class="small text-muted-dc">${DCUtils.timeAgo(n.createdAt)}</div>
        </div>
      </a>`
      )
      .join("");
  }

  return { forUser, unreadCount, markAllRead, push, mount };
})();
