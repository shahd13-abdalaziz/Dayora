// Habits page (pages/habits.html).
// Everything is saved in this browser (localStorage), so your habits are still there tomorrow.
//
// A habit looks like:  { id: 3, name: "Drink water", color: "#608359", done: { "2026-11-23": true, ... } }

const STORAGE_KEY = 'dayora_habits';
const COLORS = ['#608359', '#3f8f86', '#c9a24a', '#c8765a', '#7a6bb3'];   // each new habit gets the next colour
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

let habits = load();

// ---------- saving / loading ----------
function load() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(habits));
}

// ---------- the maths ----------
/** Days in a row, counting back from today. If today is not ticked yet, yesterday still keeps the streak alive. */
function streakOf(habit) {
  let day = new Date();
  if (!habit.done[UI.ymd(day)]) day = UI.addDays(day, -1);
  let count = 0;
  while (habit.done[UI.ymd(day)]) {
    count += 1;
    day = UI.addDays(day, -1);
  }
  return count;
}

/** The seven days of this week, Sunday first. */
function thisWeek() {
  const today = new Date();
  const sunday = UI.addDays(today, -today.getDay());
  return Array.from({ length: 7 }, (_, i) => UI.addDays(sunday, i));
}

// ---------- the top numbers ----------
function renderStats() {
  const today = UI.ymd();
  const doneToday = habits.filter((h) => h.done[today]).length;
  document.getElementById('s-total').textContent = habits.length;
  document.getElementById('s-today').textContent = habits.length ? `${doneToday} / ${habits.length}` : '0';
  document.getElementById('s-today-note').textContent =
    habits.length && doneToday === habits.length ? 'all done, great!' : 'habits ticked today';
  document.getElementById('s-streak').textContent = Math.max(0, ...habits.map(streakOf));

  // this week: of all the days that already happened, how many were ticked?
  const past = thisWeek().filter((d) => UI.ymd(d) <= today);
  const possible = habits.length * past.length;
  const ticked = habits.reduce((sum, h) => sum + past.filter((d) => h.done[UI.ymd(d)]).length, 0);
  document.getElementById('s-week').textContent = possible ? `${Math.round((100 * ticked) / possible)}%` : '0%';
}

// ---------- one habit card ----------
function habitCard(habit) {
  const today = UI.ymd();
  const streak = streakOf(habit);

  const days = thisWeek().map((d) => {
    const key = UI.ymd(d);
    const isFuture = key > today;
    const isDone = !!habit.done[key];
    return UI.el('button', {
      type: 'button',
      class: `day-dot${isDone ? ' done' : ''}${key === today ? ' today' : ''}`,
      disabled: isFuture,
      'aria-pressed': isDone,
      'aria-label': `${habit.name}, ${DAY_NAMES[d.getDay()]} ${d.getDate()}: ${isDone ? 'done' : 'not done'}`,
      title: isFuture ? 'This day has not come yet' : `${DAY_NAMES[d.getDay()]} ${d.getDate()}`,
      onclick: () => toggle(habit, key),
    }, UI.el('small', { text: DAY_NAMES[d.getDay()] }), UI.el('span', { text: isDone ? '✓' : d.getDate() }));
  });

  return UI.el('div', { class: 'habit', style: { '--c': habit.color } },
    UI.el('div', { class: 'habit-top' },
      UI.el('div', { class: 'habit-title' },
        UI.el('span', { class: 'habit-color' }),
        UI.el('h3', { text: habit.name })),
      UI.el('div', { class: 'habit-actions' },
        UI.el('span', { class: `streak${streak ? ' on' : ''}`, text: streak ? `🔥 ${streak} day${streak === 1 ? '' : 's'}` : 'No streak yet' }),
        UI.el('button', { class: 'icon-btn', type: 'button', title: 'Rename', 'aria-label': `Rename ${habit.name}`, text: '✎', onclick: () => openForm(habit) }),
        UI.el('button', { class: 'icon-btn', type: 'button', title: 'Delete', 'aria-label': `Delete ${habit.name}`, text: '🗑', onclick: () => remove(habit) }))),
    UI.el('div', { class: 'week-dots' }, days));
}

// ---------- the list ----------
function render() {
  const list = document.getElementById('habit-list');
  list.replaceChildren();

  if (!habits.length) {
    list.append(UI.el('div', { class: 'empty-state' },
      UI.el('i', { class: 'fa-solid fa-seedling', 'aria-hidden': 'true' }),
      UI.el('h2', { text: 'No habits yet' }),
      UI.el('p', { text: 'Start small: one habit you want to do every day, like drinking water or reading.' }),
      UI.el('button', { class: 'btn-primary', type: 'button', text: '+ Add your first habit', onclick: () => openForm() })));
  } else {
    habits.forEach((h) => list.append(habitCard(h)));
  }
  renderStats();
}

// ---------- actions ----------
function toggle(habit, dateKey) {
  if (dateKey > UI.ymd()) return;                       // you cannot tick a day that has not come yet
  if (habit.done[dateKey]) delete habit.done[dateKey];
  else habit.done[dateKey] = true;
  save();
  render();
}

async function remove(habit) {
  if (!(await UI.confirm(`"${habit.name}" and all its history will be deleted.`))) return;
  habits = habits.filter((h) => h.id !== habit.id);
  save();
  render();
  UI.toast('Habit deleted');
}

/** habit = null: add a new one. Otherwise rename that habit. */
function openForm(habit = null) {
  UI.form({
    title: habit ? 'Rename habit' : 'New habit',
    submit: habit ? 'Save' : 'Add habit',
    values: habit ? { name: habit.name } : {},
    fields: [{
      name: 'name', label: 'Habit name (for example: Drink water)', required: true, min: 2, max: 40,
      // two habits with the same name would be confusing
      validate: (v) => (habits.some((h) => h.id !== habit?.id && h.name.toLowerCase() === v.toLowerCase())
        ? 'You already have a habit with this name' : ''),
    }],
    onSubmit: ({ name }) => {
      if (habit) {
        habit.name = name;
      } else {
        const id = habits.reduce((max, h) => Math.max(max, h.id), 0) + 1;
        habits.push({ id, name, color: COLORS[habits.length % COLORS.length], done: {} });
      }
      save();
      render();
      UI.toast(habit ? 'Habit renamed' : 'Habit added');
    },
  });
}

document.getElementById('add-habit').addEventListener('click', () => openForm());
render();
