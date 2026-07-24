/**
 * Layout - montage des éléments d'interface partagés (navbar publique,
 * header + sidebar applicatifs, footer). Les partials HTML vivent dans
 * /components et contiennent le jeton {{ROOT}}, remplacé ici par la valeur
 * de window.DC_ROOT selon la profondeur de la page courante.
 */
const Layout = (() => {
  async function fetchPartial(path) {
    const res = await fetch((window.DC_ROOT || "./") + path);
    if (!res.ok) throw new Error(`Partial introuvable : ${path}`);
    const text = await res.text();
    return text.replaceAll("{{ROOT}}", window.DC_ROOT || "./");
  }

  function markActive(root, currentPage) {
    root.querySelectorAll("[data-page]").forEach((el) => {
      if (el.dataset.page === currentPage) el.classList.add("active");
    });
  }

  /** Navbar + footer pour les pages publiques (visiteur non connecté ou lien "accueil"). */
  async function mountPublic(currentPage) {
    const navHost = document.getElementById("dc-public-navbar");
    if (navHost) {
      navHost.outerHTML = await fetchPartial("components/navbar-public.html");
      markActive(document, currentPage);
      await reflectSessionInPublicNav();
      wireMobileNavClose();
    }
    const footHost = document.getElementById("dc-public-footer");
    if (footHost) {
      footHost.outerHTML = await fetchPartial("components/footer-public.html");
    }
  }

  async function reflectSessionInPublicNav() {
    const session = Auth.getSession();
    const authArea = document.getElementById("dc-public-auth-area");
    if (!authArea) return;
    if (!session) return; // le partial affiche déjà "Connexion / Inscription" par défaut
    const user = await Auth.getCurrentUser();
    if (!user) return;
    let href = `pages/${user.role}/dashboard.html`;
    if (user.role === "staff" && window.Permissions) {
      const staffList = await DataStore.getStaff();
      const staff = staffList.find((s) => s.userId === user.id);
      if (staff) href = `pages/staff/${await Permissions.landingPageFor(staff.accessLevel)}`;
    }
    authArea.innerHTML = `
      <a href="{{ROOT}}${href}" class="btn btn-primary btn-sm">
        Mon espace <i class="bi bi-arrow-right"></i>
      </a>`.replaceAll("{{ROOT}}", window.DC_ROOT || "./");
  }

  function wireMobileNavClose() {
    document.querySelectorAll("#dcPublicNav .nav-link").forEach((link) => {
      link.addEventListener("click", () => {
        const nav = document.getElementById("dcPublicNav");
        if (nav && nav.classList.contains("show")) {
          bootstrap.Collapse.getOrCreateInstance(nav).hide();
        }
      });
    });
  }

  const ROLE_LABELS = {
    filleul: "Filleul",
    parrain: "Parrain / Marraine",
    proprietaire: "Propriétaire",
    admin: "Administrateur",
    staff: "Équipe DiaspoConnect",
  };

  function wireSidebarToggle() {
    const toggleBtn = document.getElementById("dc-sidebar-toggle");
    const sidebar = document.getElementById("dc-sidebar");
    const backdrop = document.getElementById("dc-sidebar-backdrop");
    if (toggleBtn && sidebar && backdrop) {
      const closeSidebar = () => { sidebar.classList.remove("show"); backdrop.classList.remove("show"); };
      toggleBtn.addEventListener("click", () => {
        sidebar.classList.toggle("show");
        backdrop.classList.toggle("show");
      });
      backdrop.addEventListener("click", closeSidebar);
      sidebar.querySelectorAll("a").forEach((a) => a.addEventListener("click", closeSidebar));
    }
  }

  async function wireUserChrome(user, roleLabelOverride) {
    if (!user) return;
    document.querySelectorAll(".dc-current-user-name").forEach((el) => (el.textContent = `${user.firstName} ${user.lastName}`));
    document.querySelectorAll(".dc-current-user-role").forEach((el) => (el.textContent = roleLabelOverride || ROLE_LABELS[user.role] || user.role));
    document.querySelectorAll(".dc-current-user-initials").forEach((el) => {
      el.textContent = user.avatarInitials;
      el.style.background = user.avatarColor;
    });
    const logoutBtn = document.getElementById("dc-logout-btn");
    if (logoutBtn) logoutBtn.addEventListener("click", (e) => { e.preventDefault(); Auth.logout(); });

    const notifDropdown = document.getElementById("dc-notif-dropdown-body");
    if (notifDropdown) await NotificationCenter.mount(notifDropdown, user.id);
  }

  /** Header + sidebar pour les espaces authentifiés historiques (filleul/parrain/proprietaire/admin). */
  async function mountApp(role, currentPage, user) {
    const headerHost = document.getElementById("dc-app-header");
    if (headerHost) {
      headerHost.outerHTML = await fetchPartial("components/app-header.html");
    }
    const sidebarHost = document.getElementById("dc-app-sidebar");
    if (sidebarHost) {
      sidebarHost.outerHTML = await fetchPartial(`components/sidebar-${role}.html`);
      markActive(document, currentPage);
    }
    wireSidebarToggle();
    await wireUserChrome(user);
  }

  /**
   * Modules disponibles dans l'espace interne (pages/staff/*), groupés pour
   * la sidebar. L'accès réel est filtré par Permissions.can() selon l'accessLevel
   * du membre connecté - un module absent de la liste autorisée n'apparaît pas.
   */
  const STAFF_NAV = [
    { id: "staff-dashboard", label: "Tableau de bord direction", icon: "bi-speedometer2", href: "staff-dashboard.html", group: "Général" },
    { id: "secretariat-dashboard", label: "Secrétariat", icon: "bi-inboxes", href: "secretariat-dashboard.html", group: "Espaces métier" },
    { id: "advisors-dashboard", label: "Conseil (démarches/logement/emploi)", icon: "bi-people", href: "advisors-dashboard.html", group: "Espaces métier" },
    { id: "moderation-dashboard", label: "Modération & confiance", icon: "bi-shield-check", href: "moderation-dashboard.html", group: "Espaces métier" },
    { id: "support-dashboard", label: "Support utilisateur", icon: "bi-headset", href: "support-dashboard.html", group: "Espaces métier" },
    { id: "partnerships-dashboard", label: "Partenariats", icon: "bi-briefcase", href: "partnerships-dashboard.html", group: "Espaces métier" },
    { id: "content-dashboard", label: "Contenu & ressources", icon: "bi-journal-richtext", href: "content-dashboard.html", group: "Espaces métier" },
    { id: "compliance-dashboard", label: "Vérification & conformité", icon: "bi-patch-check", href: "compliance-dashboard.html", group: "Espaces métier" },
    { id: "technical-dashboard", label: "Technique", icon: "bi-cpu", href: "technical-dashboard.html", group: "Espaces métier" },
    { id: "tickets-management", label: "Centre de tickets", icon: "bi-ticket-perforated", href: "tickets-management.html", group: "Outils transverses" },
    { id: "staff-directory", label: "Annuaire interne", icon: "bi-people-fill", href: "staff-directory.html", group: "Outils transverses" },
    { id: "org-management", label: "Organisation", icon: "bi-diagram-3", href: "org-management.html", group: "Outils transverses" },
  ];

  async function buildStaffSidebar(accessLevel) {
    const perm = await Permissions.getFor(accessLevel);
    const allowedIds = accessLevel === "super_admin" ? STAFF_NAV.map((n) => n.id) : (perm ? perm.modules : []);
    const items = STAFF_NAV.filter((n) => allowedIds.includes(n.id));
    const groups = [];
    items.forEach((item) => {
      let group = groups.find((g) => g.name === item.group);
      if (!group) { group = { name: item.group, items: [] }; groups.push(group); }
      group.items.push(item);
    });
    return `<aside class="dc-sidebar" id="dc-sidebar" aria-label="Navigation de l'espace interne">
      ${groups.map((g) => `
        <p class="dc-sidebar-section">${g.name}</p>
        ${g.items.map((i) => `<a class="dc-sidebar-link" data-page="${i.id}" href="${i.href}"><i class="bi ${i.icon}"></i>${i.label}</a>`).join("")}
      `).join("")}
    </aside>`;
  }

  /** Header + sidebar dynamique pour l'espace interne (pages/staff/*), filtrée par accessLevel. */
  async function mountStaffApp(currentModuleId, ctx) {
    const headerHost = document.getElementById("dc-app-header");
    if (headerHost) {
      headerHost.outerHTML = await fetchPartial("components/app-header.html");
    }
    const sidebarHost = document.getElementById("dc-app-sidebar");
    if (sidebarHost && ctx?.staff) {
      sidebarHost.outerHTML = await buildStaffSidebar(ctx.staff.accessLevel);
      markActive(document, currentModuleId);
    }
    wireSidebarToggle();
    if (ctx?.user && ctx?.staff) {
      const perm = await Permissions.getFor(ctx.staff.accessLevel);
      await wireUserChrome(ctx.user, `${ctx.staff.position} · ${perm ? perm.label : ctx.staff.accessLevel}`);
      const paramsLink = document.getElementById("dc-params-link");
      if (paramsLink) {
        paramsLink.href = "staff-directory.html";
        paramsLink.innerHTML = '<i class="bi bi-person-badge me-2"></i>Ma fiche interne';
      }
    }
  }

  return { mountPublic, mountApp, mountStaffApp, fetchPartial };
})();
