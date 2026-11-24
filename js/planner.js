// Weekly planner (pages/planner.html). The sessions live on the server (SQL Server); one week is loaded at a time.
//
//   GET    /api/sessions?from=..&to=..           the sessions of the week on screen
//   GET    /api/sessions/summary?from=..&to=..   the four cards on top
//   POST   /api/sessions                         add one
//   PUT    /api/sessions/{id}                    edit one
//   DELETE /api/sessions/{id}                    delete one
//   GET    /api/tasks                            your tasks: the ones due this week show in the "Due" row (click one to plan it)

const TYPES = [['study', 'Study'], ['project', 'Project'], ['meeting', 'Meeting'], ['review', 'Review'], ['personal', 'Personal']];
const DEFAULT_FIRST_HOUR = 8;      // the grid normally shows 8 AM ...
const DEFAULT_LAST_HOUR = 19;      // ... to 7 PM, and grows by itself if a session is earlier or later than that
const ROW = 64;                    // pixels per hour (same number as planner.css)

let firstHour = DEFAULT_FIRST_HOUR;
let lastHour = DEFAULT_LAST_HOUR;

let weekStart = startOfWeek(new Date());   // Sunday of the week on screen
let sessions = [];
let tasks = [];            // all your tasks (from the Tasks page); those with a due date this week show in the "Due" row
let filter = 'all';
let searchText = '';

function startOfWeek(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - x.getDay());     // getDay(): 0 = Sunday
  return x;
}

// "Oct 18 – 24, 2026"  or  "Oct 28 – Nov 3, 2026"
function weekLabel() {
  const end = UI.addDays(weekStart, 6);
  const m = (d) => d.toLocaleDateString('en-US', { month: 'short' });
  const range = m(weekStart) === m(end)
    ? `${m(weekStart)} ${weekStart.getDate()} – ${end.getDate()}`
    : `${m(weekStart)} ${weekStart.getDate()} – ${m(end)} ${end.getDate()}`;
  return `${range}, ${end.getFullYear()}`;
}

// 30-minute choices for the start / end pickers: 12:00 AM ... 12:00 AM (the whole day; the server accepts 0 to 24)
function hourOptions(from, to) {
  const out = [];
  for (let h = from; h <= to; h += 0.5) out.push([h, h === 24 ? '12:00 AM (midnight)' : Dates.hour(h)]);
  return out;
}

const weekFrom = () => UI.ymd(weekStart);
const weekTo = () => UI.ymd(UI.addDays(weekStart, 6));

// ---------- header: days, label ----------
function renderHeader() {
  document.getElementById('week-label').textContent = weekLabel();
  const today = UI.ymd();
  for (let d = 0; d < 7; d++) {
    const date = UI.addDays(weekStart, d);
    const isToday = UI.ymd(date) === today;
    const num = document.getElementById(`dn-${d}`);
    num.textContent = date.getDate();
    num.classList.toggle('today-num', isToday);
    document.getElementById(`day-${d}`).classList.toggle('today', isToday);
  }
}

// ---------- the grid ----------
/** "8 AM", "12 PM", "12 AM" ... for the hour column on the left. */
function hourLabel(h) {
  return `${h % 12 === 0 ? 12 : h % 12} ${h >= 12 && h < 24 ? 'PM' : 'AM'}`;
}

/** The grid shows 8 AM - 7 PM, but stretches to include any session that is earlier or later (so nothing is hidden). */
function fitGrid() {
  firstHour = DEFAULT_FIRST_HOUR;
  lastHour = DEFAULT_LAST_HOUR;
  for (const s of sessions) {
    firstHour = Math.min(firstHour, Math.floor(s.startHour));
    lastHour = Math.max(lastHour, Math.ceil(s.endHour));
  }
  document.querySelector('.hours').replaceChildren(
    ...Array.from({ length: lastHour - firstHour }, (_, i) => UI.el('span', { text: hourLabel(firstHour + i) })));
  for (let d = 0; d < 7; d++) document.getElementById(`day-${d}`).style.height = `${(lastHour - firstHour) * ROW}px`;
}

function renderTable() {
  fitGrid();
  for (let d = 0; d < 7; d++) {
    const column = document.getElementById(`day-${d}`);
    column.replaceChildren();
    const dateStr = UI.ymd(UI.addDays(weekStart, d));

    for (const s of sessions) {
      if (s.date !== dateStr) continue;
      if (filter !== 'all' && s.type !== filter) continue;
      if (searchText && !s.title.toLowerCase().includes(searchText)) continue;
      const start = s.startHour;
      const end = s.endHour;

      column.append(UI.el('div', {
        class: `session ${s.type}`, title: 'Click to edit',
        style: { top: `${(start - firstHour) * ROW + 2}px`, height: `${(end - start) * ROW - 4}px` },
        onclick: () => openSessionForm(s),
      },
        UI.el('b', { text: s.title }),
        UI.el('span', { text: `${Dates.hour(s.startHour)} – ${Dates.hour(s.endHour)}` })));
    }
  }
}

