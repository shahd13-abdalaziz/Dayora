// Dashboard (pages/dashboard.html): your day at a glance, with a bit of humour.
//
//   GET /api/dashboard?today=2026-11-24   everything on this page in one request:
//     { user, counts: {open, dueToday, overdue, done}, focus: {todayMinutes, dailyGoalMinutes, streak},
//       upcomingTasks: [...], todaySessions: [...] }
//
// Every text from the server goes in with textContent (through UI.el), so a task called "<b>x</b>" stays plain text.

const $ = (id) => document.getElementById(id);
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// ---------- the jokes ----------
const EXCUSES = [
  'My to-do list and I are on a break.',
  'I would, but my chair is too comfortable.',
  'It is not procrastinating, it is "letting the idea marinate".',
  'Mercury is in retrograde. Probably.',
  'I work best under pressure, so I am building the pressure first.',
  'I was going to start, but then I reorganised my desktop icons.',
  'My brain has too many tabs open.',
  'I am waiting for the perfect moment. It has not RSVP-ed yet.',
  'The deadline is a social construct.',
  'I need one more coffee to be able to need another coffee.',
  'I am saving my energy for something really important. Like lunch.',
  'Starting now would be rude to tomorrow-me, who is so looking forward to it.',
];

const SPROUT = {
  seed:  { plant: '🌱', lines: ['I am thirsty. One focus session is one sip of water.', 'Psst. I grow when you focus. No pressure.', 'Is it me, or is it dry in here? Hint: Focus Room.'] },
  leaf:  { plant: '🌿', lines: ['Look, I have leaves! Keep going!', 'Growing nicely. Do not stop now.', 'I feel a new leaf coming. Maybe two.'] },
  pot:   { plant: '🪴', lines: ['Over halfway to your goal. I am proud of us.', 'Look at me, a fancy pot and everything.', 'A little more and I become a tree. Just saying.'] },
  tree:  { plant: '🌳', lines: ['Goal reached. I am a TREE now. Thanks, boss!', 'You did it! I am putting a tiny hat on, in my heart.', 'Today is officially a win. Go rest, you earned it.'] },
};

function hello(name) {
  const h = new Date().getHours();
  if (h < 5) return `Burning the midnight oil, ${name}? 🦉`;
  if (h < 12) return `Good morning, ${name} ☀️`;
  if (h < 17) return `Good afternoon, ${name} 🌤️`;
  if (h < 22) return `Good evening, ${name} 🌙`;
  return `Still up, ${name}? 🦉`;
}

function joke({ open, dueToday, overdue, done }) {
  if (overdue > 0) {
    return pick([
      `${plural(overdue, 'task is', 'tasks are')} overdue and giving you the silent treatment. 😶`,
      `${plural(overdue, 'task is', 'tasks are')} overdue. Not angry, just disappointed.`,
    ]);
  }
  if (dueToday > 0) {
    return pick([
      `${plural(dueToday, 'task is', 'tasks are')} due today. They will not do themselves, sadly.`,
      `${plural(dueToday, 'thing is', 'things are')} due today. You have got this. Probably.`,
    ]);
  }
  if (open > 0) return 'Nothing is due today. Suspiciously calm. Enjoy it while it lasts.';
  if (done > 0) return 'Everything is done. Go drink some water, hero. 💧';
  return 'Zero tasks. Either you are a genius, or you have not added any yet.';
}

// ---------- the plant ----------
let stage = SPROUT.seed;

function plantStage(todayMinutes, goal) {
  if (todayMinutes <= 0) return SPROUT.seed;
  const pct = todayMinutes / goal;
  if (pct >= 1) return SPROUT.tree;
  return pct >= 0.5 ? SPROUT.pot : SPROUT.leaf;
}

function sproutSays() {
  $('buddy-say').textContent = pick(stage.lines);
  const plant = $('buddy-plant');
  plant.classList.remove('bounce');
  void plant.offsetWidth;                         // restart the animation
  plant.classList.add('bounce');
}

$('buddy').addEventListener('click', sproutSays);

