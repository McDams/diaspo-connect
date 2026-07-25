(function () {
  async function init() {
    const user = await Auth.guard(["mentor"]);
    if (!user) return;
    await Layout.mountApp("mentor", "profil", user);

    const mentors = await DataStore.getMentors();
    const mentor = mentors.find((m) => m.userId === user.id);
    if (!mentor) return;

    const form = document.getElementById("profile-form");
    form.firstName.value = user.firstName;
    form.lastName.value = user.lastName;
    form.email.value = user.email;
    form.city.value = mentor.city;
    form.school.value = mentor.school;
    form.studyField.value = mentor.studyField;
    form.yearsInFrance.value = mentor.yearsInFrance;
    form.availability.value = mentor.availability;
    form.bio.value = mentor.bio;
    form.querySelectorAll("input[name=languages]").forEach((cb) => { cb.checked = mentor.languages.includes(cb.value); });
    form.querySelectorAll("input[name=helpTypes]").forEach((cb) => { cb.checked = mentor.helpTypes.includes(cb.value); });

    document.getElementById("verified-badge").innerHTML = user.verified
      ? '<span class="dc-verified-badge"><i class="bi bi-patch-check-fill"></i>Profil vérifié</span>'
      : '<span class="text-warning small"><i class="bi bi-hourglass-split me-1"></i>Vérification en cours par l\'administration</span>';

    FormValidation.attach(form, {
      city: [FormValidation.rules.required],
      school: [FormValidation.rules.required],
      studyField: [FormValidation.rules.required],
      yearsInFrance: [FormValidation.rules.required, FormValidation.rules.number],
    }, async () => {
      const fd = new FormData(form);
      await DataStore.update("mentors", mentor.id, {
        city: fd.get("city"),
        school: fd.get("school"),
        studyField: fd.get("studyField"),
        yearsInFrance: Number(fd.get("yearsInFrance")),
        availability: fd.get("availability"),
        bio: fd.get("bio"),
        languages: fd.getAll("languages"),
        helpTypes: fd.getAll("helpTypes"),
      });
      DCUtils.toast("Profil mis à jour avec succès.", "success");
    });
  }
  document.addEventListener("DOMContentLoaded", init);
})();
