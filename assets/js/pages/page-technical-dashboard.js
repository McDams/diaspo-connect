(function () {
  const MODULES_STATUS = [
    { name: "Authentification (Auth)", status: "opérationnel" },
    { name: "Couche de données (DataStore)", status: "opérationnel" },
    { name: "Moteur de matching", status: "opérationnel" },
    { name: "Messagerie", status: "opérationnel" },
    { name: "Centre de notifications", status: "opérationnel" },
    { name: "Centre de tickets", status: "opérationnel" },
  ];

  const MOCK_LOGS = [
    { level: "info", text: "Chargement des données JSON réussi (10 collections métier + 8 collections internes)." },
    { level: "info", text: "Session filleul ouverte (rosine.agossou@mail.com)." },
    { level: "warn", text: "Tentative de connexion avec un email inconnu." },
    { level: "info", text: "Nouveau ticket créé via formulaire de contact (service : secretariat)." },
    { level: "error", text: "Échec simulé : requête réseau annulée (utilisateur a changé de page)." },
    { level: "info", text: "Annonce logement validée par l'équipe de modération." },
  ];

  async function init() {
    const ctx = await StaffGuard.require("technical-dashboard");
    if (!ctx) return;
    await Layout.mountStaffApp("technical-dashboard", ctx);
    document.getElementById("welcome-name").textContent = ctx.user.firstName;

    document.getElementById("modules-list").innerHTML = MODULES_STATUS.map((m) => `
      <div class="d-flex justify-content-between align-items-center py-2 border-bottom">
        <span class="small">${m.name}</span>
        <span class="dc-badge dc-badge-success">${m.status}</span>
      </div>`).join("");

    document.getElementById("logs-list").innerHTML = MOCK_LOGS.map((l, i) => {
      const cls = { info: "text-body-secondary", warn: "text-warning", error: "text-danger" }[l.level];
      return `<div class="small ${cls} mb-1"><i class="bi bi-terminal me-1"></i>[${new Date(Date.now() - i * 3600000).toLocaleTimeString("fr-FR")}] ${l.text}</div>`;
    }).join("");

    document.getElementById("maintenance-toggle").addEventListener("change", (e) => {
      DCUtils.toast(e.target.checked ? "Mode maintenance activé (simulation)." : "Mode maintenance désactivé.", e.target.checked ? "danger" : "success");
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