// ---------- lists ----------
function dueLabel(task, today) {
  if (!task.dueDate) return { text: 'No date', late: false };
  if (task.dueDate === today) return { text: 'Today', late: false };
  if (task.dueDate < today) return { text: `Overdue · ${Dates.short(task.dueDate)}`, late: true };
  return { text: Dates.short(task.dueDate), late: false };
}

function empty(icon, text) {
  return UI.el('li', { class: 'dh-empty' }, UI.el('i', { class: icon }), UI.el('span', { text }));
}

function renderNext(tasks) {
  const today = UI.ymd();
  $('next-list').replaceChildren(...(tasks.length
    ? tasks.map((t) => {
        const due = dueLabel(t, today);
        return UI.el('li', {},
          UI.el('a', { class: 'dh-row', href: 'tasks.html' },
            UI.el('span', { class: `dh-dot ${t.priority}`, title: `${t.priority} priority` }),
            UI.el('span', { class: 'dh-row_text' },
              UI.el('strong', { text: t.title }),
              UI.el('small', { class: due.late ? 'late' : '', text: due.text })),
            UI.el('span', { class: `dh-pill ${t.priority}`, text: t.priority })));
      })
    : [empty('fa-solid fa-seedling', 'Nothing waiting for you. Go touch grass, or add a task.')]));
}

function renderPlan(sessions) {
  $('plan-list').replaceChildren(...(sessions.length
    ? sessions.map((s) => UI.el('li', {},
        UI.el('a', { class: 'dh-row', href: 'planner.html' },
          UI.el('span', { class: 'dh-time', text: Dates.hour(s.startHour) }),
          UI.el('span', { class: 'dh-row_text' },
            UI.el('strong', { text: s.title }),
            UI.el('small', { text: `until ${Dates.hour(s.endHour)} · ${s.type}` })))))
    : [empty('fa-regular fa-calendar', 'No sessions today. A free day? Bold move.')]));
}

// ---------- the numbers ----------
function renderStats({ counts, focus }) {
  $('s-open').textContent = counts.open;
  $('s-open-note').textContent = counts.done ? `${counts.done} done so far` : 'a fresh start';

  $('s-today').textContent = counts.dueToday;
  $('s-today-note').textContent = counts.overdue ? `${counts.overdue} overdue 😬` : counts.dueToday ? 'go go go' : 'breathe';

  $('s-focus').textContent = `${focus.todayMinutes} min`;
  $('s-focus-note').textContent = `of ${focus.dailyGoalMinutes} min goal`;

  $('s-streak').textContent = focus.streak;
  $('s-streak-note').textContent = focus.streak === 0 ? 'start one today' : focus.streak === 1 ? 'day, keep it up' : 'days in a row 🔥';
}

// ---------- the excuse ----------
let excuse = Math.floor(Date.now() / 86400000) % EXCUSES.length;       // one per day to start with

function showExcuse() {
  $('excuse-text').textContent = `"${EXCUSES[excuse]}"`;
}

$('excuse-btn').addEventListener('click', () => {
  let next;
  do { next = Math.floor(Math.random() * EXCUSES.length); } while (next === excuse);
  excuse = next;
  showExcuse();
});

// ---------- start ----------
async function start() {
  if (!Store.getToken()) return;                    // session.js is already sending the visitor to the login page

  const first = ((Store.getUser() || {}).name || 'friend').trim().split(/\s+/)[0];
  $('dh-date').textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  $('dh-hello').textContent = hello(first);
  showExcuse();

  try {
    const data = await Api.get(`/dashboard?today=${UI.ymd()}`);
    $('dh-hello').textContent = hello(data.user.name.trim().split(/\s+/)[0]);
    $('dh-joke').textContent = joke(data.counts);
    renderStats(data);
    renderNext(data.upcomingTasks);
    renderPlan(data.todaySessions);

    stage = plantStage(data.focus.todayMinutes, data.focus.dailyGoalMinutes);
    $('buddy-plant').textContent = stage.plant;
    $('buddy-say').textContent = pick(stage.lines);
  } catch (err) {
    $('dh-joke').textContent = 'I could not reach the server, so I have no jokes. That is the real joke.';
    const box = $('dh-error');
    box.textContent = err.message;
    box.hidden = false;
    renderNext([]);
    renderPlan([]);
  }
}

start();
