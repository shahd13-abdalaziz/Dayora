// Task board (pages/tasks.html). The tasks live on the server; this file draws them.

const STATUSES = ['todo', 'progress', 'done'];          // column order
const PRIORITIES = [['high', 'High'], ['medium', 'Medium'], ['low', 'Low']];

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
  const late = task.status !== 'done' && task.dueDate && task.dueDate < App.ymd();

  const actions = App.el('div', { class: 'card-actions' },
    App.el('button', {
      class: 'icon-btn', title: 'Edit', 'aria-label': `Edit ${task.title}`, text: '✎',
      onclick: (e) => { e.stopPropagation(); openTaskForm(task); },
    }),
    App.el('button', {
      class: 'icon-btn', title: 'Delete', 'aria-label': `Delete ${task.title}`, text: '🗑',
      onclick: (e) => { e.stopPropagation(); removeTask(task); },
    }));

  const card = App.el('div', { class: `card${late ? ' overdue' : ''}`, title: 'Click to move to the next column' },
    App.el('h4', { class: 'card-title', text: task.title }),
    task.description ? App.el('p', { class: 'card-desc', text: task.description }) : null,
    App.el('div', { class: 'card-bottom' },
      App.el('div', { class: 'card-info' },
        App.el('span', { class: `pill ${task.priority}`, text: task.priority }),
        App.el('span', { class: `date${late ? ' late' : ''}`, text: `${App.shortDate(task.dueDate)}${late ? ' · overdue' : ''}` })),
      App.el('div', { class: 'card-right' },
        actions,
        task.status === 'done' ? App.el('div', { class: 'check', text: '✓' }) : null)));

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
    if (!mine.length) list.append(App.el('div', { class: 'empty', text: 'Nothing here' }));
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
    App.showError(err);
  }
  render();
}

async function removeTask(task) {
  if (!(await App.confirm(`"${task.title}" will be deleted for good.`))) return;
  try {
    await Api.del(`/tasks/${task.id}`);
    tasks = tasks.filter((t) => t.id !== task.id);
    render();
    App.toast('Task deleted');
  } catch (err) {
    App.showError(err);
  }
}

/** Add (task = null) or edit a task in one pop-up. */
function openTaskForm(task = null) {
  App.form({
    title: task ? 'Edit task' : 'New task',
    submit: task ? 'Save changes' : 'Add task',
    values: task
      ? { title: task.title, description: task.description, priority: task.priority, status: task.status, dueDate: task.dueDate || '' }
      : { priority: 'medium', status: 'todo' },
    fields: [
      { name: 'title', label: 'Task name', required: true, max: 200 },
      { name: 'description', label: 'Notes (optional)', type: 'textarea', max: 2000 },
      { name: 'priority', label: 'Priority', type: 'select', options: PRIORITIES },
      { name: 'status', label: 'Column', type: 'select', options: [['todo', 'To Do'], ['progress', 'In Progress'], ['done', 'Done']] },
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
      App.toast(task ? 'Task updated' : 'Task added');
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
  try {
    ({ tasks } = await Api.get('/tasks'));
  } catch (err) {
    App.showError(err);
  }
  render();
})();
