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
      await mountSiteBanner();
    }
    const footHost = document.getElementById("dc-public-footer");
    if (footHost) {
      footHost.outerHTML = await fetchPartial("components/footer-public.html");
    }
  }

  /**
   * Bannière d'information publique : affiche la première annonce active
   * (fenêtre startsAt/endsAt courante) destinée à "tous". Un visiteur qui la
   * ferme ne la revoit plus pour la session en cours (sessionStorage, pas de
   * persistance permanente côté client).
   */
  async function mountSiteBanner() {
    const host = document.getElementById("dc-site-banner");
    if (!host || typeof DataStore === "undefined") return;
    const DEMO_TODAY = new Date("2026-07-25T09:00:00");
    const dismissed = JSON.parse(sessionStorage.getItem("dc_dismissed_banners") || "[]");
    const announcements = await DataStore.getAnnouncements();
    const active = announcements.find((a) => (
      a.audience === "tous" &&
      new Date(a.startsAt) <= DEMO_TODAY && DEMO_TODAY <= new Date(a.endsAt) &&
      !dismissed.includes(a.id)
    ));
    if (!active) { host.innerHTML = ""; return; }
    host.innerHTML = `
      <div class="dc-site-banner" role="status">
        <div class="container d-flex align-items-center gap-2 py-2">
          <i class="bi bi-megaphone flex-shrink-0"></i>
          <span class="flex-grow-1 small"><strong>${active.title}</strong> — ${active.body}</span>
          <button type="button" class="btn-close btn-close-white flex-shrink-0" aria-label="Fermer" id="dc-site-banner-close"></button>
        </div>
      </div>`;
    document.getElementById("dc-site-banner-close").addEventListener("click", () => {
      dismissed.push(active.id);
      sessionStorage.setItem("dc_dismissed_banners", JSON.stringify(dismissed));
      host.innerHTML = "";
    });
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
    mentore: "Mentoré",
    mentor: "Mentor",
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

    mountImpersonationBanner();
  }

  /** Bandeau persistant affiché sur toute page authentifiée tant qu'une incarnation admin est active. */
  function mountImpersonationBanner() {
    const info = Auth.getImpersonationInfo();
    let banner = document.getElementById("dc-impersonation-banner");
    if (!info) { if (banner) banner.remove(); return; }
    if (banner) return; // déjà affiché sur cette page
    banner = document.createElement("div");
    banner.id = "dc-impersonation-banner";
    banner.className = "dc-impersonation-banner";
    banner.setAttribute("role", "status");
    banner.innerHTML = `
      <i class="bi bi-person-badge"></i>
      <span>Vous visualisez la plateforme en tant que <strong>${DCUtils.escapeHtml(info.targetLabel)}</strong> (${ROLE_LABELS[info.targetRole] || info.targetRole}).</span>
      <button type="button" class="btn btn-sm btn-light ms-auto" id="dc-stop-impersonation-btn">Revenir à mon compte admin</button>`;
    document.body.prepend(banner);
    document.getElementById("dc-stop-impersonation-btn").addEventListener("click", () => {
      Auth.stopImpersonation();
      window.location.href = `${window.DC_ROOT || "./"}pages/admin/utilisateurs.html`;
    });
  }

  /** Header + sidebar pour les espaces authentifiés historiques (mentore/mentor/proprietaire/admin). */
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
    { id: "kanban", label: "Mes tâches (Kanban)", icon: "bi-kanban", href: "kanban.html", group: "Outils transverses" },
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
