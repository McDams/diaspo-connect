/**
 * Contact équipe - formulaire unique routé vers le bon service. La soumission
 * crée à la fois une entrée "contact-requests" (la demande brute) et un
 * ticket dans le centre de tickets interne, avec le service cible déjà
 * assigné. C'est cette même logique qui alimente le tableau de bord
 * Secrétariat et les dashboards spécialisés (conseil, modération, etc.).
 */
(function () {
  const SERVICES = [
    { id: "direction", label: "Direction", icon: "bi-compass", targetService: "direction", defaultCategory: "information_generale" },
    { id: "secretariat", label: "Secrétariat", icon: "bi-inboxes", targetService: "secretariat", defaultCategory: "dossier_etudiant" },
    { id: "conseiller_demarches", label: "Conseiller démarches", icon: "bi-file-earmark-text", targetService: "conseil", defaultCategory: "dossier_etudiant" },
    { id: "conseiller_logement", label: "Conseiller logement", icon: "bi-house-door", targetService: "conseil", defaultCategory: "logement" },
    { id: "conseiller_emploi", label: "Conseiller emploi", icon: "bi-briefcase", targetService: "conseil", defaultCategory: "emploi" },
    { id: "support", label: "Support", icon: "bi-headset", targetService: "support", defaultCategory: "support_technique" },
    { id: "moderation", label: "Modération / confiance", icon: "bi-shield-check", targetService: "moderation", defaultCategory: "probleme_relationnel" },
    { id: "partenariats", label: "Partenariats", icon: "bi-handshake", targetService: "partenariats", defaultCategory: "partenariat" },
    { id: "rejoindre_equipe", label: "Rejoindre l'équipe", icon: "bi-people", targetService: "direction", defaultCategory: "benevolat" },
  ];

  function renderServiceChoices(selected) {
    const host = document.getElementById("service-choices");
    host.innerHTML = SERVICES.map((s) => `
      <div class="col-6 col-md-4 col-lg-3">
        <label class="dc-service-choice d-flex flex-column align-items-center text-center gap-1 ${s.id === selected ? "active" : ""}">
          <input type="radio" name="service" value="${s.id}" class="d-none" ${s.id === selected ? "checked" : ""}>
          <i class="bi ${s.icon} fs-4 text-primary"></i>
          <span class="small fw-semibold">${s.label}</span>
        </label>
      </div>`).join("");
    host.querySelectorAll("input[name=service]").forEach((input) => {
      input.addEventListener("change", () => {
        host.querySelectorAll(".dc-service-choice").forEach((el) => el.classList.remove("active"));
        input.closest(".dc-service-choice").classList.add("active");
        const service = SERVICES.find((s) => s.id === input.value);
        document.getElementById("category").value = service.defaultCategory;
      });
    });
  }

  async function nextTicketId() {
    const tickets = await DataStore.getTickets();
    const year = new Date().getFullYear();
    return { id: `TCK-${year}-${String(tickets.length + 1).padStart(3, "0")}`, tickets };
  }

  async function init() {
    const params = new URLSearchParams(window.location.search);
    const preselected = params.get("service") || "secretariat";
    renderServiceChoices(preselected);
    document.getElementById("category").value = SERVICES.find((s) => s.id === preselected)?.defaultCategory || "information_generale";

    const form = document.getElementById("contact-form");
    FormValidation.attach(form, {
      name: [FormValidation.rules.required],
      email: [FormValidation.rules.required, FormValidation.rules.email],
      subject: [FormValidation.rules.required],
      message: [FormValidation.rules.required, FormValidation.rules.minLength(15)],
      consent: [FormValidation.rules.checked],
    }, async () => {
      const fd = new FormData(form);
      const serviceId = fd.get("service") || preselected;
      const service = SERVICES.find((s) => s.id === serviceId) || SERVICES[1];
      const submitBtn = form.querySelector("button[type=submit]");
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span>Envoi en cours…`;

      const { id: ticketId, tickets } = await nextTicketId();
      const now = new Date().toISOString();

      const contactRequest = {
        id: DataStore.nextId("creq"),
        service: serviceId,
        name: fd.get("name"),
        email: fd.get("email"),
        userRole: fd.get("userRole"),
        subject: fd.get("subject"),
        category: fd.get("category"),
        message: fd.get("message"),
        priority: fd.get("priority"),
        attachmentSimulated: fd.get("attachment") ? fd.get("attachment").name || null : null,
        consent: true,
        status: "nouveau",
        linkedTicketId: ticketId,
        createdAt: now,
      };
      await DataStore.insert("contactRequests", contactRequest);

      const ticket = {
        id: ticketId,
        requesterName: fd.get("name"),
        requesterEmail: fd.get("email"),
        requesterRole: fd.get("userRole"),
        category: fd.get("category"),
        channel: "contact_form",
        targetService: service.targetService,
        priority: fd.get("priority"),
        assignedTo: null,
        status: "nouveau",
        urgent: fd.get("priority") === "urgente",
        createdAt: now,
        dueAt: null,
        closedAt: null,
        history: [{ date: now, status: "nouveau", note: `Ticket créé depuis le formulaire de contact (service : ${service.label}).`, byStaffId: null }],
        internalNotes: [],
        responseSent: false,
        responseText: null,
      };
      await DataStore.insert("tickets", ticket);

      DCUtils.toast(`Votre message a bien été envoyé (référence ${ticketId}). Notre équipe vous répond au plus vite.`, "success");
      form.reset();
      form.querySelectorAll(".is-valid").forEach((el) => el.classList.remove("is-valid"));
      renderServiceChoices(serviceId);
      submitBtn.disabled = false;
      submitBtn.textContent = "Envoyer ma demande";
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
