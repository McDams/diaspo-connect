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
    authArea.innerHTML = `
      <a href="{{ROOT}}pages/${user.role}/dashboard.html" class="btn btn-primary btn-sm">
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
  };

  /** Header + sidebar pour les espaces authentifiés. `role` détermine la sidebar chargée. */
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

    // Bascule sidebar mobile
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

    // Infos utilisateur + déconnexion + notifications
    if (user) {
      document.querySelectorAll(".dc-current-user-name").forEach((el) => (el.textContent = `${user.firstName} ${user.lastName}`));
      document.querySelectorAll(".dc-current-user-role").forEach((el) => (el.textContent = ROLE_LABELS[user.role] || user.role));
      document.querySelectorAll(".dc-current-user-initials").forEach((el) => {
        el.textContent = user.avatarInitials;
        el.style.background = user.avatarColor;
      });
      const logoutBtn = document.getElementById("dc-logout-btn");
      if (logoutBtn) logoutBtn.addEventListener("click", (e) => { e.preventDefault(); Auth.logout(); });

      const notifDropdown = document.getElementById("dc-notif-dropdown-body");
      if (notifDropdown) await NotificationCenter.mount(notifDropdown, user.id);
    }
  }

  return { mountPublic, mountApp, fetchPartial };
})();
