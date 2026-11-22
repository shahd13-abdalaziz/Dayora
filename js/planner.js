// Weekly planner (pages/planner.html). Sessions live on the server, one week is loaded at a time.

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
  const end = App.addDays(weekStart, 6);
  const m = (d) => d.toLocaleDateString('en-US', { month: 'short' });
  const range = m(weekStart) === m(end)
    ? `${m(weekStart)} ${weekStart.getDate()} – ${end.getDate()}`
    : `${m(weekStart)} ${weekStart.getDate()} – ${m(end)} ${end.getDate()}`;
  return `${range}, ${end.getFullYear()}`;
}

// 30-minute choices for the start / end pickers: 8:00 AM ... 7:00 PM
function hourOptions(from, to) {
  const out = [];
  for (let h = from; h <= to; h += 0.5) out.push([h, App.formatHour(h)]);
  return out;
}

// ---------- header: days, label ----------
function renderHeader() {
  document.getElementById('week-label').textContent = weekLabel();
  const today = App.ymd();
  for (let d = 0; d < 7; d++) {
    const date = App.addDays(weekStart, d);
    const isToday = App.ymd(date) === today;
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
    const dateStr = App.ymd(App.addDays(weekStart, d));

    for (const s of sessions) {
      if (s.date !== dateStr) continue;
      if (filter !== 'all' && s.type !== filter) continue;
      if (searchText && !s.title.toLowerCase().includes(searchText)) continue;
      // The grid only draws 8 AM - 7 PM; clip anything outside it.
      const start = Math.max(s.startHour, FIRST_HOUR);
      const end = Math.min(s.endHour, LAST_HOUR);
      if (end <= start) continue;

      const box = App.el('div', {
        class: `session ${s.type}`, title: 'Click to edit',
        style: `top:${(start - FIRST_HOUR) * ROW + 2}px;height:${(end - start) * ROW - 4}px`,
        onclick: () => openSessionForm(s),
      },
        App.el('b', { text: s.title }),
        App.el('span', { text: `${App.formatHour(s.startHour)} – ${App.formatHour(s.endHour)}` }));
      column.append(box);
    }
  }
}

// ---------- the four cards on top ----------
async function loadSummary() {
  const from = App.ymd(weekStart);
  const to = App.ymd(App.addDays(weekStart, 6));
  try {
    const s = await Api.get(`/sessions/summary?from=${from}&to=${to}&today=${App.ymd()}`);
    const hours = Number(s.plannedHours.toFixed(1));
    document.getElementById('stat-hours').textContent = `${hours} ${hours === 1 ? 'hr' : 'hrs'}`;
    document.getElementById('stat-sessions').textContent = s.sessions;
    document.getElementById('stat-tasks').textContent = s.tasksToSchedule;
    document.getElementById('stat-streak').textContent = `${s.streak} day${s.streak === 1 ? '' : 's'}`;
  } catch (err) {
    App.showError(err);
  }
}

async function loadWeek() {
  renderHeader();
  const from = App.ymd(weekStart);
  const to = App.ymd(App.addDays(weekStart, 6));
  try {
    ({ sessions } = await Api.get(`/sessions?from=${from}&to=${to}`));
  } catch (err) {
    sessions = [];
    App.showError(err);
  }
  renderTable();
  loadSummary();
}

// ---------- add / edit / delete ----------
/** session = null -> new one. Otherwise edit that session (with a Delete button). */
function openSessionForm(session = null) {
  const hours = hourOptions(FIRST_HOUR, LAST_HOUR);
  App.form({
    title: session ? 'Edit session' : 'New session',
    submit: session ? 'Save changes' : 'Add session',
    values: session
      ? { title: session.title, type: session.type, date: session.date, startHour: session.startHour, endHour: session.endHour }
      : { type: 'study', date: App.ymd(), startHour: 9, endHour: 10 },
    fields: [
      { name: 'title', label: 'Session name', required: true, max: 120 },
      { name: 'type', label: 'Type', type: 'select', options: TYPES },
      { name: 'date', label: 'Day', type: 'date', required: true },
      { name: 'startHour', label: 'Starts', type: 'select', options: hours.slice(0, -1) },
      { name: 'endHour', label: 'Ends', type: 'select', options: hours.slice(1) },
    ],
    extra: session && {
      label: 'Delete',
      onClick: async () => {
        if (!(await App.confirm(`"${session.title}" will be removed from your week.`))) return false;
        try {
          await Api.del(`/sessions/${session.id}`);
          await loadWeek();
          App.toast('Session deleted');
          return true;
        } catch (err) {
          App.showError(err);
          return false;
        }
      },
    },
    onSubmit: async (v) => {
      const body = { title: v.title, type: v.type, date: v.date, startHour: Number(v.startHour), endHour: Number(v.endHour) };
      if (body.endHour <= body.startHour) {
        const err = new ApiError(400, 'A session must end after it starts', { endHour: 'Pick a time after the start' });
        throw err;
      }
      if (session) await Api.put(`/sessions/${session.id}`, body);
      else await Api.post('/sessions', body);

      // If the session was put on another week, follow it there so it does not "disappear".
      if (body.date < App.ymd(weekStart) || body.date > App.ymd(App.addDays(weekStart, 6))) {
        weekStart = startOfWeek(App.parseYmd(body.date));
      }
      await loadWeek();
      App.toast(session ? 'Session updated' : 'Session added');
    },
  });
}

// ---------- buttons, filters ----------
document.getElementById('prev-week').addEventListener('click', () => { weekStart = App.addDays(weekStart, -7); loadWeek(); });
document.getElementById('next-week').addEventListener('click', () => { weekStart = App.addDays(weekStart, 7); loadWeek(); });
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

loadWeek();
