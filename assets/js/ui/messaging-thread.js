/**
 * MessagingThread - composant de messagerie partagé mentor <-> mentoré.
 * Rendu de la liste des conversations + du fil actif, branché sur
 * MessagingTransport pour l'aspect "quasi temps réel" : réception de
 * messages sans rechargement, indicateur "en train d'écrire", accusés de
 * lecture, et notification (toast + centre de notifications) pour les
 * messages reçus hors de la conversation actuellement ouverte.
 */
const MessagingThread = (() => {
  let conversations, users, currentUser, activeConvId, unsubscribe, typingUserId;

  function otherParticipant(conv) {
    const otherId = conv.participants.find((p) => p !== currentUser.id);
    return users.find((u) => u.id === otherId);
  }

  function unreadCount(conv) {
    return conv.messages.filter((m) => m.senderId !== currentUser.id && !m.read).length;
  }

  function renderList() {
    const host = document.getElementById("conv-list");
    const mine = conversations.filter((c) => c.participants.includes(currentUser.id));
    if (!mine.length) {
      host.innerHTML = `<div class="dc-empty-state py-4"><p class="small mb-0">Aucune conversation pour le moment.</p></div>`;
      return;
    }
    host.innerHTML = mine
      .slice()
      .sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt))
      .map((c) => {
        const other = otherParticipant(c);
        const last = c.messages[c.messages.length - 1];
        const unread = unreadCount(c);
        return `<div class="dc-chat-list-item ${c.id === activeConvId ? "active" : ""}" data-id="${c.id}">
          <div class="d-flex gap-2 align-items-center">
            <span class="dc-avatar dc-avatar-sm" style="background:${other.avatarColor}">${other.avatarInitials}</span>
            <div class="flex-grow-1 overflow-hidden">
              <div class="fw-semibold small">${DCUtils.escapeHtml(other.firstName)} ${DCUtils.escapeHtml(other.lastName)}</div>
              <div class="small text-muted-dc text-truncate" style="max-width:170px;">${DCUtils.escapeHtml(last?.text || "")}</div>
            </div>
            ${unread ? `<span class="dc-badge dc-badge-info">${unread}</span>` : ""}
          </div>
        </div>`;
      }).join("");
  }

  function messageTicks(m) {
    if (m.senderId !== currentUser.id) return "";
    if (m.read) return `<i class="bi bi-check2-all text-primary" title="Lu${m.readAt ? " à " + DCUtils.formatDateTime(m.readAt) : ""}"></i>`;
    return `<i class="bi bi-check2" title="Envoyé"></i>`;
  }

  function markIncomingAsRead(conv) {
    const unread = conv.messages.filter((m) => m.senderId !== currentUser.id && !m.read);
    if (!unread.length) return;
    const now = new Date().toISOString();
    unread.forEach((m) => { m.read = true; m.readAt = now; });
    const ids = unread.map((m) => m.id);
    DataStore.markMessagesRead(conv.id, ids).catch(() => {});
    MessagingTransport.notifyRead(conv.id, currentUser.id, ids);
  }

  function renderTypingRow(conv) {
    const row = document.getElementById("typing-row");
    if (!row) return;
    if (!typingUserId || typingUserId === currentUser.id) { row.innerHTML = ""; return; }
    const other = otherParticipant(conv);
    if (!other || other.id !== typingUserId) { row.innerHTML = ""; return; }
    row.innerHTML = `<div class="dc-typing-indicator"><span></span><span></span><span></span> ${DCUtils.escapeHtml(other.firstName)} est en train d'écrire…</div>`;
  }

  function renderThread() {
    const conv = conversations.find((c) => c.id === activeConvId);
    const panel = document.getElementById("thread-panel");
    if (!conv) {
      panel.innerHTML = `<div class="dc-empty-state py-5"><div class="dc-empty-icon mx-auto"><i class="bi bi-chat"></i></div><p class="small mb-0">Sélectionnez une conversation.</p></div>`;
      return;
    }
    const other = otherParticipant(conv);
    panel.innerHTML = `
      <div class="d-flex align-items-center gap-2 border-bottom pb-3 mb-3">
        <span class="dc-avatar dc-avatar-sm" style="background:${other.avatarColor}">${other.avatarInitials}</span>
        <div>
          <div class="fw-semibold">${DCUtils.escapeHtml(other.firstName)} ${DCUtils.escapeHtml(other.lastName)}</div>
          <div class="small text-muted-dc" id="thread-status">Conversation encadrée par DiaspoConnect</div>
        </div>
      </div>
      <div class="dc-moderation-note mb-2"><i class="bi bi-shield-check me-1"></i>Cette conversation peut être consultée par l'administration en cas de signalement.</div>
      <div id="thread-messages" class="d-flex flex-column gap-2 mb-1" style="max-height:400px; overflow-y:auto;"></div>
      <div id="typing-row"></div>
      <form id="message-form" class="d-flex gap-2 mt-2">
        <label for="message-input" class="visually-hidden">Votre message</label>
        <textarea id="message-input" class="form-control" rows="1" placeholder="Écrire un message..." required></textarea>
        <button type="submit" class="btn btn-primary"><i class="bi bi-send"></i></button>
      </form>`;

    markIncomingAsRead(conv);
    renderMessages(conv);

    let typingThrottle = 0;
    document.getElementById("message-input").addEventListener("input", () => {
      const now = Date.now();
      if (now - typingThrottle > 1200) {
        MessagingTransport.notifyTyping(conv.id, currentUser.id);
        typingThrottle = now;
      }
    });

    document.getElementById("message-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = document.getElementById("message-input");
      const text = input.value.trim();
      if (!text) return;
      const message = { id: DataStore.nextId("m"), senderId: currentUser.id, text, sentAt: new Date().toISOString(), flagged: false, read: false };
      conv.messages.push(message);
      conv.lastMessageAt = message.sentAt;
      input.value = "";
      await DataStore.sendMessage(conv.id, message);
      MessagingTransport.notifyNewMessage(conv.id, message);
      renderMessages(conv);
      renderList();
    });
  }

  function renderMessages(conv) {
    const msgHost = document.getElementById("thread-messages");
    if (!msgHost) return;
    msgHost.innerHTML = conv.messages.map((m) => {
      const out = m.senderId === currentUser.id;
      return `<div class="d-flex flex-column ${out ? "align-items-end" : "align-items-start"}">
        <div class="dc-bubble ${out ? "dc-bubble-out" : "dc-bubble-in"} ${m.flagged ? "dc-bubble-flagged" : ""}">${DCUtils.escapeHtml(m.text)}</div>
        <div class="d-flex align-items-center gap-2 mt-1">
          <span class="small text-muted-dc">${DCUtils.timeAgo(m.sentAt)}</span>
          ${messageTicks(m)}
          ${!out ? `<button class="btn btn-link btn-sm text-danger p-0 small" data-report-msg="${m.id}"><i class="bi bi-flag"></i> Signaler</button>` : ""}
        </div>
      </div>`;
    }).join("");
    msgHost.scrollTop = msgHost.scrollHeight;
    msgHost.querySelectorAll("[data-report-msg]").forEach((btn) => {
      btn.addEventListener("click", () => {
        ReportModal.open({ reporterId: currentUser.id, targetType: "message", targetId: btn.dataset.reportMsg, conversationId: conv.id });
      });
    });
  }

  /**
   * Filet de secours (`onPoll`) : revérifie périodiquement la source canonique
   * pour rattraper un évènement BroadcastChannel manqué (onglet en arrière-plan
   * throttlé, navigateur sans BroadcastChannel...). Fusionne dans `conv.messages`
   * tout message présent côté source mais absent localement. Le jour où
   * `DataStore.load()` est remplacé par un vrai appel réseau, ce même code
   * recommencera à détecter de véritables messages arrivés d'ailleurs.
   */
  async function pollResync(convId) {
    const canonical = await DataStore.getMessages();
    const canonicalConv = canonical.find((c) => c.id === convId);
    const conv = conversations.find((c) => c.id === convId);
    if (!canonicalConv || !conv) return false;
    const missing = canonicalConv.messages.filter((cm) => !conv.messages.some((m) => m.id === cm.id));
    if (!missing.length) return false;
    conv.messages.push(...missing);
    conv.lastMessageAt = canonicalConv.lastMessageAt;
    return true;
  }

  function subscribeActive() {
    if (unsubscribe) unsubscribe();
    typingUserId = null;
    if (!activeConvId) return;
    unsubscribe = MessagingTransport.subscribe(activeConvId, {
      onMessage: async (message) => {
        const conv = conversations.find((c) => c.id === activeConvId);
        if (!conv || conv.messages.some((m) => m.id === message.id)) return;
        conv.messages.push(message);
        conv.lastMessageAt = message.sentAt;
        markIncomingAsRead(conv);
        renderMessages(conv);
        renderList();
        DCUtils.toast(`Nouveau message de ${otherParticipant(conv).firstName}.`, "info");
      },
      onTyping: (userId) => {
        typingUserId = userId;
        const conv = conversations.find((c) => c.id === activeConvId);
        if (conv) renderTypingRow(conv);
      },
      onRead: (userId, messageIds) => {
        const conv = conversations.find((c) => c.id === activeConvId);
        if (!conv) return;
        const now = new Date().toISOString();
        conv.messages.forEach((m) => { if (messageIds.includes(m.id)) { m.read = true; m.readAt = now; } });
        renderMessages(conv);
      },
      onPoll: async () => {
        const conv = conversations.find((c) => c.id === activeConvId);
        if (!conv) return;
        const changed = await pollResync(activeConvId);
        if (changed) { markIncomingAsRead(conv); renderMessages(conv); renderList(); }
      },
    });
  }

  /** Reçoit des messages arrivés sur une conversation NON active : notifie sans changer la vue. */
  function subscribeInactiveConversations() {
    conversations.forEach((conv) => {
      if (!conv.participants.includes(currentUser.id)) return;
      MessagingTransport.subscribe(conv.id, {
        onMessage: async (message) => {
          if (conv.id === activeConvId) return; // déjà géré par subscribeActive
          if (conv.messages.some((m) => m.id === message.id)) return;
          conv.messages.push(message);
          conv.lastMessageAt = message.sentAt;
          renderList();
          const other = otherParticipant(conv);
          DCUtils.toast(`Nouveau message de ${other.firstName} ${other.lastName}.`, "info");
          await NotificationCenter.push(currentUser.id, {
            type: "nouveau_message", title: "Nouveau message",
            text: `${other.firstName} ${other.lastName} vous a envoyé un message.`,
            link: "messagerie.html",
          });
        },
        onPoll: async () => {
          if (conv.id === activeConvId) return;
          const changed = await pollResync(conv.id);
          if (!changed) return;
          renderList();
          const other = otherParticipant(conv);
          await NotificationCenter.push(currentUser.id, {
            type: "nouveau_message", title: "Nouveau message",
            text: `${other.firstName} ${other.lastName} vous a envoyé un message.`,
            link: "messagerie.html",
          });
        },
      });
    });
  }

  function selectConversation(id) {
    activeConvId = id;
    renderThread(); // marque les messages entrants comme lus avant de recalculer les badges
    renderList();
    subscribeActive();
  }

  /** mount({ conversations, users, currentUser }) - à appeler après le guard de page. */
  function mount(data) {
    ({ conversations, users, currentUser } = data);
    const mine = conversations.filter((c) => c.participants.includes(currentUser.id));
    activeConvId = mine[0]?.id || null;

    renderThread(); // marque les messages entrants comme lus avant de recalculer les badges
    renderList();
    subscribeActive();
    subscribeInactiveConversations();

    document.getElementById("conv-list").addEventListener("click", (e) => {
      const item = e.target.closest("[data-id]");
      if (!item) return;
      selectConversation(item.dataset.id);
    });

    window.addEventListener("beforeunload", () => { if (unsubscribe) unsubscribe(); });
  }

  return { mount };
})();
