/**
 * ConfirmModal - modal de confirmation générique (rupture d'accompagnement,
 * suspension de compte, rejet d'annonce...). Injecté une seule fois dans le
 * DOM et réutilisé avec un callback différent à chaque appel.
 */
const ConfirmModal = (() => {
  let modalEl, bsModal, confirmBtn, titleEl, bodyEl, currentCallback;

  function ensureMounted() {
    if (modalEl) return;
    modalEl = document.createElement("div");
    modalEl.className = "modal fade";
    modalEl.id = "dc-confirm-modal";
    modalEl.tabIndex = -1;
    modalEl.innerHTML = `
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="dc-confirm-title">Confirmer l'action</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fermer"></button>
          </div>
          <div class="modal-body" id="dc-confirm-body">Êtes-vous sûr(e) ?</div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Annuler</button>
            <button type="button" class="btn btn-danger" id="dc-confirm-btn">Confirmer</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modalEl);
    bsModal = new bootstrap.Modal(modalEl);
    confirmBtn = modalEl.querySelector("#dc-confirm-btn");
    titleEl = modalEl.querySelector("#dc-confirm-title");
    bodyEl = modalEl.querySelector("#dc-confirm-body");
    confirmBtn.addEventListener("click", () => {
      bsModal.hide();
      if (currentCallback) currentCallback();
    });
  }

  function open({ title, body, confirmLabel = "Confirmer", variant = "danger", onConfirm }) {
    ensureMounted();
    titleEl.textContent = title || "Confirmer l'action";
    bodyEl.textContent = body || "Êtes-vous sûr(e) ?";
    confirmBtn.textContent = confirmLabel;
    confirmBtn.className = `btn btn-${variant}`;
    currentCallback = onConfirm;
    bsModal.show();
  }

  return { open };
})();
