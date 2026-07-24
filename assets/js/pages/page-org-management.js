/**
 * Organisation - gestion des pôles/départements et de l'organigramme.
 * Contrairement à la page publique "À propos", cette vue interne affiche
 * l'identité réelle de tous les membres, y compris ceux qui n'ont pas
 * consenti à une visibilité publique (outil réservé à l'équipe interne).
 */
(function () {
  let departments, orgNodes, staffList, users, ctx;

  function memberLine(staffId) {
    const staff = staffList.find((s) => s.id === staffId);
    if (!staff) return `<div class="dc-orgchart-member"><span class="dc-orgchart-hidden">Poste vacant</span></div>`;
    const u = users.find((x) => x.id === staff.userId);
    return `<div class="dc-orgchart-member">
      <span class="dc-avatar dc-avatar-sm" style="background:${u.avatarColor}">${u.avatarInitials}</span>
      <div><span class="dc-orgchart-member-name">${DCUtils.escapeHtml(u.firstName)} ${DCUtils.escapeHtml(u.lastName)}</span>
      <div class="dc-orgchart-member-role">${DCUtils.escapeHtml(staff.position)}</div></div>
    </div>`;
  }

  function renderChart() {
    const founderNode = orgNodes.find((n) => n.parentId === null);
    document.getElementById("orgchart-founder").innerHTML = `
      <div class="dc-orgchart-founder">${memberLine(founderNode.staffId)}</div>
      <div class="dc-orgchart-connector"></div>`;
    const poles = orgNodes.filter((n) => n.parentId === founderNode.id);
    document.getElementById("orgchart-grid").innerHTML = poles.map((pole) => {
      const dept = departments.find((d) => d.id === pole.departmentId);
      const children = orgNodes.filter((n) => n.parentId === pole.id);
      const members = children.length ? children.map((c) => memberLine(c.staffId)).join("") : memberLine(pole.staffId);
      return `<div class="dc-orgchart-card">
        <h6><i class="bi ${dept ? dept.icon : "bi-diagram-3"} text-primary me-2"></i>${DCUtils.escapeHtml(pole.title)}</h6>
        ${members}
      </div>`;
    }).join("");
  }

  function renderDepartmentsTable() {
    document.getElementById("departments-tbody").innerHTML = departments.map((d) => {
      const members = staffList.filter((s) => s.department === d.id);
      const headNode = orgNodes.find((n) => n.departmentId === d.id && n.staffId);
      const head = headNode ? staffList.find((s) => s.id === headNode.staffId) : null;
      const headUser = head ? users.find((u) => u.id === head.userId) : null;
      return `<tr>
        <td><i class="bi ${d.icon} me-2 text-primary"></i>${DCUtils.escapeHtml(d.name)}</td>
        <td class="small text-muted-dc">${DCUtils.escapeHtml(d.description)}</td>
        <td>${headUser ? `${DCUtils.escapeHtml(headUser.firstName)} ${DCUtils.escapeHtml(headUser.lastName)}` : '<span class="text-muted-dc">Non défini</span>'}</td>
        <td>${members.length}</td>
      </tr>`;
    }).join("");
  }

  async function init() {
    ctx = await StaffGuard.require("org-management");
    if (!ctx) return;
    await Layout.mountStaffApp("org-management", ctx);

    [departments, orgNodes, staffList, users] = await Promise.all([
      DataStore.getDepartments(), DataStore.getOrgChart(), DataStore.getStaff(), DataStore.getUsers(),
    ]);

    renderChart();
    renderDepartmentsTable();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
