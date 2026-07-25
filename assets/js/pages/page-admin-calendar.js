/**
 * Calendrier global (admin) : grille mensuelle visuelle agrégeant les
 * échéances de cartes Kanban et de tickets, tous pôles confondus.
 */
(function () {
  const DEMO_TODAY = new Date("2026-07-25T09:00:00");
  const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
  const MONTH_NAMES = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

  let events = []; // { date: "yyyy-mm-dd", type, title, sub, priority, overdue }
  let boards, cards, tickets;
  let currentMonth = new Date(DEMO_TODAY.getFullYear(), DEMO_TODAY.getMonth(), 1);
  let selectedDate = toKey(DEMO_TODAY);

  function toKey(d) { return d.toISOString().slice(0, 10); }
  function isPast(dateKey) { return dateKey < toKey(DEMO_TODAY); }

  function buildEvents() {
    events = [];
    cards.filter((c) => c.dueDate && c.boardId !== "board-central").forEach((c) => {
      const board = boards.find((b) => b.id === c.boardId);
      events.push({
        date: c.dueDate, type: "card", title: c.title,
        sub: board ? board.name : c.boardId, priority: c.priority,
        overdue: KanbanEngine.isOverdue(c),
      });
    });
    tickets.filter((t) => t.dueAt && !["resolu", "ferme"].includes(t.status)).forEach((t) => {
      const dateKey = t.dueAt.slice(0, 10);
      events.push({
        date: dateKey, type: "ticket", title: `${t.id} — ${t.requesterName}`,
        sub: t.targetService, priority: t.priority,
        overdue: isPast(dateKey),
      });
    });
  }

  function eventLine(e) {
    return `<div class="dc-checklist-item">
      <i class="bi ${e.type === "card" ? "bi-kanban" : "bi-ticket-perforated"} ${e.overdue ? "text-danger" : "text-primary"}"></i>
      <span class="ms-2 small">${DCUtils.escapeHtml(e.title)} <span class="text-muted-dc">— ${DCUtils.escapeHtml(e.sub)}</span></span>
      ${DCUtils.priorityBadge(e.priority)}
    </div>`;
  }

  function renderOverdue() {
    const overdue = events.filter((e) => e.overdue).sort((a, b) => a.date.localeCompare(b.date));
    document.getElementById("overdue-list").innerHTML = overdue.length
      ? overdue.map(eventLine).join("")
      : `<div class="dc-empty-state py-3"><p class="small mb-0">Aucune échéance en retard.</p></div>`;
  }

  function renderDayPanel() {
    const title = document.getElementById("day-panel-title");
    const panel = document.getElementById("day-panel");
    if (!selectedDate) { title.innerHTML = `<i class="bi bi-calendar-event me-2 text-primary"></i>Sélectionnez un jour`; panel.innerHTML = ""; return; }
    const dayEvents = events.filter((e) => e.date === selectedDate);
    const d = new Date(selectedDate + "T12:00:00");
    title.innerHTML = `<i class="bi bi-calendar-event me-2 text-primary"></i>${d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}`;
    panel.innerHTML = dayEvents.length
      ? dayEvents.map(eventLine).join("")
      : `<div class="dc-empty-state py-3"><p class="small mb-0">Aucune échéance ce jour-là.</p></div>`;
  }

  function renderGrid() {
    document.getElementById("month-label").innerHTML = `<i class="bi bi-calendar3 me-2 text-primary"></i>${MONTH_NAMES[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`;

    const firstOfMonth = new Date(currentMonth);
    const startOffset = (firstOfMonth.getDay() + 6) % 7; // lundi = 0
    const gridStart = new Date(firstOfMonth);
    gridStart.setDate(firstOfMonth.getDate() - startOffset);

    const cells = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      cells.push(d);
    }

    const weekdayHtml = WEEKDAYS.map((w) => `<div class="dc-calendar-weekday">${w}</div>`).join("");
    const dayHtml = cells.map((d) => {
      const key = toKey(d);
      const outside = d.getMonth() !== currentMonth.getMonth();
      const isToday = key === toKey(DEMO_TODAY);
      const isSelected = key === selectedDate;
      const dayEvents = events.filter((e) => e.date === key);
      const dots = dayEvents.slice(0, 4).map((e) => `<span class="dc-calendar-dot ${e.overdue ? "dot-overdue" : isToday ? "dot-today" : "dot-upcoming"}"></span>`).join("");
      const label = d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
      return outside
        ? `<div class="dc-calendar-day is-outside" aria-hidden="true"><span class="dc-calendar-day-num">${d.getDate()}</span></div>`
        : `<div class="dc-calendar-day ${isToday ? "is-today" : ""} ${isSelected ? "is-selected" : ""}" data-date="${key}" role="button" tabindex="0" aria-pressed="${isSelected}" aria-label="${label}${dayEvents.length ? `, ${dayEvents.length} échéance(s)` : ""}">
        <span class="dc-calendar-day-num">${d.getDate()}</span>
        <span class="dc-calendar-day-dots">${dots}</span>
      </div>`;
    }).join("");

    document.getElementById("calendar-grid").innerHTML = weekdayHtml + dayHtml;
    document.getElementById("calendar-grid").querySelectorAll(".dc-calendar-day:not(.is-outside)").forEach((el) => {
      const select = () => { selectedDate = el.dataset.date; renderGrid(); renderDayPanel(); };
      el.addEventListener("click", select);
      el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(); } });
    });
  }

  async function init() {
    const admin = await Auth.guard(["admin"]);
    if (!admin) return;
    await Layout.mountApp("admin", "calendar", admin);

    [cards, boards, tickets] = await Promise.all([DataStore.getCards(), DataStore.getBoards(), DataStore.getTickets()]);
    buildEvents();
    renderGrid();
    renderOverdue();
    renderDayPanel();

    document.getElementById("prev-month-btn").addEventListener("click", () => {
      currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
      renderGrid();
    });
    document.getElementById("next-month-btn").addEventListener("click", () => {
      currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
      renderGrid();
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
