/**
 * Page paramètres, générique à tous les rôles. Le rôle courant est lu sur
 * data-role du <body> pour appliquer le bon guard et la bonne sidebar.
 */
(function () {
  async function init() {
    const role = document.body.dataset.role;
    const user = await Auth.guard([role]);
    if (!user) return;
    await Layout.mountApp(role, "parametres", user);

    document.getElementById("account-email").textContent = user.email;
    document.getElementById("account-name").textContent = `${user.firstName} ${user.lastName}`;
    document.getElementById("account-created").textContent = DCUtils.formatDate(user.createdAt);
    document.getElementById("account-verified").innerHTML = user.verified
      ? '<span class="dc-verified-badge"><i class="bi bi-patch-check-fill"></i>Compte vérifié</span>'
      : '<span class="text-muted-dc small"><i class="bi bi-hourglass-split me-1"></i>Vérification en cours</span>';

    const pwdForm = document.getElementById("password-form");
    FormValidation.attach(pwdForm, {
      currentPassword: [FormValidation.rules.required],
      newPassword: [FormValidation.rules.required, FormValidation.rules.minLength(6)],
      confirmPassword: [FormValidation.rules.required, FormValidation.rules.match("[name=newPassword]", "Les mots de passe ne correspondent pas.")],
    }, () => {
      DCUtils.toast("Mot de passe mis à jour (simulation).", "success");
      pwdForm.reset();
      pwdForm.querySelectorAll(".is-valid").forEach((el) => el.classList.remove("is-valid"));
    });

    const deleteBtn = document.getElementById("delete-account-btn");
    if (deleteBtn) {
      deleteBtn.addEventListener("click", () => {
        ConfirmModal.open({
          title: "Supprimer mon compte",
          body: "Cette action est irréversible sur une vraie plateforme. Dans cette démo, elle vous déconnecte simplement.",
          confirmLabel: "Supprimer",
          variant: "danger",
          onConfirm: () => Auth.logout(),
        });
      });
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
