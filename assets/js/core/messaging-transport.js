/**
 * MessagingTransport - couche de transport temps réel pour la messagerie.
 *
 * Aujourd'hui (prototype sans backend) : un `BroadcastChannel` propage les
 * évènements instantanément entre onglets de la même origine (message envoyé,
 * "en train d'écrire", accusé de lecture), complété par un polling de secours
 * qui revérifie périodiquement DataStore pour couvrir le cas où un seul
 * onglet est ouvert (ex. une carte/un message créé ailleurs dans la session).
 *
 * Demain (vrai backend) : remplacer uniquement `publish()`/`onEvent()` par un
 * client WebSocket ou un EventSource (SSE) qui pousse les mêmes formes
 * d'évènements ({type, conversationId, ...}). Aucune page de messagerie n'a
 * à changer : elles ne consomment que `subscribe()`, `notifyNewMessage()`,
 * `notifyTyping()` et `notifyRead()`.
 */
const MessagingTransport = (() => {
  const CHANNEL_NAME = "dc-messaging";
  const POLL_INTERVAL_MS = 4000;
  const TYPING_TTL_MS = 3000;

  let channel = null;
  function getChannel() {
    if (channel === null) {
      channel = "BroadcastChannel" in window ? new BroadcastChannel(CHANNEL_NAME) : false;
    }
    return channel || null;
  }

  function publish(event) {
    const ch = getChannel();
    if (ch) ch.postMessage({ ...event, __from: TAB_ID });
  }

  const TAB_ID = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  function onEvent(handler) {
    const ch = getChannel();
    if (!ch) return () => {};
    const listener = (e) => { if (e.data && e.data.__from !== TAB_ID) handler(e.data); };
    ch.addEventListener("message", listener);
    return () => ch.removeEventListener("message", listener);
  }

  function notifyNewMessage(conversationId, message) {
    publish({ type: "message", conversationId, message });
  }
  function notifyTyping(conversationId, userId) {
    publish({ type: "typing", conversationId, userId, at: Date.now() });
  }
  function notifyRead(conversationId, userId, messageIds) {
    publish({ type: "read", conversationId, userId, messageIds });
  }

  /**
   * S'abonne aux évènements d'une conversation.
   * handlers = { onMessage(msg), onTyping(userId), onRead(userId, messageIds), onPoll() }
   * Retourne une fonction de désabonnement à appeler en quittant la vue.
   */
  function subscribe(conversationId, handlers) {
    let typingTimer = null;
    const unsubChannel = onEvent((evt) => {
      if (evt.conversationId !== conversationId) return;
      if (evt.type === "message" && handlers.onMessage) handlers.onMessage(evt.message);
      if (evt.type === "typing" && handlers.onTyping) {
        handlers.onTyping(evt.userId);
        clearTimeout(typingTimer);
        typingTimer = setTimeout(() => handlers.onTyping(null), TYPING_TTL_MS);
      }
      if (evt.type === "read" && handlers.onRead) handlers.onRead(evt.userId, evt.messageIds);
    });
    const pollTimer = handlers.onPoll ? setInterval(() => handlers.onPoll(), POLL_INTERVAL_MS) : null;
    return () => {
      unsubChannel();
      clearTimeout(typingTimer);
      if (pollTimer) clearInterval(pollTimer);
    };
  }

  return { notifyNewMessage, notifyTyping, notifyRead, subscribe };
})();
