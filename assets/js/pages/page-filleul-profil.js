(function () {
  function computeCompleteness(fd) {
    const fields = ["desiredCity", "school", "studyField", "budget", "specificNeeds"];
    const filled = fields.filter((f) => (fd.get(f) || "").toString().trim().length > 0).length;
    const languages = fd.getAll("languages").length > 0;
    const accompagnement = fd.getAll("accompagnementType").length > 0;
    const total = fields.length + 2;
    const done = filled + (languages ? 1 : 0) + (accompagnement ? 1 : 0);
    return Math.round((done / total) * 100);
  }

  async function init() {
    const user = await Auth.guard(["filleul"]);
    if (!user) return;
    await Layout.mountApp("filleul", "profil", user);

    const mentees = await DataStore.getMentees();
    const mentee = mentees.find((m) => m.userId === user.id);
    if (!mentee) return;

    const form = document.getElementById("profile-form");
    form.firstName.value = user.firstName;
    form.lastName.value = user.lastName;
    form.email.value = user.email;
    form.phone.value = user.phone || "";
    form.cityOfOrigin.value = mentee.cityOfOrigin;
    form.desiredCity.value = mentee.desiredCity;
    form.school.value = mentee.school;
    form.studyField.value = mentee.studyField;
    form.budget.value = mentee.budget;
    form.sexPreference.value = mentee.sexPreference;
    form.specificNeeds.value = mentee.specificNeeds;
    form.querySelectorAll("input[name=languages]").forEach((cb) => { cb.checked = mentee.languages.includes(cb.value); });
    form.querySelectorAll("input[name=accompagnementType]").forEach((cb) => { cb.checked = mentee.accompagnementType.includes(cb.value); });

    document.getElementById("file-status-badge").innerHTML = DCUtils.fileStatusBadge(mentee.fileStatus);
    document.getElementById("completeness-value").textContent = `${mentee.profileCompleteness}%`;
    document.getElementById("completeness-ring").style.setProperty("--pct", mentee.profileCompleteness);

    FormValidation.attach(form, {
      desiredCity: [FormValidation.rules.required],
      studyField: [FormValidation.rules.required],
      budget: [FormValidation.rules.required, FormValidation.rules.number],
    }, async () => {
      const fd = new FormData(form);
      const patch = {
        cityOfOrigin: fd.get("cityOfOrigin"),
        desiredCity: fd.get("desiredCity"),
        school: fd.get("school"),
        studyField: fd.get("studyField"),
        budget: Number(fd.get("budget")),
        sexPreference: fd.get("sexPreference"),
        specificNeeds: fd.get("specificNeeds"),
        languages: fd.getAll("languages"),
        accompagnementType: fd.getAll("accompagnementType"),
        profileCompleteness: computeCompleteness(fd),
      };
      await DataStore.update("mentees", mentee.id, patch);
      document.getElementById("completeness-value").textContent = `${patch.profileCompleteness}%`;
      document.getElementById("completeness-ring").style.setProperty("--pct", patch.profileCompleteness);
      DCUtils.toast("Profil mis à jour avec succès.", "success");
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
