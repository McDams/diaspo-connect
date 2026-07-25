/**
 * Dashboard Conseil - partagé par les 3 spécialités (démarches / logement /
 * emploi). Le contenu affiché s'adapte à l'advisorType du conseiller
 * connecté : "les conseillers voient seulement les dossiers qui leur sont
 * affectés ou pertinents pour leur domaine" (règle métier).
 */
(function () {
  const DOMAIN_LABELS = { demarches: "démarches administratives", logement: "logement", emploi: "emploi / stage / alternance" };
  const DOMAIN_CATEGORY = { demarches: ["dossier_etudiant", "matching_mentorat", "information_generale"], logement: ["logement"], emploi: ["emploi"] };

  async function init() {
    const ctx = await StaffGuard.require("advisors-dashboard");
    if (!ctx) return;
    await Layout.mountStaffApp("advisors-dashboard", ctx);
    document.getElementById("welcome-name").textContent = ctx.user.firstName;

    const domain = ctx.staff.advisorType || "demarches";
    document.getElementById("domain-label").textContent = DOMAIN_LABELS[domain];

    const [tickets, staffList, users, mentees, housing, opportunities] = await Promise.all([
      DataStore.getTickets(), DataStore.getStaff(), DataStore.getUsers(), DataStore.getMentees(),
      DataStore.getHousing(), DataStore.getOpportunities(),
    ]);

    const myTickets = tickets.filter((t) => t.assignedTo === ctx.staff.id || (!t.assignedTo && t.targetService === "conseil" && DOMAIN_CATEGORY[domain].includes(t.category)));
    document.getElementById("kpi-assigned").textContent = myTickets.filter((t) => !["resolu", "ferme"].includes(t.status)).length;
    document.getElementById("kpi-resolved").textContent = myTickets.filter((t) => ["resolu", "ferme"].includes(t.status)).length;

    document.getElementById("assigned-tbody").innerHTML = myTickets.length ? myTickets.map((t) => `<tr>
      <td class="fw-semibold small">${t.id}</td>
      <td>${DCUtils.escapeHtml(t.requesterName)}</td>
      <td>${TicketHelpers.categoryLabel(t.category)}</td>
      <td>${DCUtils.priorityBadge(t.priority)}</td>
      <td>${DCUtils.statusBadge(t.status)}</td>
      <td class="text-end"><a href="tickets-management.html?id=${t.id}" class="btn btn-sm btn-outline-primary">Ouvrir</a></td>
    </tr>`).join("") : `<tr><td colspan="6"><div class="dc-empty-state py-3"><p class="small mb-0">Aucun dossier affecté pour le moment.</p></div></td></tr>`;

    // Entretiens à prévoir : simulation à partir des tickets en attente de réponse
    const meetings = myTickets.filter((t) => t.status === "en_attente_reponse" || t.status === "en_cours").slice(0, 4);
    document.getElementById("meetings-list").innerHTML = meetings.length ? meetings.map((t) => `
      <div class="d-flex justify-content-between align-items-center py-2 border-bottom">
        <div><span class="small fw-semibold">${DCUtils.escapeHtml(t.requesterName)}</span><div class="small text-muted-dc">${TicketHelpers.categoryLabel(t.category)}</div></div>
        <span class="small text-muted-dc">À planifier</span>
      </div>`).join("") : `<div class="dc-empty-state py-3"><p class="small mb-0">Aucun entretien à prévoir.</p></div>`;

    // Sections spécifiques au domaine
    if (domain === "demarches") {
      document.getElementById("section-demarches").classList.remove("d-none");
      const menteesFollowed = mentees.filter((m) => myTickets.some((t) => t.requesterEmail === users.find((u) => u.id === m.userId)?.email));
      document.getElementById("checklist-followup").innerHTML = menteesFollowed.length ? menteesFollowed.map((m) => {
        const u = users.find((x) => x.id === m.userId);
        const items = m.checklist || [];
        const done = items.filter((i) => i.done).length;
        const pct = items.length ? Math.round((done / items.length) * 100) : 0;
        return `<div class="d-flex align-items-center gap-2 py-2 border-bottom">
          <span class="dc-avatar dc-avatar-sm" style="background:${u.avatarColor}">${u.avatarInitials}</span>
          <div class="flex-grow-1"><div class="small fw-semibold">${DCUtils.escapeHtml(u.firstName)} ${DCUtils.escapeHtml(u.lastName)}</div>
          <div class="progress" style="height:5px;"><div class="progress-bar bg-primary" style="width:${pct}%"></div></div></div>
          <span class="small text-muted-dc">${pct}%</span>
        </div>`;
      }).join("") : `<div class="dc-empty-state py-3"><p class="small mb-0">Aucun mentoré suivi pour le moment.</p></div>`;
    }

    if (domain === "logement") {
      document.getElementById("section-logement").classList.remove("d-none");
      const adapted = housing.filter((h) => h.moderationStatus === "validee").slice(0, 4);
      document.getElementById("housing-adapted").innerHTML = adapted.map((h) => `
        <div class="d-flex justify-content-between align-items-center py-2 border-bottom">
          <div><span class="small fw-semibold">${DCUtils.escapeHtml(h.title)}</span><div class="small text-muted-dc">${DCUtils.escapeHtml(h.city)} · ${DCUtils.currency(h.budget)}</div></div>
          ${DCUtils.statusBadge(h.moderationStatus)}
        </div>`).join("");
      const scamAlerts = housing.filter((h) => h.moderationStatus === "rejetee" || h.moderationStatus === "soumise");
      document.getElementById("scam-alerts").innerHTML = scamAlerts.length ? scamAlerts.map((h) => `
        <div class="d-flex justify-content-between align-items-center py-2 border-bottom">
          <div><span class="small fw-semibold">${DCUtils.escapeHtml(h.title)}</span><div class="small text-muted-dc">${DCUtils.escapeHtml(h.city)}</div></div>
          ${DCUtils.statusBadge(h.moderationStatus)}
        </div>`).join("") : `<div class="dc-empty-state py-3"><p class="small mb-0">Aucune alerte en cours.</p></div>`;
    }

    if (domain === "emploi") {
      document.getElementById("section-emploi").classList.remove("d-none");
      const recommended = opportunities.filter((o) => o.moderationStatus === "validee").slice(0, 4);
      document.getElementById("opp-recommended").innerHTML = recommended.map((o) => `
        <div class="d-flex justify-content-between align-items-center py-2 border-bottom">
          <div><span class="small fw-semibold">${DCUtils.escapeHtml(o.title)}</span><div class="small text-muted-dc">${DCUtils.escapeHtml(o.city)}</div></div>
          <span class="small text-muted-dc">${DCUtils.escapeHtml(o.compensation)}</span>
        </div>`).join("");
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
