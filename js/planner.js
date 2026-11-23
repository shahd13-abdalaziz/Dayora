// Weekly planner (pages/planner.html). The sessions live on the server (SQL Server); one week is loaded at a time.
//
//   GET    /api/sessions?from=..&to=..           the sessions of the week on screen
//   GET    /api/sessions/summary?from=..&to=..   the four cards on top
//   POST   /api/sessions                         add one
//   PUT    /api/sessions/{id}                    edit one
//   DELETE /api/sessions/{id}                    delete one

const TYPES = [['study', 'Study'], ['project', 'Project'], ['meeting', 'Meeting'], ['review', 'Review'], ['personal', 'Personal']];
const FIRST_HOUR = 8;      // the grid shows 8 AM ...
const LAST_HOUR = 19;      // ... to 7 PM
const ROW = 64;            // pixels per hour (same number as planner.css)

let weekStart = startOfWeek(new Date());   // Sunday of the week on screen
let sessions = [];
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

// 30-minute choices for the start / end pickers: 8:00 AM ... 7:00 PM
function hourOptions(from, to) {
  const out = [];
  for (let h = from; h <= to; h += 0.5) out.push([h, Dates.hour(h)]);
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
function renderTable() {
  for (let d = 0; d < 7; d++) {
    const column = document.getElementById(`day-${d}`);
    column.replaceChildren();
    const dateStr = UI.ymd(UI.addDays(weekStart, d));

    for (const s of sessions) {
      if (s.date !== dateStr) continue;
      if (filter !== 'all' && s.type !== filter) continue;
      if (searchText && !s.title.toLowerCase().includes(searchText)) continue;
      // The grid only draws 8 AM - 7 PM; clip anything outside it.
      const start = Math.max(s.startHour, FIRST_HOUR);
      const end = Math.min(s.endHour, LAST_HOUR);
      if (end <= start) continue;

      column.append(UI.el('div', {
        class: `session ${s.type}`, title: 'Click to edit',
        style: { top: `${(start - FIRST_HOUR) * ROW + 2}px`, height: `${(end - start) * ROW - 4}px` },
        onclick: () => openSessionForm(s),
      },
        UI.el('b', { text: s.title }),
        UI.el('span', { text: `${Dates.hour(s.startHour)} – ${Dates.hour(s.endHour)}` })));
    }
  }
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
    ({ sessions } = await Api.get(`/sessions?from=${weekFrom()}&to=${weekTo()}`));
  } catch (err) {
    sessions = [];
    UI.toast(err.message, 'error');
  }
  renderTable();
  loadSummary();
}

// ---------- add / edit / delete ----------
/** session = null -> new one. Otherwise edit that session (with a Delete button). */
function openSessionForm(session = null) {
  const hours = hourOptions(FIRST_HOUR, LAST_HOUR);
  UI.form({
    title: session ? 'Edit session' : 'New session',
    submit: session ? 'Save changes' : 'Add session',
    values: session
      ? { title: session.title, type: session.type, date: session.date, startHour: session.startHour, endHour: session.endHour }
      : { type: 'study', date: UI.ymd(), startHour: 9, endHour: 10 },
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
document.getElementById('search').addEventListener('input', (e) => { searchText = e.target.value.trim().toLowerCase(); renderTable(); });

const chips = document.querySelectorAll('.chip');
chips.forEach((chip) => {
  chip.addEventListener('click', () => {
    filter = chip.dataset.type;
    chips.forEach((c) => c.classList.remove('chip-active'));
    chip.classList.add('chip-active');
    renderTable();
  });
});

if (Store.getToken()) loadWeek();      // session.js is already sending a visitor to the login page
