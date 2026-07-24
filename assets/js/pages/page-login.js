(function () {
  const DEMO_ACCOUNTS = [
    { role: "filleul", label: "Filleul", email: "rosine.agossou@mail.com", icon: "bi-mortarboard" },
    { role: "parrain", label: "Parrain / Marraine", email: "aicha.zannou@mail.fr", icon: "bi-people" },
    { role: "proprietaire", label: "Propriétaire", email: "marc.lefevre@mail.fr", icon: "bi-house-door" },
    { role: "admin", label: "Administrateur", email: "admin@diaspoconnect.fr", icon: "bi-shield-lock" },
    { role: "staff", label: "Direction (équipe)", email: "serge.donou@diaspoconnect.fr", icon: "bi-compass" },
    { role: "staff", label: "Secrétariat", email: "aminata.djossou@diaspoconnect.fr", icon: "bi-inboxes" },
    { role: "staff", label: "Conseiller démarches", email: "fabrice.koudjo@diaspoconnect.fr", icon: "bi-person-badge" },
  ];

  function renderDemoAccounts() {
    const host = document.getElementById("demo-accounts");
    host.innerHTML = DEMO_ACCOUNTS.map((d) => `
      <button type="button" class="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1" data-email="${d.email}">
        <i class="bi ${d.icon}"></i>${d.label}
      </button>`).join("");
    host.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-email]");
      if (!btn) return;
      document.getElementById("l-email").value = btn.dataset.email;
      document.getElementById("l-password").value = "demo1234";
      document.getElementById("l-email").classList.remove("is-invalid");
      document.getElementById("l-password").classList.remove("is-invalid");
    });
  }

  async function redirectByRole(role, user) {
    if (role === "staff") {
      const staffList = await DataStore.getStaff();
      const staff = staffList.find((s) => s.userId === user.id);
      const landing = staff ? await Permissions.landingPageFor(staff.accessLevel) : "staff-dashboard.html";
      window.location.href = `${window.DC_ROOT}pages/staff/${landing}`;
      return;
    }
    window.location.href = `${window.DC_ROOT}pages/${role}/dashboard.html`;
  }

  function init() {
    renderDemoAccounts();
    const form = document.getElementById("login-form");
    FormValidation.attach(form, {
      email: [FormValidation.rules.required, FormValidation.rules.email],
      password: [FormValidation.rules.required, FormValidation.rules.minLength(6)],
    }, async () => {
      const email = document.getElementById("l-email").value;
      const password = document.getElementById("l-password").value;
      const submitBtn = form.querySelector("button[type=submit]");
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span>Connexion…`;
      const result = await Auth.login(email, password);
      if (result.ok) {
        DCUtils.toast(`Bienvenue ${result.user.firstName} !`, "success");
        setTimeout(() => redirectByRole(result.user.role, result.user), 500);
      } else {
        submitBtn.disabled = false;
        submitBtn.textContent = "Se connecter";
        DCUtils.toast(result.message, "danger");
      }
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
