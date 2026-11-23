// Task board (pages/tasks.html). The tasks live on the server (SQL Server); this file draws them.
//
//   GET    /api/tasks              all my tasks
//   POST   /api/tasks              add one
//   PUT    /api/tasks/{id}         edit one
//   PATCH  /api/tasks/{id}/status  move it to another column
//   DELETE /api/tasks/{id}         delete one

const STATUSES = ['todo', 'progress', 'done'];                  // the order of the columns
const PRIORITIES = [['high', 'High'], ['medium', 'Medium'], ['low', 'Low']];
const COLUMNS = [['todo', 'To Do'], ['progress', 'In Progress'], ['done', 'Done']];

let tasks = [];                // everything we got from the server
let priorityFilter = 'all';
let statusFilter = 'all';
let searchText = '';

// ---------- what is visible right now ----------
function isVisible(task) {
  if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false;
  if (statusFilter !== 'all' && task.status !== statusFilter) return false;
  return task.title.toLowerCase().includes(searchText.toLowerCase());
}

// ---------- one card ----------
function makeCard(task) {
  const late = task.status !== 'done' && task.dueDate && task.dueDate < UI.ymd();
  const user = Store.getUser();

  const actions = UI.el('div', { class: 'card-actions' },
    UI.el('button', {
      class: 'icon-btn', type: 'button', title: 'Edit', 'aria-label': `Edit ${task.title}`, text: '✎',
      onclick: (e) => { e.stopPropagation(); openTaskForm(task); },
    }),
    UI.el('button', {
      class: 'icon-btn', type: 'button', title: 'Delete', 'aria-label': `Delete ${task.title}`, text: '🗑',
      onclick: (e) => { e.stopPropagation(); removeTask(task); },
    }));

  // Same card as before (title, priority, date), now built from the server's data.
  const card = UI.el('div', { class: `card${late ? ' overdue' : ''}`, title: 'Click to move to the next column' },
    UI.el('h4', { class: 'card-title', text: task.title }),
    task.description ? UI.el('p', { class: 'card-desc', text: task.description }) : null,
    UI.el('div', { class: 'card-bottom' },
      UI.el('div', { class: 'card-info' },
        UI.el('span', { class: `pill ${task.priority}`, text: task.priority }),
        UI.el('span', { class: `date${late ? ' late' : ''}` },
          UI.el('img', { src: 'https://api.iconify.design/lucide/calendar.svg?color=%235d6f62', alt: '' }),
          `${Dates.short(task.dueDate)}${late ? ' · overdue' : ''}`)),
      UI.el('div', { class: 'card-right' },
        actions,
        UI.el('div', { class: 'mini-avatar initials', title: user?.name || '', text: Dates.initials(user?.name) }),
        task.status === 'done' ? UI.el('div', { class: 'check', text: '✓' }) : null)));

  // Clicking the card moves it to the next column (To Do -> In Progress -> Done -> To Do).
  card.addEventListener('click', () => moveToNextColumn(task));
  return card;
}

// ---------- the whole board ----------
function render() {
  for (const status of STATUSES) {
    const list = document.getElementById(`list-${status}`);
    list.replaceChildren();
    const mine = tasks.filter((t) => t.status === status && isVisible(t));
    mine.forEach((t) => list.append(makeCard(t)));
    if (!mine.length) list.append(UI.el('div', { class: 'empty', text: 'Nothing here' }));
    document.getElementById(`count-${status}`).textContent = mine.length;
  }
}

// ---------- talking to the server ----------
async function moveToNextColumn(task) {
  const old = task.status;
  const next = STATUSES[(STATUSES.indexOf(old) + 1) % STATUSES.length];
  task.status = next;            // show it at once...
  render();
  try {
    const { task: saved } = await Api.patch(`/tasks/${task.id}/status`, { status: next });
    Object.assign(task, saved);
  } catch (err) {
    task.status = old;           // ...and put it back if the server refused
    UI.toast(err.message, 'error');
  }
  render();
}

async function removeTask(task) {
  if (!(await UI.confirm(`"${task.title}" will be deleted for good.`))) return;
  try {
    await Api.del(`/tasks/${task.id}`);
    tasks = tasks.filter((t) => t.id !== task.id);
    render();
    UI.toast('Task deleted');
  } catch (err) {
    UI.toast(err.message, 'error');
  }
}

/** Add (task = null) or edit a task in one pop-up. The server checks everything again and names the wrong field. */
function openTaskForm(task = null) {
  UI.form({
    title: task ? 'Edit task' : 'New task',
    submit: task ? 'Save changes' : 'Add task',
    values: task
      ? { title: task.title, description: task.description, priority: task.priority, status: task.status, dueDate: task.dueDate || '' }
      : { priority: 'medium', status: 'todo' },
    fields: [
      { name: 'title', label: 'Task name', required: true, max: 200 },
      { name: 'description', label: 'Notes (optional)', type: 'textarea', max: 2000 },
      { name: 'priority', label: 'Priority', type: 'select', options: PRIORITIES },
      { name: 'status', label: 'Column', type: 'select', options: COLUMNS },
      { name: 'dueDate', label: 'Due date (optional)', type: 'date' },
    ],
    onSubmit: async (v) => {
      const body = { ...v, dueDate: v.dueDate || null };
      if (task) {
        const { task: saved } = await Api.put(`/tasks/${task.id}`, body);
        Object.assign(task, saved);
      } else {
        const { task: created } = await Api.post('/tasks', body);
        tasks.push(created);
      }
      render();
      UI.toast(task ? 'Task updated' : 'Task added');
    },
  });
}

// ---------- filters, search, add button ----------
document.getElementById('filter-priority').addEventListener('change', (e) => { priorityFilter = e.target.value; render(); });
document.getElementById('filter-status').addEventListener('change', (e) => { statusFilter = e.target.value; render(); });
document.getElementById('search').addEventListener('input', (e) => { searchText = e.target.value; render(); });
document.getElementById('add-btn').addEventListener('click', () => openTaskForm());

// ---------- start ----------
(async function start() {
  if (!Store.getToken()) return;           // session.js is already sending the visitor to the login page
  try {
    ({ tasks } = await Api.get('/tasks'));
  } catch (err) {
    UI.toast(err.message, 'error');
  }
  render();
})();
