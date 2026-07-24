(function () {
  async function nextTicketId() {
    const tickets = await DataStore.getTickets();
    const year = new Date().getFullYear();
    return `TCK-${year}-${String(tickets.length + 1).padStart(3, "0")}`;
  }

  async function init() {
    const form = document.getElementById("join-form");
    FormValidation.attach(form, {
      name: [FormValidation.rules.required],
      email: [FormValidation.rules.required, FormValidation.rules.email],
      city: [FormValidation.rules.required],
      pole: [FormValidation.rules.required],
      motivation: [FormValidation.rules.required, FormValidation.rules.minLength(30)],
      consent: [FormValidation.rules.checked],
    }, async () => {
      const fd = new FormData(form);
      const submitBtn = form.querySelector("button[type=submit]");
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span>Envoi en cours…`;

      const now = new Date().toISOString();
      const ticketId = await nextTicketId();
      const message = `Candidature bénévole — pôle souhaité : ${fd.get("pole")}. Ville : ${fd.get("city")}. Disponibilité : ${fd.get("availability")}.\n\nMotivation : ${fd.get("motivation")}`;

      await DataStore.insert("contactRequests", {
        id: DataStore.nextId("creq"),
        service: "rejoindre_equipe",
        name: fd.get("name"),
        email: fd.get("email"),
        userRole: "visiteur",
        subject: `Candidature bénévole - ${fd.get("pole")}`,
        category: "benevolat",
        message,
        priority: "basse",
        attachmentSimulated: fd.get("cv") ? fd.get("cv").name || null : null,
        consent: true,
        status: "nouveau",
        linkedTicketId: ticketId,
        createdAt: now,
      });

      await DataStore.insert("tickets", {
        id: ticketId, requesterName: fd.get("name"), requesterEmail: fd.get("email"), requesterRole: "visiteur",
        category: "benevolat", channel: "contact_form", targetService: "direction", priority: "basse",
        assignedTo: null, status: "nouveau", urgent: false, createdAt: now, dueAt: null, closedAt: null,
        history: [{ date: now, status: "nouveau", note: `Candidature bénévole reçue pour le pôle ${fd.get("pole")}.`, byStaffId: null }],
        internalNotes: [], responseSent: false, responseText: null,
      });

      DCUtils.toast(`Candidature envoyée (référence ${ticketId}) ! La direction reviendra vers vous rapidement.`, "success");
      form.reset();
      form.querySelectorAll(".is-valid").forEach((el) => el.classList.remove("is-valid"));
      submitBtn.disabled = false;
      submitBtn.textContent = "Envoyer ma candidature";
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
