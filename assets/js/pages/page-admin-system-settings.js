(function () {
  let settings;

  const GENERAL_FORM_SCHEMA = {
    platformName: [FormValidation.rules.required],
    supportEmail: [FormValidation.rules.required, FormValidation.rules.email],
    maxMentees: [FormValidation.rules.required, FormValidation.rules.number, FormValidation.rules.minValue(1)],
    slaHours: [FormValidation.rules.required, FormValidation.rules.number, FormValidation.rules.minValue(1)],
  };

  function flagRow(flag) {
    return `<div class="form-check form-switch mb-3">
      <input class="form-check-input flag-toggle" type="checkbox" role="switch" id="flag-${flag.id}" data-id="${flag.id}" ${flag.enabled ? "checked" : ""}>
      <label class="form-check-label small" for="flag-${flag.id}"><strong>${DCUtils.escapeHtml(flag.name)}</strong><br><span class="text-muted-dc">${DCUtils.escapeHtml(flag.description)}</span></label>
    </div>`;
  }

  async function init() {
    const admin = await Auth.guard(["admin"]);
    if (!admin) return;
    await Layout.mountApp("admin", "system-settings", admin);

    settings = await DataStore.getSettings();
    document.getElementById("s-name").value = settings.general.platformName;
    document.getElementById("s-email").value = settings.general.supportEmail;
    document.getElementById("s-quota").value = settings.general.maxActiveMenteesPerMentor;
    document.getElementById("s-sla").value = settings.general.ticketDefaultSlaHours;
    document.getElementById("s-maintenance").checked = settings.general.maintenanceMode;

    document.getElementById("flags-list").innerHTML = settings.featureFlags.map(flagRow).join("");

    document.getElementById("general-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!FormValidation.validateForm(e.target, GENERAL_FORM_SCHEMA)) return;
      const previous = { ...settings.general };
      Object.assign(settings.general, {
        platformName: document.getElementById("s-name").value,
        supportEmail: document.getElementById("s-email").value,
        maxActiveMenteesPerMentor: Number(document.getElementById("s-quota").value),
        ticketDefaultSlaHours: Number(document.getElementById("s-sla").value),
        maintenanceMode: document.getElementById("s-maintenance").checked,
      });
      await DataStore.update("settings", "app", { general: settings.general });
      await AuditLog.record({
        actor: { id: admin.id, label: `${admin.firstName} ${admin.lastName}`, role: admin.role }, module: "settings",
        action: "parametres_systeme_modifies", targetType: "settings", targetId: "general",
        before: previous, after: { ...settings.general },
        details: "Paramètres système généraux mis à jour.",
      });
      DCUtils.toast("Paramètres enregistrés.", "success");
    });

    document.getElementById("flags-list").addEventListener("change", async (e) => {
      const cb = e.target.closest(".flag-toggle");
      if (!cb) return;
      const flag = settings.featureFlags.find((f) => f.id === cb.dataset.id);
      const previousEnabled = flag.enabled;
      flag.enabled = cb.checked;
      await DataStore.update("settings", "app", { featureFlags: settings.featureFlags });
      await AuditLog.record({
        actor: { id: admin.id, label: `${admin.firstName} ${admin.lastName}`, role: admin.role }, module: "settings",
        action: "feature_flag_modifie", targetType: "feature_flag", targetId: flag.id,
        before: { enabled: previousEnabled }, after: { enabled: flag.enabled },
        details: `Feature flag « ${flag.name} » ${flag.enabled ? "activé" : "désactivé"}.`,
      });
      DCUtils.toast(`« ${flag.name} » ${flag.enabled ? "activé" : "désactivé"}.`, "info");
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
