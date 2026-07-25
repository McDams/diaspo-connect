(function () {
  function init() {
    const form = document.getElementById("register-form");
    FormValidation.attach(form, {
      firstName: [FormValidation.rules.required],
      lastName: [FormValidation.rules.required],
      email: [FormValidation.rules.required, FormValidation.rules.email],
      phone: [FormValidation.rules.phone],
      password: [FormValidation.rules.required, FormValidation.rules.minLength(6)],
      city: [FormValidation.rules.required],
      school: [FormValidation.rules.required],
      studyField: [FormValidation.rules.required],
      yearsInFrance: [FormValidation.rules.required, FormValidation.rules.number],
      terms: [FormValidation.rules.checked],
    }, async () => {
      const fd = new FormData(form);
      const submitBtn = form.querySelector("button[type=submit]");
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span>Création du profil…`;

      const registerResult = await Auth.register({
        role: "mentor",
        firstName: fd.get("firstName"),
        lastName: fd.get("lastName"),
        email: fd.get("email"),
        phone: fd.get("phone"),
        city: fd.get("city"),
      });

      if (!registerResult.ok) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Devenir mentor";
        DCUtils.toast(registerResult.message, "danger");
        return;
      }

      const languages = fd.getAll("languages");
      const helpTypes = fd.getAll("helpTypes");
      const mentor = {
        id: DataStore.nextId("mentor"),
        userId: registerResult.user.id,
        sex: fd.get("sex"),
        city: fd.get("city"),
        school: fd.get("school"),
        studyField: fd.get("studyField"),
        yearsInFrance: Number(fd.get("yearsInFrance")),
        languages: languages.length ? languages : ["Français"],
        availability: fd.get("availability"),
        helpTypes: helpTypes.length ? helpTypes : ["démarches administratives"],
        bio: fd.get("bio") || "Nouveau mentor sur la plateforme.",
        maxMentees: 2,
        activeMenteeCount: 0,
        status: "en_attente_verification",
      };
      await DataStore.insert("mentors", mentor);

      DCUtils.toast("Profil créé ! Il sera activé après vérification par notre équipe.", "success");
      setTimeout(() => { window.location.href = `${window.DC_ROOT}pages/mentor/dashboard.html`; }, 800);
    });
  }
  document.addEventListener("DOMContentLoaded", init);
})();
