/**
 * DataStore - unique point d'accès aux données de l'application.
 *
 * Aujourd'hui : lit des fichiers JSON statiques et garde un cache mémoire
 * (les écritures ne modifient que ce cache, elles ne persistent pas au reload).
 * Demain : il suffira de remplacer l'implémentation de `load()` et des
 * méthodes `create/update` par de vrais appels réseau (fetch vers une API
 * Node/Laravel/Django) - le reste de l'application consomme DataStore
 * sans connaître la source réelle des données.
 */
const DataStore = (() => {
  const FILES = {
    users: "users.json",
    mentors: "mentors.json",
    mentees: "mentees.json",
    housing: "housing.json",
    opportunities: "opportunities.json",
    messages: "messages.json",
    reports: "reports.json",
    matchings: "matchings.json",
    resources: "resources.json",
    notifications: "notifications.json",
    staff: "staff.json",
    departments: "departments.json",
    tickets: "tickets.json",
    contactRequests: "contact-requests.json",
    publicTeam: "public-team.json",
    permissions: "permissions.json",
    orgChart: "org-chart.json",
    auditLog: "audit-log.json",
  };

  const cache = {};
  const pending = {};

  function dataUrl(key) {
    const root = window.DC_ROOT || "./";
    return `${root}assets/data/${FILES[key]}`;
  }

  async function load(key) {
    if (cache[key]) return cache[key];
    if (pending[key]) return pending[key];
    pending[key] = fetch(dataUrl(key))
      .then((res) => {
        if (!res.ok) throw new Error(`Chargement impossible : ${key}`);
        return res.json();
      })
      .then((data) => {
        cache[key] = data;
        delete pending[key];
        return data;
      })
      .catch((err) => {
        delete pending[key];
        console.error(err);
        throw err;
      });
    return pending[key];
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
    getMessages: () => load("messages"),
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
    getAuditLog: () => load("auditLog"),

    /** Insère un enregistrement dans le cache en mémoire (simulation d'écriture). */
    async insert(key, record) {
      const collection = await load(key);
      collection.push(record);
      return record;
    },

    /** Met à jour un enregistrement identifié par `id` dans une collection. */
    async update(key, id, patch) {
      const collection = await load(key);
      const item = collection.find((r) => r.id === id);
      if (!item) return null;
      Object.assign(item, patch);
      return item;
    },

    nextId,
  };
})();
