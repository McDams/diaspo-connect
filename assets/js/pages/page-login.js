(function () {
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