// ---------- the "Due" row: tasks with a due date this week ----------
function renderDue() {
  for (let d = 0; d < 7; d++) {
    const cell = document.getElementById(`due-${d}`);
    const dateStr = UI.ymd(UI.addDays(weekStart, d));
    // tasks have no type, so a type filter (Study, Meeting...) hides them
    const due = filter !== 'all' ? [] : tasks.filter((t) =>
      t.dueDate === dateStr && (!searchText || t.title.toLowerCase().includes(searchText)));

    cell.replaceChildren(...due.map((t) => UI.el('button', {
      type: 'button',
      class: `due-task p-${t.priority}${t.status === 'done' ? ' is-done' : ''}`,
      title: t.status === 'done' ? `${t.title} (done)` : `${t.title}: click to plan a session for it`,
      'aria-label': `${t.title}, ${t.status === 'done' ? 'done' : 'due, click to plan a session'}`,
      onclick: () => (t.status === 'done' ? UI.toast('That task is already done') : openSessionForm(null, { title: t.title, date: t.dueDate })),
    }, t.status === 'done' ? '✓ ' : '', t.title)));
  }

  // open tasks without a date cannot be placed on a day: say so, with a way to fix it
  const noDate = tasks.filter((t) => t.status !== 'done' && !t.dueDate).length;
  const note = document.getElementById('due-note');
  note.hidden = noDate === 0;
  note.replaceChildren(`${noDate} open ${noDate === 1 ? 'task has' : 'tasks have'} no due date, so ${noDate === 1 ? 'it is' : 'they are'} not shown here. `,
    UI.el('a', { href: 'tasks.html', text: 'Add a date on the Tasks page' }), '.');
}

// ---------- the four cards on top ----------
async function loadSummary() {
  try {
    const s = await Api.get(`/sessions/summary?from=${weekFrom()}&to=${weekTo()}&today=${UI.ymd()}`);
    const hours = Number(s.plannedHours.toFixed(1));
    document.getElementById('stat-hours').textContent = `${hours} ${hours === 1 ? 'hr' : 'hrs'}`;
    document.getElementById('stat-sessions').textContent = s.sessions;
    document.getElementById('stat-tasks').textContent = s.tasksToSchedule;
    document.getElementById('stat-streak').textContent = `${s.streak} day${s.streak === 1 ? '' : 's'}`;
  } catch (err) {
    UI.toast(err.message, 'error');
  }
}

async function loadWeek() {
  renderHeader();
  try {
    // the sessions of this week, and your tasks (for the "Due" row)
    [{ sessions }, { tasks }] = await Promise.all([Api.get(`/sessions?from=${weekFrom()}&to=${weekTo()}`), Api.get('/tasks')]);
  } catch (err) {
    sessions = [];
    tasks = [];
    UI.toast(err.message, 'error');
  }
  renderTable();
  renderDue();
  loadSummary();
}

// ---------- add / edit / delete ----------
/**
 * session = null -> new one. Otherwise edit that session (with a Delete button).
 * preset: fills the new form (used when you click a task in the "Due" row: its name and due date).
 */
function openSessionForm(session = null, preset = {}) {
  const hours = hourOptions(0, 24);
  UI.form({
    title: session ? 'Edit session' : preset.title ? 'Plan a session for this task' : 'New session',
    submit: session ? 'Save changes' : 'Add session',
    values: session
      ? { title: session.title, type: session.type, date: session.date, startHour: session.startHour, endHour: session.endHour }
      : { type: 'study', date: UI.ymd(), startHour: 9, endHour: 10, ...preset },
    fields: [
      { name: 'title', label: 'Session name', required: true, max: 120 },
      { name: 'type', label: 'Type', type: 'select', options: TYPES },
      { name: 'date', label: 'Day', type: 'date', required: true },
      { name: 'startHour', label: 'Starts', type: 'select', options: hours.slice(0, -1) },
      { name: 'endHour', label: 'Ends', type: 'select', options: hours.slice(1),
        validate: (v, all) => (Number(v) <= Number(all.startHour) ? 'A session must end after it starts' : '') },
    ],
    extra: session && {
      label: 'Delete',
      onClick: async () => {
        if (!(await UI.confirm(`"${session.title}" will be removed from your week.`))) return false;
        try {
          await Api.del(`/sessions/${session.id}`);
          await loadWeek();
          UI.toast('Session deleted');
          return true;
        } catch (err) {
          UI.toast(err.message, 'error');
          return false;
        }
      },
    },
    onSubmit: async (v) => {
      const body = { title: v.title, type: v.type, date: v.date, startHour: Number(v.startHour), endHour: Number(v.endHour) };
      // the server refuses two sessions on top of each other and tells us which field is wrong
      if (session) await Api.put(`/sessions/${session.id}`, body);
      else await Api.post('/sessions', body);

      // if the session was put on another week, follow it there so it does not "disappear"
      if (body.date < weekFrom() || body.date > weekTo()) weekStart = startOfWeek(Dates.parse(body.date));
      await loadWeek();
      UI.toast(session ? 'Session updated' : 'Session added');
    },
  });
}

// ---------- buttons, filters ----------
document.getElementById('prev-week').addEventListener('click', () => { weekStart = UI.addDays(weekStart, -7); loadWeek(); });
document.getElementById('next-week').addEventListener('click', () => { weekStart = UI.addDays(weekStart, 7); loadWeek(); });
document.getElementById('today-btn').addEventListener('click', () => { weekStart = startOfWeek(new Date()); loadWeek(); });
document.getElementById('add-btn').addEventListener('click', () => openSessionForm());
document.getElementById('search').addEventListener('input', (e) => { searchText = e.target.value.trim().toLowerCase(); renderTable(); renderDue(); });

const chips = document.querySelectorAll('.chip');
chips.forEach((chip) => {
  chip.addEventListener('click', () => {
    filter = chip.dataset.type;
    chips.forEach((c) => c.classList.remove('chip-active'));
    chip.classList.add('chip-active');
    renderTable();
    renderDue();
  });
});

if (Store.getToken()) loadWeek();      // session.js is already sending a visitor to the login page
