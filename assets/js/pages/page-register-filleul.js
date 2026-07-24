(function () {
  function init() {
    const form = document.getElementById("register-form");
    FormValidation.attach(form, {
      firstName: [FormValidation.rules.required],
      lastName: [FormValidation.rules.required],
      email: [FormValidation.rules.required, FormValidation.rules.email],
      phone: [FormValidation.rules.phone],
      password: [FormValidation.rules.required, FormValidation.rules.minLength(6)],
      cityOfOrigin: [FormValidation.rules.required],
      desiredCity: [FormValidation.rules.required],
      studyField: [FormValidation.rules.required],
      budget: [FormValidation.rules.required, FormValidation.rules.number],
      terms: [FormValidation.rules.checked],
    }, async () => {
      const fd = new FormData(form);
      const submitBtn = form.querySelector("button[type=submit]");
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span>Création du profil…`;

      const registerResult = await Auth.register({
        role: "filleul",
        firstName: fd.get("firstName"),
        lastName: fd.get("lastName"),
        email: fd.get("email"),
        phone: fd.get("phone"),
        city: fd.get("cityOfOrigin"),
      });

      if (!registerResult.ok) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Créer mon profil filleul";
        DCUtils.toast(registerResult.message, "danger");
        return;
      }

      const languages = fd.getAll("languages");
      const accompagnementType = fd.getAll("accompagnementType");
      const mentee = {
        id: DataStore.nextId("mentee"),
        userId: registerResult.user.id,
        sex: fd.get("sex"),
        countryOfOrigin: "Bénin",
        cityOfOrigin: fd.get("cityOfOrigin"),
        desiredCity: fd.get("desiredCity"),
        school: fd.get("school") || "Non renseigné",
        studyField: fd.get("studyField"),
        budget: Number(fd.get("budget")),
        sexPreference: fd.get("sexPreference") || "aucune",
        languages: languages.length ? languages : ["Français"],
        specificNeeds: fd.get("specificNeeds") || "",
        accompagnementType: accompagnementType.length ? accompagnementType : ["démarches administratives"],
        fileStatus: "en_preparation",
        profileCompleteness: 55,
        matchingId: null,
      };
      await DataStore.insert("mentees", mentee);

      DCUtils.toast("Profil filleul créé avec succès ! Bienvenue sur DiaspoConnect.", "success");
      setTimeout(() => { window.location.href = `${window.DC_ROOT}pages/filleul/dashboard.html`; }, 700);
    });
  }
  document.addEventListener("DOMContentLoaded", init);
})();
