(function () {
  async function init() {
    const user = await Auth.guard(["proprietaire"]);
    if (!user) return;
    await Layout.mountApp("proprietaire", "creer-annonce", user);

    const form = document.getElementById("listing-form");
    FormValidation.attach(form, {
      title: [FormValidation.rules.required],
      city: [FormValidation.rules.required],
      type: [FormValidation.rules.required],
      budget: [FormValidation.rules.required, FormValidation.rules.number],
      deposit: [FormValidation.rules.required, FormValidation.rules.number],
      surface: [FormValidation.rules.required, FormValidation.rules.number],
      availableFrom: [FormValidation.rules.required],
      description: [FormValidation.rules.required, FormValidation.rules.minLength(20)],
    }, async (e) => {
      const fd = new FormData(form);
      const submitBtn = form.querySelector("button[type=submit]");
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span>Publication…`;

      const isDraft = e.submitter && e.submitter.dataset.mode === "draft";
      const listing = {
        id: DataStore.nextId("housing"),
        ownerId: user.id,
        title: fd.get("title"),
        city: fd.get("city"),
        type: fd.get("type"),
        budget: Number(fd.get("budget")),
        charges: Number(fd.get("charges") || 0),
        deposit: Number(fd.get("deposit")),
        surface: Number(fd.get("surface")),
        availableFrom: fd.get("availableFrom"),
        immediateAvailability: fd.get("immediateAvailability") === "on",
        amenities: fd.getAll("amenities"),
        description: fd.get("description"),
        photos: ["placeholder.jpg"],
        moderationStatus: isDraft ? "brouillon" : "soumise",
        verified: false,
        createdAt: new Date().toISOString(),
      };
      await DataStore.insert("housing", listing);

      if (!isDraft) {
        const users = await DataStore.getUsers();
        const admins = users.filter((u) => u.role === "admin");
        await Promise.all(admins.map((a) => NotificationCenter.push(a.id, {
          type: "annonce_validee",
          title: "Nouvelle annonce à modérer",
          text: `L'annonce "${listing.title}" attend une validation.`,
          link: "pages/admin/moderation-logements.html",
        })));
      }

      DCUtils.toast(isDraft ? "Brouillon enregistré." : "Annonce soumise à la modération !", "success");
      setTimeout(() => { window.location.href = "annonces.html"; }, 700);
    });
  }
  document.addEventListener("DOMContentLoaded", init);
})();
