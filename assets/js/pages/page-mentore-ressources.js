(function () {
  const REQUIRED_DOCUMENTS = [
    "Passeport en cours de validité",
    "Attestation Campus France",
    "Certificat de scolarité ou d'inscription",
    "Justificatif de ressources ou bourse",
    "Attestation d'assurance voyage (arrivée)",
    "Diplômes et relevés de notes traduits",
  ];

  function renderChecklist(mentee) {
    const items = Checklist.ensure(mentee);
    const { done, total, pct } = Checklist.progress(mentee);
    document.getElementById("checklist-label").textContent = `${done} / ${total} étapes complétées`;
    document.getElementById("checklist-bar").style.width = `${pct}%`;
    document.getElementById("checklist-full").innerHTML = items.map((i) => `
      <div class="dc-checklist-item ${i.done ? "is-checked" : ""}">
        <input class="form-check-input mt-1" type="checkbox" data-item="${i.id}" ${i.done ? "checked" : ""} id="chk-${i.id}">
        <label class="dc-checklist-label" for="chk-${i.id}">${DCUtils.escapeHtml(i.label)}</label>
      </div>`).join("");
    document.getElementById("checklist-full").querySelectorAll("input[type=checkbox]").forEach((cb) => {
      cb.addEventListener("change", () => { Checklist.toggle(mentee, cb.dataset.item); renderChecklist(mentee); });
    });
  }

  async function init() {
    const user = await Auth.guard(["mentore"]);
    if (!user) return;
    await Layout.mountApp("mentore", "ressources", user);

    const mentees = await DataStore.getMentees();
    const mentee = mentees.find((m) => m.userId === user.id);
    renderChecklist(mentee);

    document.getElementById("documents-list").innerHTML = REQUIRED_DOCUMENTS.map((d) => `
      <li class="list-group-item d-flex align-items-center gap-2">
        <i class="bi bi-file-earmark-text text-primary"></i>${d}
      </li>`).join("");
  }

  document.addEventListener("DOMContentLoaded", init);
})();
