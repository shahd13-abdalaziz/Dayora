// Shared by every page of the app (dashboard, tasks, planner, focus, analytics, settings).
// Needs utils/storage.js and utils/api.js loaded first.
//
//   <body data-protected>  -> the page needs a login; visitors are sent to the login page.

const App = {
  // ---------- small helpers ----------
  pad: (n) => String(n).padStart(2, '0'),

  /** Date -> "2026-10-19" in the browser's own timezone (the server never has to guess). */
  ymd(d = new Date()) {
    return `${d.getFullYear()}-${this.pad(d.getMonth() + 1)}-${this.pad(d.getDate())}`;
  },

  /** "2026-10-19" -> Date at local midnight. */
  parseYmd(s) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  },

  addDays(d, n) {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  },

  /** "2026-04-20" -> "Apr 20" */
  shortDate(s) {
    return s ? this.parseYmd(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'No date';
  },

  /** 13 -> "1:00 PM", 9.5 -> "9:30 AM" */
  formatHour(h) {
    const hour = Math.floor(h);
    const minutes = Math.round((h - hour) * 60);
    const suffix = hour >= 12 && hour < 24 ? 'PM' : 'AM';
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
    return `${hour12}:${this.pad(minutes)} ${suffix}`;
  },

  /** 95 -> "1h 35m" */
  formatMinutes(m) {
    const h = Math.floor(m / 60);
    const r = m % 60;
    if (h && r) return `${h}h ${r}m`;
    return h ? `${h}h` : `${r}m`;
  },

  initials(name = '') {
    return (
      name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?'
    );
  },

  /** Build an element: App.el('div', { class: 'card' }, 'text', childElement) */
  el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v === true ? '' : v);
    }
    // Strings go in as text, never as HTML, so a task called "<img onerror=...>" is harmless.
    for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) node.append(c);
    return node;
  },

  // ---------- login state ----------
  requireLogin() {
    if (!Store.getToken()) {
      location.replace(Api.loginUrl);
      return false;
    }
    return true;
  },

  logout() {
    Store.clear();
    location.href = Api.loginUrl;
  },

  /** Puts the user's name and initials wherever the page has a place for them. */
  showUser() {
    const user = Store.getUser();
    if (!user) return;
    document.querySelectorAll('.user-name, #profileName').forEach((e) => (e.textContent = user.name));
    document.querySelectorAll('#profileEmail').forEach((e) => (e.textContent = user.email));
    document.querySelectorAll('.avatar').forEach((e) => (e.textContent = this.initials(user.name)));
  },

  // ---------- messages ----------
  toast(message, type = 'ok') {
    let box = document.getElementById('toasts');
    if (!box) {
      box = this.el('div', { id: 'toasts', 'aria-live': 'polite' });
      document.body.append(box);
    }
    const t = this.el('div', { class: `toast ${type}`, text: message });
    box.append(t);
    setTimeout(() => t.remove(), 3500);
  },

  /** Shows what went wrong: a toast, plus the message under the right field when there is one. */
  showError(err, form) {
    const fields = err.fields || {};
    if (form) {
      form.querySelectorAll('.field-error').forEach((e) => (e.textContent = ''));
      for (const [name, msg] of Object.entries(fields)) {
        const slot = form.querySelector(`[data-error-for="${name}"]`);
        if (slot) slot.textContent = msg;
      }
    }
    this.toast(err.message || 'Something went wrong', 'error');
  },

  // ---------- dialogs ----------
  /**
   * A form in a pop-up.
   *   App.form({
   *     title: 'New task', submit: 'Save',
   *     fields: [{ name:'title', label:'Title', type:'text', required:true },
   *              { name:'priority', label:'Priority', type:'select', options:[['high','High'],...] }],
   *     values: { priority: 'medium' },
   *     onSubmit: async (values) => { ...call the API... }   // throw to keep the dialog open
   *   })
   */
  form({ title, submit = 'Save', fields, values = {}, onSubmit, danger = false, extra = null }) {
    const dialog = this.el('dialog', { class: 'modal' });
    const form = this.el('form', { method: 'dialog', novalidate: true });
    form.append(this.el('h2', { text: title }));

    for (const f of fields) {
      const id = `f-${f.name}`;
      let input;
      const value = values[f.name] ?? f.value ?? '';
      if (f.type === 'select') {
        input = this.el('select', { id, name: f.name },
          f.options.map(([v, label]) => this.el('option', { value: v, text: label, selected: String(v) === String(value) })));
      } else if (f.type === 'textarea') {
        input = this.el('textarea', { id, name: f.name, rows: 3, maxlength: f.max });
        input.value = value;
      } else {
        input = this.el('input', { id, name: f.name, type: f.type || 'text', maxlength: f.max, min: f.min, max: f.maxValue, step: f.step, placeholder: f.placeholder, autocomplete: f.autocomplete || 'off' });
        input.value = value;
      }
      if (f.required) input.required = true;
      form.append(this.el('label', { for: id, class: 'field' },
        this.el('span', { text: f.label }), input,
        this.el('small', { class: 'field-error', 'data-error-for': f.name })));
    }

    const cancel = this.el('button', { type: 'button', class: 'btn-ghost', text: 'Cancel', onclick: () => dialog.close() });
    const save = this.el('button', { type: 'submit', class: danger ? 'btn-danger' : 'btn-primary', text: submit });
    // `extra` = { label, onClick } puts one more button on the left (e.g. "Delete").
    const extraBtn = extra && this.el('button', {
      type: 'button', class: 'btn-ghost danger-text', text: extra.label,
      onclick: async () => { if (await extra.onClick()) dialog.close(); },
    });
    form.append(this.el('div', { class: `modal-actions${extra ? ' has-extra' : ''}` }, extraBtn, cancel, save));

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {};
      for (const f of fields) data[f.name] = form.elements[f.name].value;
      // Check "required" ourselves so the messages look like the rest of the page.
      let ok = true;
      for (const f of fields) {
        const slot = form.querySelector(`[data-error-for="${f.name}"]`);
        slot.textContent = '';
        if (f.required && !String(data[f.name]).trim()) { slot.textContent = 'Required'; ok = false; }
      }
      if (!ok) return;
      save.disabled = true;
      try {
        await onSubmit(data);
        dialog.close();
      } catch (err) {
        this.showError(err, form);
      } finally {
        save.disabled = false;
      }
    });

    dialog.append(form);
    dialog.addEventListener('close', () => dialog.remove());
    document.body.append(dialog);
    dialog.showModal();
    form.querySelector('input, select, textarea')?.focus();
    return dialog;
  },

  /** "Are you sure?" -> Promise<boolean> */
  confirm(message, { yes = 'Delete', title = 'Are you sure?' } = {}) {
    return new Promise((resolve) => {
      let answered = false;
      const dialog = this.el('dialog', { class: 'modal small' },
        this.el('h2', { text: title }),
        this.el('p', { text: message }),
        this.el('div', { class: 'modal-actions' },
          this.el('button', { class: 'btn-ghost', text: 'Cancel', onclick: () => dialog.close() }),
          this.el('button', { class: 'btn-danger', text: yes, onclick: () => { answered = true; dialog.close(); } })));
      dialog.addEventListener('close', () => { dialog.remove(); resolve(answered); });
      document.body.append(dialog);
      dialog.showModal();
    });
  },
};

if (document.body.hasAttribute('data-protected') && App.requireLogin()) {
  App.showUser();
  document.querySelectorAll('[data-logout]').forEach((a) =>
    a.addEventListener('click', (e) => { e.preventDefault(); App.logout(); }));
  // Make sure the name on screen is the real one (and that the token still works).
  Api.get('/auth/me').then(({ user }) => { Store.setUser(user); App.showUser(); }).catch(() => {});
}
