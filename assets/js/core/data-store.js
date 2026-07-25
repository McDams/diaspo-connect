/**
 * DataStore - unique point d'accès aux données de l'application.
 *
 * Backend réel : chaque méthode appelle l'API Express (/api/...) qui lit/écrit
 * PostgreSQL, avec authentification par cookie de session et permissions
 * appliquées côté serveur (RBAC). Le reste de l'application continue de
 * consommer DataStore exactement comme avant (mêmes noms de méthodes, mêmes
 * formes d'objets retournés) sans savoir que la source a changé - c'était
 * l'intention dès la conception de ce module.
 *
 * Volontairement AUCUN cache : chaque appel `getX()` refait un aller-retour
 * réseau. Un cache aurait masqué les endroits du code qui mutent un objet en
 * mémoire sans jamais appeler `update()`/`insert()` pour le persister (bug
 * réel trouvé et corrigé à plusieurs endroits lors du passage au vrai
 * backend) : sans cache, un tel oubli redevient immédiatement visible (la
 * donnée ne survit pas à un rechargement) plutôt que de sembler fonctionner
 * par accident.
 */
const DataStore = (() => {
  const ENDPOINTS = {
    users: "users", mentors: "mentors", mentees: "mentees", housing: "housing",
    opportunities: "opportunities", reports: "reports", matchings: "matchings",
    resources: "resources", notifications: "notifications", staff: "staff",
    departments: "departments", tickets: "tickets", contactRequests: "contact-requests",
    publicTeam: "public-team", permissions: "permissions", orgChart: "org-chart",
    boards: "boards", lists: "lists", cards: "cards", labels: "labels",
    cardActivity: "card-activity", documents: "documents", announcements: "announcements",
  };

  function apiRoot() {
    return `${window.DC_ROOT || "./"}api/`;
  }

  async function request(path, options = {}) {
    const res = await fetch(`${apiRoot()}${path}`, {
      credentials: "include",
      headers: options.body ? { "Content-Type": "application/json" } : undefined,
      ...options,
    });
    if (!res.ok) {
      let message = `Erreur réseau (${res.status})`;
      try {
        const data = await res.json();
        if (data && data.error) message = data.error;
      } catch (e) { /* réponse non-JSON, on garde le message générique */ }
      if (typeof DCUtils !== "undefined" && DCUtils.toast) DCUtils.toast(message, "danger");
      const err = new Error(message);
      err.status = res.status;
      throw err;
    }
    if (res.status === 204) return null;
    return res.json();
  }

  function load(key) {
    const endpoint = ENDPOINTS[key];
    if (!endpoint) throw new Error(`Ressource inconnue : ${key}`);
    return request(endpoint);
  }

  function nextId(prefix) {
    return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`;
  }

  return {
    getUsers: () => load("users"),
    getMentors: () => load("mentors"),
    getMentees: () => load("mentees"),
    getHousing: () => load("housing"),
    getOpportunities: () => load("opportunities"),
    getMessages: () => request("messages"),
    getReports: () => load("reports"),
    getMatchings: () => load("matchings"),
    getResources: () => load("resources"),
    getNotifications: () => load("notifications"),
    getStaff: () => load("staff"),
    getDepartments: () => load("departments"),
    getTickets: () => load("tickets"),
    getContactRequests: () => load("contactRequests"),
    getPublicTeam: () => load("publicTeam"),
    getPermissions: () => load("permissions"),
    getOrgChart: () => load("orgChart"),
    getAuditLog: () => request("audit-log"),
    getBoards: () => load("boards"),
    getLists: () => load("lists"),
    getCards: () => load("cards"),
    getLabels: () => load("labels"),
    getCardActivity: () => load("cardActivity"),
    getDocuments: () => load("documents"),
    getSettings: () => request("settings/app"),
    getAnnouncements: () => load("announcements"),

    /** Insère un enregistrement (POST authentifié, vérifié par RBAC côté serveur). */
    async insert(key, record) {
      if (key === "auditLog") return request("audit-log", { method: "POST", body: JSON.stringify(record) });
      const endpoint = ENDPOINTS[key];
      if (!endpoint) throw new Error(`Ressource inconnue : ${key}`);
      return request(endpoint, { method: "POST", body: JSON.stringify(record) });
    },

    /** Fusionne un patch dans un enregistrement existant (PUT authentifié). */
    async update(key, id, patch) {
      if (key === "settings") return request(`settings/${id}`, { method: "PUT", body: JSON.stringify(patch) });
      const endpoint = ENDPOINTS[key];
      if (!endpoint) throw new Error(`Ressource inconnue : ${key}`);
      return request(`${endpoint}/${id}`, { method: "PUT", body: JSON.stringify(patch) });
    },

    /** Supprime un enregistrement (DELETE authentifié). */
    async remove(key, id) {
      const endpoint = ENDPOINTS[key];
      if (!endpoint) throw new Error(`Ressource inconnue : ${key}`);
      await request(`${endpoint}/${id}`, { method: "DELETE" });
      return true;
    },

    // Messagerie : relationnelle côté serveur (conversations + messages), pas
    // couverte par le schéma générique insert/update/remove ci-dessus.
    sendMessage: (conversationId, message) => request(`messages/${conversationId}/messages`, { method: "POST", body: JSON.stringify(message) }),
    markMessagesRead: (conversationId, messageIds) => request(`messages/${conversationId}/messages/read`, { method: "PUT", body: JSON.stringify({ messageIds }) }),

    nextId,
  };
})();
