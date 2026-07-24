(function () {
  const ACTION_COLS = ["read", "create", "update", "delete", "assign", "validate", "moderate", "export"];

  function renderMatrix(roleKey) {
    const tbody = document.getElementById("matrix-tbody");
    tbody.innerHTML = RBAC.MODULES.map((module) => `
      <tr>
        <td class="small fw-semibold text-capitalize">${module}</td>
        ${ACTION_COLS.map((action) => `
          <td class="text-center">
            <input type="checkbox" class="form-check-input perm-toggle" data-module="${module}" data-action="${action}"
              ${RBAC.can(roleKey, module, action) ? "checked" : ""}>
          </td>`).join("")}
      </tr>`).join("");
  }

  async function init() {
    const admin = await Auth.guard(["admin"]);
    if (!admin) return;
    await Layout.mountApp("admin", "permissions", admin);

    const select = document.getElementById("role-select");
    Object.entries(RBAC.ROLE_LABELS).forEach(([key, label]) => {
      const opt = document.createElement("option");
      opt.value = key; opt.textContent = label;
      select.appendChild(opt);
    });
    let currentRole = select.value;
    renderMatrix(currentRole);

    select.addEventListener("change", () => { currentRole = select.value; renderMatrix(currentRole); });

    document.getElementById("matrix-tbody").addEventListener("change", async (e) => {
      const cb = e.target.closest(".perm-toggle");
      if (!cb) return;
      RBAC.toggle(currentRole, cb.dataset.module, cb.dataset.action);
      await DataStore.insert("auditLog", {
        id: DataStore.nextId("audit"), actorId: admin.id, actorName: `${admin.firstName} ${admin.lastName}`,
        action: "permission_modifiee", targetType: "role", targetId: currentRole, date: new Date().toISOString(),
        details: `Permission ${cb.dataset.module}/${cb.dataset.action} ${cb.checked ? "accordée à" : "retirée à"} ${RBAC.ROLE_LABELS[currentRole]}.`,
      });
      DCUtils.toast("Permission mise à jour (simulation frontend).", "success");
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
