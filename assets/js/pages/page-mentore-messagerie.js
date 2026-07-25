/**
 * Messagerie côté mentoré : rendu délégué à MessagingThread (liste + fil +
 * transport quasi temps réel), branchement spécifique au rôle uniquement.
 */
(function () {
  async function init() {
    const user = await Auth.guard(["mentore"]);
    if (!user) return;
    await Layout.mountApp("mentore", "messagerie", user);

    const [conversations, users] = await Promise.all([DataStore.getMessages(), DataStore.getUsers()]);
    MessagingThread.mount({ conversations, users, currentUser: user });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
