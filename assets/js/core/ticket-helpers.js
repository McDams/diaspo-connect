/**
 * TicketHelpers - libellés et petites fonctions partagées par tous les
 * dashboards internes qui affichent des tickets (secrétariat, conseil,
 * modération, support, partenariats, centre de tickets).
 */
const TicketHelpers = (() => {
  const CATEGORY_LABELS = {
    information_generale: "Information générale",
    dossier_etudiant: "Dossier étudiant",
    matching_parrainage: "Matching / parrainage",
    logement: "Logement",
    emploi: "Emploi / stage / alternance",
    probleme_relationnel: "Problème relationnel",
    support_technique: "Support technique",
    signalement_securite: "Signalement sécurité",
    partenariat: "Partenariat",
    benevolat: "Bénévolat",
    presse_media: "Presse / média",
  };

  const SERVICE_LABELS = {
    direction: "Direction",
    secretariat: "Secrétariat",
    conseil: "Conseil",
    support: "Support",
    moderation: "Modération",
    partenariats: "Partenariats",
    contenu: "Contenu",
    technique: "Technique",
    conformite: "Conformité",
  };

  function categoryLabel(cat) { return CATEGORY_LABELS[cat] || cat; }
  function serviceLabel(svc) { return SERVICE_LABELS[svc] || svc; }

  function isOverdue(ticket) {
    if (!ticket.dueAt || ticket.status === "resolu" || ticket.status === "ferme") return false;
    return new Date(ticket.dueAt) < new Date();
  }

  function assigneeName(ticket, staffList, users) {
    if (!ticket.assignedTo) return "Non assigné";
    const staff = staffList.find((s) => s.id === ticket.assignedTo);
    if (!staff) return "Non assigné";
    const user = users.find((u) => u.id === staff.userId);
    return user ? `${user.firstName} ${user.lastName}` : staff.position;
  }

  return { CATEGORY_LABELS, SERVICE_LABELS, categoryLabel, serviceLabel, isOverdue, assigneeName };
})();
