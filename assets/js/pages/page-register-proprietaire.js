(function () {
  function init() {
    const form = document.getElementById("register-form");
    FormValidation.attach(form, {
      firstName: [FormValidation.rules.required],
      lastName: [FormValidation.rules.required],
      email: [FormValidation.rules.required, FormValidation.rules.email],
      phone: [FormValidation.rules.required, FormValidation.rules.phone],
      password: [FormValidation.rules.required, FormValidation.rules.minLength(6)],
      city: [FormValidation.rules.required],
      terms: [FormValidation.rules.checked],
    }, async () => {
      const fd = new FormData(form);
      const submitBtn = form.querySelector("button[type=submit]");
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span>Création du compte…`;

      const registerResult = await Auth.register({
        role: "proprietaire",
        firstName: fd.get("firstName"),
        lastName: fd.get("lastName"),
        email: fd.get("email"),
        phone: fd.get("phone"),
        city: fd.get("city"),
      });

      if (!registerResult.ok) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Créer mon compte propriétaire";
        DCUtils.toast(registerResult.message, "danger");
        return;
      }

      DCUtils.toast("Compte propriétaire créé ! Vous pouvez publier votre première annonce.", "success");
      setTimeout(() => { window.location.href = `${window.DC_ROOT}pages/proprietaire/dashboard.html`; }, 700);
    });
  }
  document.addEventListener("DOMContentLoaded", init);
})();
