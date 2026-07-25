/**
 * Auth - authentification réelle (API + cookie de session httpOnly côté serveur).
 *
 * Chaque page (rechargement complet, pas de SPA) mémorise le résultat du
 * premier appel à /api/auth/session pour la durée de sa propre vie via
 * `sessionPromise` ci-dessous, afin d'éviter des appels réseau redondants
 * si plusieurs fonctions (guard, StaffGuard, bandeau d'incarnation...)
 * consultent la session dans le même chargement de page.
 */
const Auth = (() => {
  function apiRoot() {
    return `${window.DC_ROOT || "./"}api/`;
  }

  let sessionPromise = null;

  async function fetchSession() {
    if (!sessionPromise) {
      sessionPromise = fetch(`${apiRoot()}auth/session`, { credentials: "include" })
        .then((res) => (res.ok ? res.json() : { user: null, impersonation: null }))
        .catch(() => ({ user: null, impersonation: null }));
    }
    return sessionPromise;
  }

  function resetSessionCache() {
    sessionPromise = null;
  }

  /** {userId, role} ou null - même forme que l'ancienne session sessionStorage. */
  async function getSession() {
    const { user } = await fetchSession();
    return user ? { userId: user.id, role: user.role } : null;
  }

  async function getCurrentUser() {
    const { user } = await fetchSession();
    return user || null;
  }

  async function getImpersonationInfo() {
    const { impersonation } = await fetchSession();
    return impersonation || null;
  }

  async function login(email, password) {
    const res = await fetch(`${apiRoot()}auth/login`, {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (data.ok) resetSessionCache();
    return data;
  }

  async function logout() {
    await fetch(`${apiRoot()}auth/logout`, { method: "POST", credentials: "include" });
    resetSessionCache();
    window.location.href = (window.DC_ROOT || "./") + "index.html";
  }

  async function register(baseUser) {
    const res = await fetch(`${apiRoot()}auth/register`, {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify(baseUser),
    });
    const data = await res.json();
    if (data.ok) resetSessionCache();
    return data;
  }

  /**
   * Protège une page : redirige vers la connexion si non authentifié, ou
   * vers le dashboard du rôle réel si le rôle ne correspond pas à la page.
   */
  async function guard(allowedRoles) {
    const session = await getSession();
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

  // --- Impersonation (admin uniquement) ------------------------------------
  //
  // Démarrage/arrêt réels côté serveur (session remplacée + trace d'audit
  // dérivée de l'identité authentifiée, jamais du client). Après ces deux
  // opérations, l'appelant redirige toujours vers une nouvelle page, qui
  // repartira d'un `sessionPromise` neuf - inutile de resynchroniser le
  // cache local ici.

  async function startImpersonation(targetUserId) {
    const res = await fetch(`${apiRoot()}auth/impersonate/${targetUserId}`, { method: "POST", credentials: "include" });
    const data = await res.json();
    if (data.ok) resetSessionCache();
    return data;
  }

  async function stopImpersonation() {
    const res = await fetch(`${apiRoot()}auth/impersonate/stop`, { method: "POST", credentials: "include" });
    if (!res.ok) return null;
    resetSessionCache();
    return res.json();
  }

  return { login, logout, register, getSession, getCurrentUser, guard, startImpersonation, stopImpersonation, getImpersonationInfo };
})();
