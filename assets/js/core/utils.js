/**
 * Utilitaires transverses : formatage, échappement HTML, helpers DOM.
 */
const DCUtils = (() => {
  function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatDate(iso) {
    if (!iso) return "-";
    const d = new Date(iso);
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  }

  function formatDateTime(iso) {
    if (!iso) return "-";
    const d = new Date(iso);
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) +
      " à " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }

  function timeAgo(iso) {
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.round(diffMs / 60000);
    if (mins < 1) return "à l'instant";
    if (mins < 60) return `il y a ${mins} min`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `il y a ${hours} h`;
    const days = Math.round(hours / 24);
    if (days < 30) return `il y a ${days} j`;
    return formatDate(iso);
  }

  function currency(amount) {
    if (amount === null || amount === undefined) return "-";
    return `${amount} €`;
  }

  function qs(sel, ctx) { return (ctx || document).querySelector(sel); }
  function qsa(sel, ctx) { return Array.from((ctx || document).querySelectorAll(sel)); }

  function debounce(fn, delay = 250) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), delay);
    };
  }

  function initialsColor(seedString) {
    const palette = ["#1F3A5F", "#2E7D6B", "#B5642B", "#5B4B8A", "#2563A8"];
    let hash = 0;
    for (let i = 0; i < seedString.length; i++) hash = seedString.charCodeAt(i) + ((hash << 5) - hash);
    return palette[Math.abs(hash) % palette.length];
  }

  function statusBadge(status) {
    const map = {
      en_attente: { label: "En attente", cls: "dc-badge-warning" },
      validee: { label: "Validée", cls: "dc-badge-info" },
      active: { label: "Active", cls: "dc-badge-success" },
      suspendue: { label: "Suspendue", cls: "dc-badge-danger" },
      terminee: { label: "Terminée", cls: "dc-badge-neutral" },
      actif: { label: "Actif", cls: "dc-badge-success" },
      suspendu: { label: "Suspendu", cls: "dc-badge-danger" },
      brouillon: { label: "Brouillon", cls: "dc-badge-neutral" },
      soumise: { label: "En modération", cls: "dc-badge-warning" },
      en_attente_verification: { label: "En attente", cls: "dc-badge-warning" },
      validee_annonce: { label: "Validée", cls: "dc-badge-success" },
      rejetee: { label: "Rejetée", cls: "dc-badge-danger" },
      archivee: { label: "Archivée", cls: "dc-badge-neutral" },
      ouvert: { label: "Ouvert", cls: "dc-badge-danger" },
      en_cours: { label: "En cours", cls: "dc-badge-warning" },
      resolu: { label: "Résolu", cls: "dc-badge-success" },
      rejete: { label: "Rejeté", cls: "dc-badge-neutral" },
      nouveau: { label: "Nouveau", cls: "dc-badge-info" },
      en_attente_reponse: { label: "En attente de réponse", cls: "dc-badge-warning" },
      ferme: { label: "Fermé", cls: "dc-badge-neutral" },
    };
    const entry = map[status] || { label: status, cls: "dc-badge-neutral" };
    return `<span class="dc-badge ${entry.cls}">${entry.label}</span>`;
  }

  function priorityBadge(priority) {
    const map = {
      basse: { label: "Basse", cls: "dc-badge-neutral" },
      normale: { label: "Normale", cls: "dc-badge-info" },
      haute: { label: "Haute", cls: "dc-badge-warning" },
      urgente: { label: "Urgente", cls: "dc-badge-danger" },
    };
    const entry = map[priority] || { label: priority, cls: "dc-badge-neutral" };
    return `<span class="dc-badge ${entry.cls}">${entry.label}</span>`;
  }

  /** Badge dédié au statut de dossier d'un filleul (distinct des statuts de matching/signalement). */
  function fileStatusBadge(status) {
    const map = {
      en_preparation: { label: "Dossier en préparation", cls: "dc-badge-warning" },
      en_cours: { label: "Dossier en cours", cls: "dc-badge-info" },
      valide: { label: "Dossier validé", cls: "dc-badge-success" },
    };
    const entry = map[status] || { label: status, cls: "dc-badge-neutral" };
    return `<span class="dc-badge ${entry.cls}">${entry.label}</span>`;
  }

  function toast(message, type = "success") {
    let holder = document.getElementById("dc-toast-holder");
    if (!holder) {
      holder = document.createElement("div");
      holder.id = "dc-toast-holder";
      holder.className = "toast-container position-fixed bottom-0 end-0 p-3";
      holder.style.zIndex = 2000;
      document.body.appendChild(holder);
    }
    const icons = { success: "bi-check-circle-fill", danger: "bi-exclamation-triangle-fill", info: "bi-info-circle-fill" };
    const colors = { success: "text-success", danger: "text-danger", info: "text-primary" };
    const el = document.createElement("div");
    el.className = "toast align-items-center border-0 shadow-sm";
    el.setAttribute("role", "alert");
    el.innerHTML = `
      <div class="d-flex">
        <div class="toast-body">
          <i class="bi ${icons[type] || icons.info} ${colors[type] || colors.info} me-2"></i>${escapeHtml(message)}
        </div>
        <button type="button" class="btn-close me-2 m-auto" data-bs-dismiss="toast" aria-label="Fermer"></button>
      </div>`;
    holder.appendChild(el);
    const toastInstance = new bootstrap.Toast(el, { delay: 4500 });
    toastInstance.show();
    el.addEventListener("hidden.bs.toast", () => el.remove());
  }

  return { escapeHtml, formatDate, formatDateTime, timeAgo, currency, qs, qsa, debounce, initialsColor, statusBadge, fileStatusBadge, priorityBadge, toast };
})();
