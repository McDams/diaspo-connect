/**
 * KanbanBoard - composant d'affichage réutilisable pour tous les tableaux de
 * tâches de la plateforme (espaces personnels, boards de pôle, Kanban central
 * admin). Consomme KanbanEngine pour toute mutation - ce fichier ne fait que
 * du rendu DOM + câblage d'événements (drag&drop, filtres, modals).
 */
const KanbanBoard = (() => {
  let STATE = null; // { config, columns, labels, users, staff, departments }

  const STATUS_LABELS = { todo: "À faire", in_progress: "En cours", blocked: "En attente / bloqué", done: "Terminé" };

  /** Un identifiant de carte (owner/assignee) est soit un userId (u-xxx), soit un staffId (staff-xxx). */
  function resolveUser(id, users, staff) {
    if (!id) return null;
    if (id.startsWith("staff-")) {
      const s = (staff || []).find((x) => x.id === id);
      if (!s) return null;
      const u = (users || []).find((x) => x.id === s.userId);
      return u ? { ...u, staffPosition: s.position } : { id, firstName: s.position, lastName: "", avatarInitials: s.position.slice(0, 2).toUpperCase(), avatarColor: "#5B4B8A" };
    }
    return (users || []).find((x) => x.id === id) || null;
  }

  function userLabel(id, users, staff) {
    const u = resolveUser(id, users, staff);
    if (!u) return id;
    return u.lastName ? `${u.firstName} ${u.lastName}` : u.firstName;
  }

  function avatarChip(id, users, staff) {
    const u = resolveUser(id, users, staff);
    const label = userLabel(id, users, staff);
    const initials = u ? u.avatarInitials : label.slice(0, 2).toUpperCase();
    const color = u ? u.avatarColor : "#5B4B8A";
    return `<span class="dc-avatar dc-avatar-xs" style="background:${color}" title="${DCUtils.escapeHtml(label)}">${initials}</span>`;
  }

  function cardMeta(card) {
    const overdue = KanbanEngine.isOverdue(card);
    const dueSoon = KanbanEngine.isDueSoon(card);
    return { overdue, dueSoon };
  }

  function cardChecklistProgress(card) {
    const items = card.checklist || [];
    if (!items.length) return "";
    const done = items.filter((i) => i.done).length;
    return `<span class="dc-kanban-meta-chip"><i class="bi bi-check2-square"></i>${done}/${items.length}</span>`;
  }

  function cardHtml(card, { labels, users, staff, showBoardTag }) {
    const { overdue, dueSoon } = cardMeta(card);
    const labelChips = (card.labels || []).map((lid) => {
      const l = labels.find((x) => x.id === lid);
      if (!l) return "";
      return `<span class="dc-kanban-label-chip" style="background:${l.color}22;color:${l.color};border-color:${l.color}55">${DCUtils.escapeHtml(l.name)}</span>`;
    }).join("");
    const assignees = (card.assignees || []).map((id) => avatarChip(id, users, staff)).join("");
    const ownerChip = card.ownerId ? avatarChip(card.ownerId, users, staff) : "";
    const dueChip = card.dueDate
      ? `<span class="dc-kanban-meta-chip ${overdue ? "dc-kanban-overdue" : dueSoon ? "dc-kanban-due-soon" : ""}"><i class="bi bi-calendar-event"></i>${DCUtils.formatDate(card.dueDate)}</span>`
      : "";
    const commentsChip = card.comments?.length ? `<span class="dc-kanban-meta-chip"><i class="bi bi-chat-left-text"></i>${card.comments.length}</span>` : "";
    const boardTag = showBoardTag && card.__boardName ? `<span class="dc-kanban-board-tag">${DCUtils.escapeHtml(card.__boardName)}</span>` : "";
    return `
      <div class="dc-kanban-card ${card.blocked ? "is-blocked" : ""}" draggable="true" data-card-id="${card.id}" tabindex="0" role="button" aria-label="${DCUtils.escapeHtml(card.title)}">
        <div class="dc-kanban-card-top">
          ${boardTag}
          <span class="dc-badge dc-priority-${card.priority}">${{ basse: "Basse", normale: "Normale", haute: "Haute", urgente: "Urgente" }[card.priority] || card.priority}</span>
        </div>
        <p class="dc-kanban-card-title">${DCUtils.escapeHtml(card.title)}</p>
        ${labelChips ? `<div class="dc-kanban-labels">${labelChips}</div>` : ""}
        <div class="dc-kanban-card-meta">
          ${dueChip}${cardChecklistProgress(card)}${commentsChip}
          ${card.blocked ? `<span class="dc-kanban-meta-chip dc-kanban-overdue"><i class="bi bi-slash-circle"></i>Bloquée</span>` : ""}
        </div>
        <div class="dc-kanban-card-footer">
          <div class="dc-kanban-avatars">${ownerChip}${assignees}</div>
          ${(!card.assignees || !card.assignees.length) && !card.ownerId ? `<span class="small text-muted-dc">Non assignée</span>` : ""}
        </div>
      </div>`;
  }

  function columnHtml(col, ctx) {
    return `
      <div class="dc-kanban-column" data-column-key="${col.key}">
        <div class="dc-kanban-column-head">
          <span>${DCUtils.escapeHtml(col.name)}</span>
          <span class="badge text-bg-light border">${col.cards.length}</span>
        </div>
        <div class="dc-kanban-column-body" data-drop-key="${col.key}">
          ${col.cards.map((c) => cardHtml(c, ctx)).join("") || `<p class="dc-empty-mini">Aucune carte</p>`}
        </div>
      </div>`;
  }

  const VIEW_TABS = [
    { key: "board", label: "Tableau", icon: "bi-kanban" },
    { key: "list", label: "Liste", icon: "bi-list-ul" },
    { key: "calendar", label: "Calendrier", icon: "bi-calendar3" },
    { key: "overdue", label: "En retard", icon: "bi-exclamation-triangle" },
    { key: "blocked", label: "Bloquées", icon: "bi-slash-circle" },
    { key: "done", label: "Terminées", icon: "bi-check2-circle" },
  ];

  function buildViewTabs(container) {
    const nav = document.createElement("div");
    nav.className = "dc-kanban-view-tabs";
    nav.setAttribute("role", "tablist");
    nav.setAttribute("aria-label", "Vue du tableau de tâches");
    nav.innerHTML = VIEW_TABS.map((v) => `<button type="button" class="dc-kanban-view-tab ${v.key === "board" ? "active" : ""}" data-view="${v.key}" role="tab" aria-selected="${v.key === "board"}"><i class="bi ${v.icon} me-1"></i>${v.label}</button>`).join("");
    container.appendChild(nav);
    nav.querySelectorAll("[data-view]").forEach((btn) => {
      btn.addEventListener("click", () => {
        STATE.viewMode = btn.dataset.view;
        nav.querySelectorAll("[data-view]").forEach((b) => { b.classList.toggle("active", b === btn); b.setAttribute("aria-selected", b === btn ? "true" : "false"); });
        refresh(container.closest(".dc-kanban-root"));
      });
    });
    return nav;
  }

  function buildToolbar(container, config) {
    const bar = document.createElement("div");
    bar.className = "dc-kanban-toolbar";
    bar.innerHTML = `
      <div class="d-flex flex-wrap gap-2 align-items-center flex-grow-1">
        <input type="search" class="form-control form-control-sm dc-kanban-search" style="max-width:220px" placeholder="Rechercher une carte…" aria-label="Rechercher une carte">
        <select class="form-select form-select-sm dc-kanban-filter" data-filter="priority" style="max-width:150px">
          <option value="">Toutes priorités</option>
          <option value="urgente">Urgente</option>
          <option value="haute">Haute</option>
          <option value="normale">Normale</option>
          <option value="basse">Basse</option>
        </select>
        ${config.showDepartmentFilter ? `<select class="form-select form-select-sm dc-kanban-filter" data-filter="department" style="max-width:190px"><option value="">Tous les pôles</option>${(STATE.departments || []).map((d) => `<option value="${d.id}">${DCUtils.escapeHtml(d.shortName || d.name)}</option>`).join("")}</select>` : ""}
        ${config.showAssigneeFilter ? `<select class="form-select form-select-sm dc-kanban-filter" data-filter="assignee" style="max-width:190px"><option value="">Tous les membres</option>${(config.assignableUsers || []).map((u) => `<option value="${u.id}">${DCUtils.escapeHtml(u.label)}</option>`).join("")}</select>` : ""}
        <div class="form-check form-check-inline small">
          <input class="form-check-input dc-kanban-filter" type="checkbox" data-filter="overdue" id="kf-overdue">
          <label class="form-check-label" for="kf-overdue">En retard</label>
        </div>
        <div class="form-check form-check-inline small">
          <input class="form-check-input dc-kanban-filter" type="checkbox" data-filter="unassigned" id="kf-unassigned">
          <label class="form-check-label" for="kf-unassigned">Non assignées</label>
        </div>
        <div class="form-check form-check-inline small">
          <input class="form-check-input dc-kanban-filter" type="checkbox" data-filter="blocked" id="kf-blocked">
          <label class="form-check-label" for="kf-blocked">Bloquées</label>
        </div>
        <div class="form-check form-check-inline small">
          <input class="form-check-input dc-kanban-filter" type="checkbox" data-filter="mine" id="kf-mine">
          <label class="form-check-label" for="kf-mine">Mes tâches</label>
        </div>
      </div>
      ${config.canCreate ? `<button type="button" class="btn btn-primary btn-sm dc-kanban-create-btn"><i class="bi bi-plus-lg me-1"></i>Nouvelle carte</button>` : ""}
    `;
    container.appendChild(bar);
    return bar;
  }

  function groupCentral(cards) {
    const order = ["todo", "in_progress", "blocked", "done"];
    return order.map((key) => ({ key, name: STATUS_LABELS[key], isDoneColumn: key === "done", cards: cards.filter((c) => (c.blocked ? "blocked" : c.status) === key) }));
  }

  function groupBoard(lists, cards) {
    return lists.map((l) => ({ key: l.id, name: l.name, isDoneColumn: l.isDoneColumn, cards: cards.filter((c) => c.listId === l.id) }));
  }

  function currentFilters(root) {
    const filters = {};
    root.querySelectorAll("[data-filter]").forEach((el) => {
      if (el.type === "checkbox") { if (el.checked) filters[el.dataset.filter] = true; }
      else if (el.value) filters[el.dataset.filter] = el.value;
    });
    const search = root.querySelector(".dc-kanban-search");
    if (search && search.value.trim()) filters.search = search.value.trim();
    if (filters.mine) { filters.assigneeOrOwner = STATE.config.currentUser.matchId; delete filters.mine; }
    return filters;
  }

  async function refresh(root) {
    const filters = currentFilters(root);
    let cards, lists;
    if (STATE.config.mode === "central") {
      const ctx = await KanbanEngine.centralContext(filters);
      STATE.users = ctx.users; STATE.staff = ctx.staff; STATE.departments = ctx.departments; STATE.labels = ctx.labels;
      cards = ctx.cards.map((c) => ({ ...c, __boardName: (ctx.boards.find((b) => b.id === c.boardId) || {}).name }));
      if (filters.assigneeOrOwner) cards = cards.filter((c) => (c.assignees || []).includes(filters.assigneeOrOwner) || c.ownerId === filters.assigneeOrOwner);
    } else {
      const ctx = await KanbanEngine.boardContext(STATE.config.boardId);
      STATE.labels = ctx.labels; STATE.users = ctx.users; STATE.staff = ctx.staff;
      lists = ctx.lists;
      cards = ctx.cards;
      // Un board "personnel" (mentore/mentor/proprietaire) est un modèle partagé par tous les
      // membres du rôle : chacun ne doit voir QUE ses propres cartes, jamais celles des autres.
      if (STATE.config.selfOwned) cards = cards.filter((c) => c.ownerId === STATE.config.currentUser.matchId);
      cards = KanbanEngine.applyFilters(cards, filters);
      if (filters.assigneeOrOwner) cards = cards.filter((c) => (c.assignees || []).includes(filters.assigneeOrOwner) || c.ownerId === filters.assigneeOrOwner);
    }
    STATE.flatCards = cards;
    STATE.lists = lists;

    const mode = STATE.viewMode || "board";
    if (mode === "board") {
      STATE.columns = STATE.config.mode === "central" ? groupCentral(cards) : groupBoard(lists, cards);
      renderColumns(root);
    } else if (mode === "calendar") {
      renderCalendar(root, cards);
    } else {
      const quick = mode === "overdue" ? cards.filter((c) => KanbanEngine.isOverdue(c))
        : mode === "blocked" ? cards.filter((c) => c.blocked)
        : mode === "done" ? cards.filter((c) => c.status === "done")
        : cards;
      renderList(root, quick);
    }
  }

  function ensureViewBody(root) {
    const body = root.querySelector(".dc-kanban-view-body");
    body.innerHTML = "";
    return body;
  }

  function renderColumns(root) {
    const body = ensureViewBody(root);
    const holder = document.createElement("div");
    holder.className = "dc-kanban-columns";
    holder.innerHTML = STATE.columns.map((c) => columnHtml(c, { labels: STATE.labels, users: STATE.users, staff: STATE.staff, showBoardTag: STATE.config.mode === "central" })).join("");
    body.appendChild(holder);
    wireCardEvents(holder);
    wireDragDrop(holder);
  }

  function listRowHtml(card) {
    const { overdue, dueSoon } = cardMeta(card);
    const assignees = (card.assignees || []).map((id) => avatarChip(id, STATE.users, STATE.staff)).join("") || (card.ownerId ? avatarChip(card.ownerId, STATE.users, STATE.staff) : "");
    return `<tr class="dc-kanban-list-row" data-card-id="${card.id}" tabindex="0" role="button" aria-label="${DCUtils.escapeHtml(card.title)}">
      <td>
        <div class="fw-semibold small">${DCUtils.escapeHtml(card.title)}</div>
        ${STATE.config.mode === "central" && card.__boardName ? `<div class="text-muted-dc small">${DCUtils.escapeHtml(card.__boardName)}</div>` : ""}
      </td>
      <td><span class="dc-badge dc-priority-${card.priority}">${{ basse: "Basse", normale: "Normale", haute: "Haute", urgente: "Urgente" }[card.priority] || card.priority}</span></td>
      <td class="small ${overdue ? "text-danger fw-semibold" : dueSoon ? "text-warning" : ""}">${card.dueDate ? DCUtils.formatDate(card.dueDate) : "-"}</td>
      <td>${assignees || `<span class="small text-muted-dc">Non assignée</span>`}</td>
      <td>${card.blocked ? `<span class="dc-badge dc-badge-danger">Bloquée</span>` : `<span class="dc-badge dc-badge-neutral">${STATUS_LABELS[card.status] || card.status}</span>`}</td>
    </tr>`;
  }

  function renderList(root, cards) {
    const body = ensureViewBody(root);
    const wrap = document.createElement("div");
    wrap.className = "dc-card p-0";
    wrap.innerHTML = `
      <div class="table-responsive">
        <table class="table dc-table mb-0 align-middle">
          <thead><tr><th>Carte</th><th>Priorité</th><th>Échéance</th><th>Assigné(e)</th><th>Statut</th></tr></thead>
          <tbody>${cards.map(listRowHtml).join("") || `<tr><td colspan="5"><p class="dc-empty-mini py-3">Aucune carte pour cette vue.</p></td></tr>`}</tbody>
        </table>
      </div>`;
    body.appendChild(wrap);
    wireCardEvents(wrap);
  }

  function renderCalendar(root, cards) {
    const body = ensureViewBody(root);
    if (!STATE.calendarMonth) STATE.calendarMonth = new Date(KanbanEngine.TODAY.getFullYear(), KanbanEngine.TODAY.getMonth(), 1);
    if (STATE.calendarSelected === undefined) STATE.calendarSelected = toDateKey(KanbanEngine.TODAY);
    const month = STATE.calendarMonth;
    const monthNames = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
    const weekdays = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
    const dated = cards.filter((c) => c.dueDate);

    const firstOfMonth = new Date(month);
    const startOffset = (firstOfMonth.getDay() + 6) % 7;
    const gridStart = new Date(firstOfMonth);
    gridStart.setDate(firstOfMonth.getDate() - startOffset);
    const cells = Array.from({ length: 42 }, (_, i) => { const d = new Date(gridStart); d.setDate(gridStart.getDate() + i); return d; });

    const wrap = document.createElement("div");
    wrap.className = "row g-3";
    wrap.innerHTML = `
      <div class="col-lg-8">
        <div class="dc-card p-3">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <h6 class="mb-0"><i class="bi bi-calendar3 me-2 text-primary"></i>${monthNames[month.getMonth()]} ${month.getFullYear()}</h6>
            <div class="btn-group btn-group-sm">
              <button type="button" class="btn btn-outline-secondary" data-cal-nav="-1"><i class="bi bi-chevron-left"></i></button>
              <button type="button" class="btn btn-outline-secondary" data-cal-nav="1"><i class="bi bi-chevron-right"></i></button>
            </div>
          </div>
          <div class="dc-calendar-grid">
            ${weekdays.map((w) => `<div class="dc-calendar-weekday">${w}</div>`).join("")}
            ${cells.map((d) => {
              const key = toDateKey(d);
              const outside = d.getMonth() !== month.getMonth();
              const isToday = key === toDateKey(KanbanEngine.TODAY);
              const isSelected = key === STATE.calendarSelected;
              const dayCards = dated.filter((c) => c.dueDate === key);
              const dots = dayCards.slice(0, 4).map((c) => `<span class="dc-calendar-dot ${KanbanEngine.isOverdue(c) ? "dot-overdue" : isToday ? "dot-today" : "dot-upcoming"}"></span>`).join("");
              if (outside) return `<div class="dc-calendar-day is-outside" aria-hidden="true"><span class="dc-calendar-day-num">${d.getDate()}</span></div>`;
              return `<div class="dc-calendar-day ${isToday ? "is-today" : ""} ${isSelected ? "is-selected" : ""}" data-date="${key}" role="button" tabindex="0" aria-pressed="${isSelected}" aria-label="${d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long" })}${dayCards.length ? `, ${dayCards.length} échéance(s)` : ""}">
                <span class="dc-calendar-day-num">${d.getDate()}</span>
                <span class="dc-calendar-day-dots">${dots}</span>
              </div>`;
            }).join("")}
          </div>
        </div>
      </div>
      <div class="col-lg-4">
        <div class="dc-card p-3" id="dc-kanban-day-panel"></div>
      </div>`;
    body.appendChild(wrap);

    wrap.querySelectorAll("[data-cal-nav]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const delta = Number(btn.dataset.calNav);
        STATE.calendarMonth = new Date(month.getFullYear(), month.getMonth() + delta, 1);
        renderCalendar(root, STATE.flatCards);
      });
    });
    wrap.querySelectorAll(".dc-calendar-day:not(.is-outside)").forEach((el) => {
      const select = () => { STATE.calendarSelected = el.dataset.date; renderCalendar(root, STATE.flatCards); };
      el.addEventListener("click", select);
      el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(); } });
    });
    renderDayPanel(wrap, dated);
  }

  function renderDayPanel(wrap, dated) {
    const panel = wrap.querySelector("#dc-kanban-day-panel");
    const key = STATE.calendarSelected;
    const dayCards = dated.filter((c) => c.dueDate === key);
    const label = key ? new Date(key + "T12:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }) : "Sélectionnez un jour";
    panel.innerHTML = `<h6 class="mb-3"><i class="bi bi-calendar-event me-2 text-primary"></i>${label}</h6>` +
      (dayCards.length
        ? `<div class="dc-kanban-daylist">${dayCards.map((c) => cardHtml(c, { labels: STATE.labels, users: STATE.users, staff: STATE.staff, showBoardTag: STATE.config.mode === "central" })).join("")}</div>`
        : `<p class="dc-empty-mini">Aucune échéance ce jour-là.</p>`);
    wireCardEvents(panel);
  }

  function toDateKey(d) { return d.toISOString().slice(0, 10); }

  function wireCardEvents(holder) {
    holder.querySelectorAll(".dc-kanban-card").forEach((el) => {
      el.addEventListener("click", () => openCardDetail(el.dataset.cardId));
      el.addEventListener("keydown", (e) => { if (e.key === "Enter") openCardDetail(el.dataset.cardId); });
      el.addEventListener("dragstart", (e) => { e.dataTransfer.setData("text/card-id", el.dataset.cardId); el.classList.add("is-dragging"); });
      el.addEventListener("dragend", () => el.classList.remove("is-dragging"));
    });
  }

  function wireDragDrop(holder) {
    holder.querySelectorAll(".dc-kanban-column-body").forEach((zone) => {
      zone.addEventListener("dragover", (e) => { e.preventDefault(); zone.classList.add("is-drop-target"); });
      zone.addEventListener("dragleave", () => zone.classList.remove("is-drop-target"));
      zone.addEventListener("drop", async (e) => {
        e.preventDefault();
        zone.classList.remove("is-drop-target");
        const cardId = e.dataTransfer.getData("text/card-id");
        if (!cardId) return;
        const key = zone.dataset.dropKey;
        const actor = { id: STATE.config.currentUser.id, label: STATE.config.currentUser.label };
        if (STATE.config.mode === "central") await KanbanEngine.moveCardToStatus(cardId, key, actor);
        else await KanbanEngine.moveCard(cardId, key, actor);
        DCUtils.toast("Carte déplacée.", "success");
        await refresh(zone.closest(".dc-kanban-root"));
      });
    });
  }

  function assignableOptions() {
    return (STATE.assignableUsers || []).map((u) => `<option value="${u.id}">${DCUtils.escapeHtml(u.label)}</option>`).join("");
  }

  async function openCardDetail(cardId) {
    const cards = await DataStore.getCards();
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;
    const activity = await KanbanEngine.activityForCard(cardId);
    const lists = (await DataStore.getLists()).filter((l) => l.boardId === card.boardId).sort((a, b) => a.order - b.order);

    let modal = document.getElementById("dc-kanban-detail-modal");
    if (modal) modal.remove();
    modal = document.createElement("div");
    modal.className = "modal fade";
    modal.id = "dc-kanban-detail-modal";
    modal.tabIndex = -1;
    modal.innerHTML = `
      <div class="modal-dialog modal-lg modal-dialog-scrollable">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">${DCUtils.escapeHtml(card.title)}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fermer"></button>
          </div>
          <div class="modal-body">
            <ul class="nav nav-tabs mb-3" role="tablist">
              <li class="nav-item"><button class="nav-link active" data-bs-toggle="tab" data-bs-target="#tab-detail">Détail</button></li>
              <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#tab-checklist">Checklist</button></li>
              <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#tab-comments">Commentaires</button></li>
              <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#tab-activity">Activité</button></li>
            </ul>
            <div class="tab-content">
              <div class="tab-pane fade show active" id="tab-detail">
                <p class="text-body-secondary small">${DCUtils.escapeHtml(card.description || "Aucune description.")}</p>
                <div class="row g-3">
                  <div class="col-sm-6">
                    <label class="form-label small">Colonne</label>
                    <select class="form-select form-select-sm" id="cd-list">${lists.map((l) => `<option value="${l.id}" ${l.id === card.listId ? "selected" : ""}>${DCUtils.escapeHtml(l.name)}</option>`).join("")}</select>
                  </div>
                  <div class="col-sm-6">
                    <label class="form-label small">Priorité</label>
                    <select class="form-select form-select-sm" id="cd-priority">
                      ${["basse", "normale", "haute", "urgente"].map((p) => `<option value="${p}" ${p === card.priority ? "selected" : ""}>${p}</option>`).join("")}
                    </select>
                  </div>
                  <div class="col-sm-6">
                    <label class="form-label small">Échéance</label>
                    <input type="date" class="form-control form-control-sm" id="cd-due" value="${card.dueDate || ""}">
                  </div>
                  <div class="col-sm-6">
                    <label class="form-label small">Assigné(e)(s)</label>
                    <select class="form-select form-select-sm" id="cd-assignees" multiple size="3">${(STATE.assignableUsers || []).map((u) => `<option value="${u.id}" ${(card.assignees || []).includes(u.id) ? "selected" : ""}>${DCUtils.escapeHtml(u.label)}</option>`).join("")}</select>
                  </div>
                </div>
                ${card.linkedRecordType ? `<div class="dc-banner dc-banner-info mt-3"><i class="bi bi-link-45deg"></i><span>Liée à : ${DCUtils.escapeHtml(card.linkedRecordType)} ${DCUtils.escapeHtml(card.linkedRecordId || "")}</span></div>` : ""}
                <button type="button" class="btn btn-primary btn-sm mt-3" id="cd-save">Enregistrer les modifications</button>
              </div>
              <div class="tab-pane fade" id="tab-checklist">
                ${(card.checklist || []).map((item) => `
                  <div class="form-check">
                    <input class="form-check-input dc-checklist-toggle" type="checkbox" ${item.done ? "checked" : ""} data-item-id="${item.id}" id="chk-${item.id}">
                    <label class="form-check-label ${item.done ? "text-decoration-line-through text-muted-dc" : ""}" for="chk-${item.id}">${DCUtils.escapeHtml(item.text)}</label>
                  </div>`).join("") || `<p class="dc-empty-mini">Aucun élément de checklist.</p>`}
              </div>
              <div class="tab-pane fade" id="tab-comments">
                <div class="dc-kanban-comments mb-3">
                  ${(card.comments || []).map((c) => `<div class="dc-kanban-comment"><strong>${DCUtils.escapeHtml(c.authorLabel)}</strong><span class="text-muted-dc small ms-2">${DCUtils.timeAgo(c.createdAt)}</span><p class="mb-0 small">${DCUtils.escapeHtml(c.text)}</p></div>`).join("") || `<p class="dc-empty-mini">Aucun commentaire.</p>`}
                </div>
                <div class="dc-banner dc-banner-warning mb-2"><i class="bi bi-shield-lock"></i><span>Les commentaires internes ne sont jamais visibles par les utilisateurs.</span></div>
                <div class="input-group">
                  <input type="text" class="form-control form-control-sm" id="cd-comment-input" placeholder="Ajouter un commentaire interne…">
                  <button type="button" class="btn btn-outline-primary btn-sm" id="cd-comment-send">Envoyer</button>
                </div>
              </div>
              <div class="tab-pane fade" id="tab-activity">
                <ol class="dc-timeline dc-timeline-compact">
                  ${activity.map((a) => `<li class="is-done"><span class="dc-timeline-dot"></span><strong>${DCUtils.escapeHtml(a.actorLabel)}</strong> — ${DCUtils.escapeHtml(a.detail)}<div class="dc-timeline-date">${DCUtils.formatDateTime(a.createdAt)}</div></li>`).join("") || `<p class="dc-empty-mini">Aucune activité enregistrée.</p>`}
                </ol>
              </div>
            </div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modal);
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();

    const actor = { id: STATE.config.currentUser.id, label: STATE.config.currentUser.label };

    modal.querySelectorAll(".dc-checklist-toggle").forEach((cb) => {
      cb.addEventListener("change", async () => {
        await KanbanEngine.toggleChecklistItem(cardId, cb.dataset.itemId, actor);
        DCUtils.toast("Checklist mise à jour.", "success");
        await refresh(document.querySelector(".dc-kanban-root"));
      });
    });

    modal.querySelector("#cd-comment-send").addEventListener("click", async () => {
      const input = modal.querySelector("#cd-comment-input");
      if (!input.value.trim()) return;
      await KanbanEngine.addComment(cardId, actor, input.value.trim());
      DCUtils.toast("Commentaire ajouté.", "success");
      bsModal.hide();
      await refresh(document.querySelector(".dc-kanban-root"));
    });

    modal.querySelector("#cd-save").addEventListener("click", async () => {
      const listId = modal.querySelector("#cd-list").value;
      const priority = modal.querySelector("#cd-priority").value;
      const dueDate = modal.querySelector("#cd-due").value || null;
      const assignees = Array.from(modal.querySelector("#cd-assignees").selectedOptions).map((o) => o.value);
      if (listId !== card.listId) await KanbanEngine.moveCard(cardId, listId, actor);
      await KanbanEngine.updateCard(cardId, { priority, dueDate }, actor, "Détails de la carte mis à jour.");
      await KanbanEngine.assignCard(cardId, assignees, actor);
      DCUtils.toast("Carte mise à jour.", "success");
      bsModal.hide();
      await refresh(document.querySelector(".dc-kanban-root"));
    });

    modal.addEventListener("hidden.bs.modal", () => modal.remove());
  }

  function openCreateModal(root) {
    const lists = STATE.config.mode === "central" ? [] : STATE.columns;
    let modal = document.getElementById("dc-kanban-create-modal");
    if (modal) modal.remove();
    modal = document.createElement("div");
    modal.className = "modal fade";
    modal.id = "dc-kanban-create-modal";
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header"><h5 class="modal-title">Nouvelle carte</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
          <div class="modal-body">
            <form id="kc-form" novalidate>
              <div class="mb-3"><label class="form-label dc-required">Titre</label><input type="text" class="form-control" id="kc-title" required><div class="invalid-feedback">Le titre est obligatoire.</div></div>
              <div class="mb-3"><label class="form-label">Description</label><textarea class="form-control" id="kc-desc" rows="2"></textarea></div>
              <div class="row g-3">
                <div class="col-sm-6"><label class="form-label">Colonne</label><select class="form-select" id="kc-list">${(lists.length ? lists : STATE.columns).map((c) => `<option value="${c.key}">${DCUtils.escapeHtml(c.name)}</option>`).join("")}</select></div>
                <div class="col-sm-6"><label class="form-label">Priorité</label><select class="form-select" id="kc-priority"><option value="basse">Basse</option><option value="normale" selected>Normale</option><option value="haute">Haute</option><option value="urgente">Urgente</option></select></div>
                <div class="col-sm-6"><label class="form-label">Échéance</label><input type="date" class="form-control" id="kc-due"></div>
                <div class="col-sm-6"><label class="form-label">Assigné(e)</label><select class="form-select" id="kc-assignee"><option value="">—</option>${assignableOptions()}</select></div>
              </div>
              <button type="submit" class="btn btn-primary w-100 mt-3">Créer la carte</button>
            </form>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modal);
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
    modal.querySelector("#kc-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const title = modal.querySelector("#kc-title").value.trim();
      if (!title) { modal.querySelector("#kc-title").classList.add("is-invalid"); return; }
      const assignee = modal.querySelector("#kc-assignee").value;
      const actor = { id: STATE.config.currentUser.id, label: STATE.config.currentUser.label };
      const listId = STATE.config.mode === "central" ? null : modal.querySelector("#kc-list").value;
      await KanbanEngine.createCard({
        boardId: STATE.config.mode === "central" ? (STATE.config.defaultBoardId || "board-direction") : STATE.config.boardId,
        listId: listId || (STATE.columns[0] && STATE.columns[0].key),
        title, description: modal.querySelector("#kc-desc").value.trim(),
        priority: modal.querySelector("#kc-priority").value,
        dueDate: modal.querySelector("#kc-due").value || null,
        assignees: assignee ? [assignee] : [],
        ownerId: STATE.config.mode === "board" && STATE.config.selfOwned ? STATE.config.currentUser.id : null,
        department: STATE.config.departmentId || null,
      }, actor);
      DCUtils.toast("Carte créée.", "success");
      bsModal.hide();
      await refresh(root);
    });
    modal.addEventListener("hidden.bs.modal", () => modal.remove());
  }

  /**
   * config = { mode: "board"|"central", boardId, currentUser:{id,label,rbacKey},
   *   assignableUsers:[{id,label}], canCreate, showDepartmentFilter, showAssigneeFilter,
   *   selfOwned, departmentId, defaultBoardId }
   */
  async function mount(container, config) {
    const departments = config.showDepartmentFilter ? await DataStore.getDepartments() : [];
    STATE = { config, columns: [], labels: [], users: [], staff: [], departments, assignableUsers: config.assignableUsers || [], viewMode: "board" };
    container.innerHTML = "";
    const root = document.createElement("div");
    root.className = "dc-kanban-root";
    container.appendChild(root);
    buildViewTabs(root);
    buildToolbar(root, config);
    const viewBody = document.createElement("div");
    viewBody.className = "dc-kanban-view-body";
    root.appendChild(viewBody);

    root.querySelectorAll(".dc-kanban-filter").forEach((el) => el.addEventListener("change", () => refresh(root)));
    root.querySelector(".dc-kanban-search").addEventListener("input", DCUtils.debounce(() => refresh(root), 300));
    const createBtn = root.querySelector(".dc-kanban-create-btn");
    if (createBtn) createBtn.addEventListener("click", () => openCreateModal(root));

    await refresh(root);
  }

  return { mount, refresh, openCardDetail };
})();
