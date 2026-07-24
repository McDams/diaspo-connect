/**
 * Auth - authentification simulée.
 *
 * La session (userId + role) est gardée en sessionStorage : c'est volontaire
 * et limité à la durée de l'onglet, uniquement pour simuler "être connecté"
 * le temps de la démo. Ce n'est PAS le mécanisme de persistance des données
 * métier (celles-ci vivent dans DataStore). Le jour où un vrai backend
 * existe, Auth.login()/Auth.logout() seront remplacés par des appels à une
 * API d'authentification (JWT / cookie de session) sans changer l'interface
 * publique de cet objet (login, logout, getSession, getCurrentUser, guard).
 */
const Auth = (() => {
  const SESSION_KEY = "dc_session";

  function getSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function setSession(session) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  /**
   * Connexion simulée : vérifie le format de l'email et une longueur minimale
   * de mot de passe (aucune vérification réelle de mot de passe côté prototype),
   * puis cherche l'utilisateur correspondant dans les données mock.
   */
  async function login(email, password) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { ok: false, message: "Adresse email invalide." };
    }
    if (!password || password.length < 6) {
      return { ok: false, message: "Le mot de passe doit contenir au moins 6 caractères." };
    }
    const users = await DataStore.getUsers();
    const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      return { ok: false, message: "Aucun compte ne correspond à cet email sur cette démo." };
    }
    if (user.status === "suspendu") {
      return { ok: false, message: "Ce compte a été suspendu par l'administration. Contactez le support." };
    }
    setSession({ userId: user.id, role: user.role });
    return { ok: true, user };
  }

  function logout() {
    clearSession();
    window.location.href = (window.DC_ROOT || "./") + "index.html";
  }

  async function getCurrentUser() {
    const session = getSession();
    if (!session) return null;
    const users = await DataStore.getUsers();
    return users.find((u) => u.id === session.userId) || null;
  }

  /**
   * Protège une page : redirige vers la connexion si non authentifié, ou
   * vers le dashboard du rôle réel si le rôle ne correspond pas à la page.
   */
  async function guard(allowedRoles) {
    const session = getSession();
    const root = window.DC_ROOT || "./";
    if (!session) {
      window.location.href = `${root}pages/public/login.html`;
      return null;
    }
    if (allowedRoles && !allowedRoles.includes(session.role)) {
      window.location.href = `${root}pages/${session.role}/dashboard.html`;
      return null;
    }
    return getCurrentUser();
  }

  /** Crée un nouvel utilisateur mock (inscription) et ouvre sa session. */
  async function register(baseUser) {
    const users = await DataStore.getUsers();
    if (users.some((u) => u.email.toLowerCase() === baseUser.email.toLowerCase())) {
      return { ok: false, message: "Un compte existe déjà avec cet email." };
    }
    const id = DataStore.nextId("u");
    const initials = (baseUser.firstName[0] + baseUser.lastName[0]).toUpperCase();
    const user = Object.assign({
      id,
      status: "actif",
      verified: false,
      avatarInitials: initials,
      avatarColor: DCUtils.initialsColor(baseUser.email),
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    }, baseUser);
    await DataStore.insert("users", user);
    setSession({ userId: user.id, role: user.role });
    return { ok: true, user };
  }

  return { login, logout, register, getSession, getCurrentUser, guard };
})();
