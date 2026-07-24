/**
 * Checklist - checklist d'arrivée en France, attachée dynamiquement au
 * profil filleul (mentee.checklist). Générée par défaut si absente ; les
 * cases cochées vivent en mémoire dans DataStore le temps de la session,
 * en attendant une vraie persistance côté backend.
 */
const Checklist = (() => {
  const DEFAULT_ITEMS = [
    { id: "vlsts", label: "Valider mon VLS-TS (dans les 3 mois suivant l'arrivée)", done: false },
    { id: "banque", label: "Ouvrir un compte bancaire étudiant", done: false },
    { id: "assurance", label: "Souscrire une assurance habitation", done: false },
    { id: "secu", label: "M'inscrire à la sécurité sociale étudiante", done: false },
    { id: "transport", label: "Obtenir ma carte de transport", done: false },
    { id: "inscription", label: "Finaliser mon inscription administrative à l'établissement", done: false },
    { id: "logement", label: "Trouver et signer mon logement", done: false },
    { id: "mail", label: "Activer ma boîte mail étudiante", done: false },
  ];

  function ensure(mentee) {
    if (!mentee.checklist) {
      mentee.checklist = DEFAULT_ITEMS.map((i) => ({ ...i }));
    }
    return mentee.checklist;
  }

  function progress(mentee) {
    const items = ensure(mentee);
    const done = items.filter((i) => i.done).length;
    return { done, total: items.length, pct: Math.round((done / items.length) * 100) };
  }

  function toggle(mentee, itemId) {
    const items = ensure(mentee);
    const item = items.find((i) => i.id === itemId);
    if (item) item.done = !item.done;
    return items;
  }

  return { ensure, progress, toggle };
})();
