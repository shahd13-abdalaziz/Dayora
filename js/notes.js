// Notes page (pages/notes.html).
// Everything is saved in this browser (localStorage), so your notes are still there tomorrow.
//
// A note looks like:  { id: 3, title: "Ideas", body: "...", color: "yellow", updated: 1795382000000 }

const STORAGE_KEY = 'dayora_notes';

// [value, name, colour shown in the colour picker]
const COLORS = [
  ['green', 'Green', '#cfe3cf'],
  ['yellow', 'Yellow', '#f2e7d2'],
  ['blue', 'Blue', '#d3e8e3'],
  ['rose', 'Rose', '#f4e0d6'],
  ['gray', 'Gray', '#e4e7e2'],
];

let notes = load();
let searchText = '';

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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

// ---------- one note card ----------
function noteCard(note) {
  const when = new Date(note.updated).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return UI.el('button', {
    type: 'button', class: `note-card c-${note.color}`, title: 'Click to edit',
    onclick: () => openForm(note),
  },
    UI.el('h3', { text: note.title || 'Untitled' }),
    note.body ? UI.el('p', { text: note.body }) : null,
    UI.el('small', { text: when }));
}

// ---------- the grid ----------
function render() {
  const grid = document.getElementById('notes-grid');
  grid.replaceChildren();

  const q = searchText.toLowerCase();
  const shown = notes
    .filter((n) => !q || n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q))
    .sort((a, b) => b.updated - a.updated);               // newest first

  if (!notes.length) {
    grid.append(UI.el('div', { class: 'empty-state' },
      UI.el('i', { class: 'fa-regular fa-note-sticky', 'aria-hidden': 'true' }),
      UI.el('h2', { text: 'No notes yet' }),
      UI.el('p', { text: 'Write down an idea, a list, or anything you do not want to forget.' }),
      UI.el('button', { class: 'btn-primary', type: 'button', text: '+ Write your first note', onclick: () => openForm() })));
  } else if (!shown.length) {
    grid.append(UI.el('div', { class: 'empty-state' }, UI.el('h2', { text: 'Nothing found' }), UI.el('p', { text: `No note contains "${searchText}".` })));
  } else {
    shown.forEach((n) => grid.append(noteCard(n)));
  }
}

// ---------- actions ----------
async function remove(note) {
  if (!(await UI.confirm(`"${note.title || 'Untitled'}" will be deleted for good.`))) return false;
  notes = notes.filter((n) => n.id !== note.id);
  save();
  render();
  UI.toast('Note deleted');
  return true;
}

/** note = null: write a new note. Otherwise edit that note (with a Delete button). */
function openForm(note = null) {
  UI.form({
    title: note ? 'Edit note' : 'New note',
    submit: note ? 'Save changes' : 'Add note',
    values: note ? { title: note.title, body: note.body, color: note.color } : { color: 'green' },
    fields: [
      { name: 'title', label: 'Title', max: 60 },
      { name: 'body', label: 'Your note', type: 'textarea', max: 2000 },
      { name: 'color', label: 'Colour', type: 'colors', options: COLORS },
    ],
    extra: note && { label: 'Delete', onClick: () => remove(note) },
    onSubmit: (v) => {
      // an empty note is not worth saving
      if (!v.title && !v.body) throw new Error('Write a title or some text first');
      if (note) {
        Object.assign(note, v, { updated: Date.now() });
      } else {
        const id = notes.reduce((max, n) => Math.max(max, n.id), 0) + 1;
        notes.push({ id, ...v, updated: Date.now() });
      }
      save();
      render();
      UI.toast(note ? 'Note saved' : 'Note added');
    },
  });
}

document.getElementById('add-note').addEventListener('click', () => openForm());
document.getElementById('search').addEventListener('input', (e) => { searchText = e.target.value.trim(); render(); });
render();
