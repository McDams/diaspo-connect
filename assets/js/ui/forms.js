/**
 * FormValidation - moteur de validation frontend générique et réutilisable.
 * Usage :
 *   FormValidation.validateForm(formEl, {
 *     email: [FormValidation.rules.required, FormValidation.rules.email],
 *     password: [FormValidation.rules.required, FormValidation.rules.minLength(6)],
 *   });
 * Chaque règle reçoit (valeur, formEl) et renvoie `true` ou un message d'erreur.
 */
const FormValidation = (() => {
  const rules = {
    required: (v) => (v && v.toString().trim().length > 0) || "Ce champ est requis.",
    email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || "Adresse email invalide.",
    phone: (v) => !v || /^[+0-9\s.-]{6,20}$/.test(v) || "Numéro de téléphone invalide.",
    minLength: (n) => (v) => (v && v.length >= n) || `Minimum ${n} caractères.`,
    number: (v) => (v !== "" && !isNaN(Number(v))) || "Doit être un nombre.",
    minValue: (n) => (v) => Number(v) >= n || `Doit être supérieur ou égal à ${n}.`,
    checked: (v, form, input) => input.checked || "Cette case doit être cochée.",
    oneOf: (values) => (v) => values.includes(v) || "Valeur non autorisée.",
  };

  function setFieldState(input, result) {
    const feedback = input.closest(".mb-3, .col, .col-md-6, .col-12, .form-group")?.querySelector(".invalid-feedback") ||
      input.parentElement.querySelector(".invalid-feedback");
    if (result === true) {
      input.classList.remove("is-invalid");
      input.classList.add("is-valid");
      if (feedback) feedback.textContent = "";
    } else {
      input.classList.remove("is-valid");
      input.classList.add("is-invalid");
      if (feedback) feedback.textContent = result;
    }
  }

  function validateField(input, fieldRules, form) {
    for (const rule of fieldRules) {
      const result = rule(input.value, form, input);
      if (result !== true) {
        setFieldState(input, result);
        return false;
      }
    }
    setFieldState(input, true);
    return true;
  }

  function validateForm(form, schema) {
    let valid = true;
    Object.entries(schema).forEach(([name, fieldRules]) => {
      const input = form.querySelector(`[name="${name}"]`);
      if (!input) return;
      const ok = validateField(input, fieldRules, form);
      valid = valid && ok;
    });
    return valid;
  }

  /** Attache une validation "au blur" + validation finale à la soumission. */
  function attach(form, schema, onValidSubmit) {
    Object.keys(schema).forEach((name) => {
      const input = form.querySelector(`[name="${name}"]`);
      if (!input) return;
      input.addEventListener("blur", () => validateField(input, schema[name], form));
      input.addEventListener("input", () => {
        if (input.classList.contains("is-invalid")) validateField(input, schema[name], form);
      });
    });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const valid = validateForm(form, schema);
      if (valid) onValidSubmit(e);
      else {
        const firstInvalid = form.querySelector(".is-invalid");
        if (firstInvalid) firstInvalid.focus();
        DCUtils.toast("Merci de corriger les champs en erreur avant de continuer.", "danger");
      }
    });
  }

  return { rules, validateField, validateForm, attach };
})();
