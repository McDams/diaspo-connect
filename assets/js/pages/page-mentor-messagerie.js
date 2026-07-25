/**
 * Messagerie côté mentor - même logique que côté mentoré :
 * conversation encadrée, signalement possible sur chaque message reçu.
 */
(function () {
  let conversations, users, currentUser, activeConvId;

  function otherParticipant(conv) {
    const otherId = conv.participants.find((p) => p !== currentUser.id);
    return users.find((u) => u.id === otherId);
  }

  function renderList() {
    const host = document.getElementById("conv-list");
    const mine = conversations.filter((c) => c.participants.includes(currentUser.id));
    if (!mine.length) {
      host.innerHTML = `<div class="dc-empty-state py-4"><p class="small mb-0">Aucune conversation pour le moment.</p></div>`;
      return;
    }
    host.innerHTML = mine.map((c) => {
      const other = otherParticipant(c);
      const last = c.messages[c.messages.length - 1];
      return `<div class="dc-chat-list-item ${c.id === activeConvId ? "active" : ""}" data-id="${c.id}">
        <div class="d-flex gap-2 align-items-center">
          <span class="dc-avatar dc-avatar-sm" style="background:${other.avatarColor}">${other.avatarInitials}</span>
          <div class="flex-grow-1 overflow-hidden">
            <div class="fw-semibold small">${DCUtils.escapeHtml(other.firstName)} ${DCUtils.escapeHtml(other.lastName)}</div>
            <div class="small text-muted-dc text-truncate" style="max-width:180px;">${DCUtils.escapeHtml(last?.text || "")}</div>
          </div>
        </div>
      </div>`;
    }).join("");
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
          <div class="small text-muted-dc">Conversation encadrée par DiaspoConnect</div>
        </div>
      </div>
      <div class="dc-moderation-note mb-2"><i class="bi bi-shield-check me-1"></i>Cette conversation peut être consultée par l'administration en cas de signalement.</div>
      <div id="thread-messages" class="d-flex flex-column gap-2 mb-3" style="max-height:400px; overflow-y:auto;"></div>
      <form id="message-form" class="d-flex gap-2">
        <label for="message-input" class="visually-hidden">Votre message</label>
        <textarea id="message-input" class="form-control" rows="1" placeholder="Écrire un message..." required></textarea>
        <button type="submit" class="btn btn-primary"><i class="bi bi-send"></i></button>
      </form>`;

    const msgHost = document.getElementById("thread-messages");
    msgHost.innerHTML = conv.messages.map((m) => {
      const out = m.senderId === currentUser.id;
      return `<div class="d-flex flex-column ${out ? "align-items-end" : "align-items-start"}">
        <div class="dc-bubble ${out ? "dc-bubble-out" : "dc-bubble-in"} ${m.flagged ? "dc-bubble-flagged" : ""}">${DCUtils.escapeHtml(m.text)}</div>
        <div class="d-flex align-items-center gap-2 mt-1">
          <span class="small text-muted-dc">${DCUtils.timeAgo(m.sentAt)}</span>
          ${!out ? `<button class="btn btn-link btn-sm text-danger p-0 small" data-report-msg="${m.id}"><i class="bi bi-flag"></i> Signaler</button>` : ""}
        </div>
      </div>`;
    }).join("");
    msgHost.scrollTop = msgHost.scrollHeight;

    document.getElementById("message-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const input = document.getElementById("message-input");
      const text = input.value.trim();
      if (!text) return;
      conv.messages.push({ id: DataStore.nextId("m"), senderId: currentUser.id, text, sentAt: new Date().toISOString(), flagged: false });
      conv.lastMessageAt = new Date().toISOString();
      input.value = "";
      renderThread();
      renderList();
    });

    msgHost.querySelectorAll("[data-report-msg]").forEach((btn) => {
      btn.addEventListener("click", () => {
        ReportModal.open({ reporterId: currentUser.id, targetType: "message", targetId: btn.dataset.reportMsg, conversationId: conv.id });
      });
    });
  }

  async function init() {
    const user = await Auth.guard(["mentor"]);
    if (!user) return;
    await Layout.mountApp("mentor", "messagerie", user);
    currentUser = user;

    [conversations, users] = await Promise.all([DataStore.getMessages(), DataStore.getUsers()]);
    const mine = conversations.filter((c) => c.participants.includes(user.id));
    activeConvId = mine[0]?.id || null;

    renderList();
    renderThread();

    document.getElementById("conv-list").addEventListener("click", (e) => {
      const item = e.target.closest("[data-id]");
      if (!item) return;
      activeConvId = item.dataset.id;
      renderList();
      renderThread();
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
