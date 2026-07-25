/**
 * KanbanEngine - logique métier du système de tâches type Trello, partagée par
 * tous les espaces (mentore/mentor/proprietaire/staff/admin). Opère sur les
 * collections DataStore (boards/lists/cards/labels/cardActivity) : aujourd'hui
 * en mémoire, demain via API sans changer l'interface exposée ici.
 *
 * "TODAY" est figé sur la date de démonstration des données mock pour que les
 * indicateurs de retard restent cohérents avec les échéances écrites dans le JSON.
 */
const KanbanEngine = (() => {
  const TODAY = new Date("2026-07-24T12:00:00");

  function isOverdue(card) {
    if (!card.dueDate || card.listDone) return false;
    return new Date(card.dueDate + "T23:59:59") < TODAY;
  }

  function isDueSoon(card) {
    if (!card.dueDate || card.listDone) return false;
    const due = new Date(card.dueDate + "T23:59:59");
    const diffDays = (due - TODAY) / 86400000;
    return diffDays >= 0 && diffDays <= 2;
  }

  async function boardContext(boardId) {
    const [boards, lists, cards, labels, users, staff] = await Promise.all([
      DataStore.getBoards(), DataStore.getLists(), DataStore.getCards(), DataStore.getLabels(),
      DataStore.getUsers(), DataStore.getStaff(),
    ]);
    const board = boards.find((b) => b.id === boardId);
    const boardLists = lists.filter((l) => l.boardId === boardId).sort((a, b) => a.order - b.order);
    const boardCards = cards.filter((c) => c.boardId === boardId);
    return { board, lists: boardLists, cards: boardCards, labels, users, staff };
  }

  /** Vue agrégée tous boards confondus, groupée par statut normalisé (todo/in_progress/blocked/done). */
  async function centralContext(filters = {}) {
    const [boards, cards, labels, departments, users, staff] = await Promise.all([
      DataStore.getBoards(), DataStore.getCards(), DataStore.getLabels(),
      DataStore.getDepartments(), DataStore.getUsers(), DataStore.getStaff(),
    ]);
    let all = cards.filter((c) => c.boardId !== "board-central");
    all = applyFilters(all, filters);
    return { boards, cards: all, labels, departments, users, staff };
  }

  function applyFilters(cards, filters) {
    let result = cards.slice();
    if (filters.priority) result = result.filter((c) => c.priority === filters.priority);
    if (filters.status) result = result.filter((c) => c.status === filters.status);
    if (filters.department) result = result.filter((c) => c.department === filters.department);
    if (filters.assignee) result = result.filter((c) => (c.assignees || []).includes(filters.assignee));
    if (filters.owner) result = result.filter((c) => c.ownerId === filters.owner);
    if (filters.unassigned) result = result.filter((c) => !(c.assignees || []).length && !c.ownerId);
    if (filters.blocked) result = result.filter((c) => c.blocked);
    if (filters.overdue) result = result.filter((c) => isOverdue(c));
    if (filters.dueToday) result = result.filter((c) => c.dueDate === "2026-07-24");
    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter((c) => c.title.toLowerCase().includes(q) || (c.description || "").toLowerCase().includes(q));
    }
    return result;
  }

  async function logActivity(cardId, actor, action, detail) {
    const entry = {
      id: DataStore.nextId("act"),
      cardId, actorId: actor.id, actorLabel: actor.label,
      action, detail, createdAt: new Date().toISOString(),
    };
    await DataStore.insert("cardActivity", entry);
    return entry;
  }

  async function moveCard(cardId, newListId, actor) {
    const lists = await DataStore.getLists();
    const targetList = lists.find((l) => l.id === newListId);
    if (!targetList) return null;
    const status = targetList.isDoneColumn ? "done" : (targetList.name.toLowerCase().includes("attente") || targetList.name.toLowerCase().includes("bloqué") ? "blocked" : (targetList.order === 1 ? "todo" : "in_progress"));
    const card = await DataStore.update("cards", cardId, {
      listId: newListId, status, blocked: status === "blocked", updatedAt: new Date().toISOString(),
    });
    if (card) await logActivity(cardId, actor, "moved", `Déplacée vers « ${targetList.name} ».`);
    return card;
  }

  /** Déplacement depuis la vue centrale (agrégée) : retrouve, dans le board propre de la carte, la colonne correspondant au statut cible. */
  async function moveCardToStatus(cardId, newStatus, actor) {
    const [cards, lists] = await Promise.all([DataStore.getCards(), DataStore.getLists()]);
    const card = cards.find((c) => c.id === cardId);
    if (!card) return null;
    const boardLists = lists.filter((l) => l.boardId === card.boardId).sort((a, b) => a.order - b.order);
    let target;
    if (newStatus === "done") target = boardLists.find((l) => l.isDoneColumn);
    else if (newStatus === "todo") target = boardLists.find((l) => l.order === 1);
    else if (newStatus === "blocked") target = boardLists.find((l) => l.order === 3);
    else target = boardLists.find((l) => l.order === 2);
    if (!target) return null;
    return moveCard(cardId, target.id, actor);
  }

  async function assignCard(cardId, userIds, actor) {
    const card = await DataStore.update("cards", cardId, { assignees: userIds, updatedAt: new Date().toISOString() });
    if (card) await logActivity(cardId, actor, "assigned", `Assignation mise à jour (${userIds.length} personne(s)).`);
    return card;
  }

  async function updateCard(cardId, patch, actor, activityDetail) {
    const card = await DataStore.update("cards", cardId, { ...patch, updatedAt: new Date().toISOString() });
    if (card && activityDetail) await logActivity(cardId, actor, "updated", activityDetail);
    return card;
  }

  async function toggleChecklistItem(cardId, itemId, actor) {
    const cards = await DataStore.getCards();
    const card = cards.find((c) => c.id === cardId);
    if (!card) return null;
    const item = (card.checklist || []).find((i) => i.id === itemId);
    if (!item) return null;
    item.done = !item.done;
    card.updatedAt = new Date().toISOString();
    await logActivity(cardId, actor, "checklist_updated", `Case « ${item.text} » ${item.done ? "cochée" : "décochée"}.`);
    return card;
  }

  async function addComment(cardId, actor, text) {
    const cards = await DataStore.getCards();
    const card = cards.find((c) => c.id === cardId);
    if (!card) return null;
    const comment = { id: DataStore.nextId("cm"), authorId: actor.id, authorLabel: actor.label, text, createdAt: new Date().toISOString() };
    card.comments = card.comments || [];
    card.comments.push(comment);
    await logActivity(cardId, actor, "commented", text.length > 80 ? text.slice(0, 80) + "…" : text);
    return comment;
  }

  async function createCard(data, actor) {
    const lists = await DataStore.getLists();
    const list = lists.find((l) => l.id === data.listId);
    const card = {
      id: DataStore.nextId("card"),
      boardId: data.boardId,
      listId: data.listId,
      status: list && list.order === 1 ? "todo" : "in_progress",
      title: data.title,
      description: data.description || "",
      priority: data.priority || "normale",
      ownerId: data.ownerId || null,
      assignees: data.assignees || [],
      labels: data.labels || [],
      dueDate: data.dueDate || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      department: data.department || null,
      linkedRecordType: data.linkedRecordType || null,
      linkedRecordId: data.linkedRecordId || null,
      blocked: false,
      checklist: [],
      comments: [],
      createdBy: actor.id,
    };
    await DataStore.insert("cards", card);
    await logActivity(card.id, actor, "created", "Carte créée.");
    return card;
  }

  async function activityForCard(cardId) {
    const activity = await DataStore.getCardActivity();
    return activity.filter((a) => a.cardId === cardId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  return {
    TODAY, isOverdue, isDueSoon, boardContext, centralContext, applyFilters,
    moveCard, moveCardToStatus, assignCard, updateCard, toggleChecklistItem, addComment, createCard, activityForCard, logActivity,
  };
})();
