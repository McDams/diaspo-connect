/**
 * ReportModal - formulaire de signalement réutilisable (message, utilisateur,
 * annonce). Crée un report (statut "ouvert") et notifie les administrateurs.
 */
const ReportModal = (() => {
  let modalEl, bsModal, context;

  const REASONS = [
    { value: "harcelement", label: "Harcèlement" },
    { value: "comportement_inapproprie", label: "Comportement inapproprié" },
    { value: "faux_profil", label: "Faux profil" },
    { value: "tentative_arnaque", label: "Tentative d'arnaque" },
    { value: "proposition_deplacee", label: "Proposition déplacée" },
    { value: "autre", label: "Autre" },
  ];

  function ensureMounted() {
    if (modalEl) return;
    modalEl = document.createElement("div");
    modalEl.className = "modal fade";
    modalEl.id = "dc-report-modal";
    modalEl.tabIndex = -1;
    modalEl.innerHTML = `
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <form id="dc-report-form" novalidate>
            <div class="modal-header">
              <h5 class="modal-title"><i class="bi bi-flag text-danger me-2"></i>Signaler</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fermer"></button>
            </div>
            <div class="modal-body">
              <p class="small text-body-secondary">Votre signalement sera examiné par l'équipe d'administration. Les échanges concernés pourront être consultés dans ce cadre.</p>
              <div class="mb-3">
                <label for="report-reason" class="form-label dc-required">Motif</label>
                <select class="form-select" id="report-reason" name="reason" required>
                  <option value="">Choisir un motif…</option>
                  ${REASONS.map((r) => `<option value="${r.value}">${r.label}</option>`).join("")}
                </select>
                <div class="invalid-feedback"></div>
              </div>
              <div class="mb-3">
                <label for="report-description" class="form-label dc-required">Description</label>
                <textarea class="form-control" id="report-description" name="description" rows="3" required></textarea>
                <div class="invalid-feedback"></div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Annuler</button>
              <button type="submit" class="btn btn-danger">Envoyer le signalement</button>
            </div>
          </form>
        </div>
      </div>`;
    document.body.appendChild(modalEl);
    bsModal = new bootstrap.Modal(modalEl);
    const form = modalEl.querySelector("#dc-report-form");
    FormValidation.attach(form, {
      reason: [FormValidation.rules.required],
      description: [FormValidation.rules.required, FormValidation.rules.minLength(10)],
    }, async () => {
      const fd = new FormData(form);
      const report = {
        id: DataStore.nextId("report"),
        reporterId: context.reporterId,
        targetType: context.targetType,
        targetId: context.targetId,
        conversationId: context.conversationId || null,
        reason: fd.get("reason"),
        description: fd.get("description"),
        status: "ouvert",
        createdAt: new Date().toISOString(),
        adminNote: null,
      };
      await DataStore.insert("reports", report);
      const users = await DataStore.getUsers();
      const admins = users.filter((u) => u.role === "admin");
      await Promise.all(admins.map((a) => NotificationCenter.push(a.id, {
        type: "signalement_recu",
        title: "Nouveau signalement",
        text: `Un signalement "${report.reason}" a été déposé.`,
        link: "pages/admin/moderation-messages.html",
      })));
      bsModal.hide();
      form.reset();
      form.querySelectorAll(".is-valid").forEach((el) => el.classList.remove("is-valid"));
      DCUtils.toast("Votre signalement a bien été transmis à l'équipe de modération.", "success");
      if (context.onSubmitted) context.onSubmitted(report);
    });
  }

  function open(ctx) {
    ensureMounted();
    context = ctx;
    bsModal.show();
  }

  return { open };
})();
