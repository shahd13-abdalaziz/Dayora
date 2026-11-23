// Small helpers shared by the Habits and Notes pages: build elements safely, pop-up forms with
// validation, "are you sure?" dialogs and little messages (toasts).
//
//   UI.el('div', { class: 'card' }, 'text', childElement)   builds an element (text is never run as HTML)
//   UI.form({ title, fields, values, onSubmit })             a pop-up form
//   UI.confirm('Delete this?')                               -> Promise<true | false>
//   UI.toast('Saved')                                        a message in the corner

const UI = {
  pad: (n) => String(n).padStart(2, '0'),

  /** Date -> "2026-10-19" in the browser's own timezone. */
  ymd(d = new Date()) {
    return `${d.getFullYear()}-${this.pad(d.getMonth() + 1)}-${this.pad(d.getDate())}`;
  },

  addDays(d, n) {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  },

  /** Build an element. Strings go in as text, never as HTML, so "<img onerror=...>" is harmless. */
  el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) node.append(c);
    return node;
  },

  toast(message, type = 'ok') {
    let box = document.getElementById('toasts');
    if (!box) {
      box = this.el('div', { id: 'toasts', 'aria-live': 'polite' });
      document.body.append(box);
    }
    const t = this.el('div', { class: `toast ${type}`, text: message });
    box.append(t);
    setTimeout(() => t.remove(), 3000);
  },

  /**
   * A pop-up form with validation.
   * fields: [{ name, label, type: 'text' | 'textarea' | 'colors', required, min, max, validate(value) -> message or '' }]
   *   - required / min / max (text length) are checked for you
   *   - validate() is for anything special (return the message to show, or '' when it is fine)
   * onSubmit(values) runs when everything is valid. Throw an Error to keep the pop-up open and show its message.
   * extra: { label, onClick } puts one more button on the left (for example "Delete").
   */
  form({ title, submit = 'Save', fields, values = {}, onSubmit, extra = null }) {
    const dialog = this.el('dialog', { class: 'modal' });
    const form = this.el('form', { method: 'dialog', novalidate: true });
    form.append(this.el('h2', { text: title }));

    for (const f of fields) {
      const id = `f-${f.name}`;
      const value = values[f.name] ?? f.value ?? '';
      let control;
      if (f.type === 'textarea') {
        control = this.el('textarea', { id, name: f.name, rows: 7, maxlength: f.max });
        control.value = value;
      } else if (f.type === 'colors') {
        // a row of round colour swatches (radio buttons underneath, so the keyboard works too)
        control = this.el('div', { class: 'swatches', role: 'radiogroup', 'aria-label': f.label },
          f.options.map(([val, label, hex]) => this.el('label', { class: 'swatch', title: label },
            this.el('input', { type: 'radio', name: f.name, value: val, checked: val === value }),
            this.el('span', { style: { backgroundColor: hex } }))));
      } else {
        control = this.el('input', { id, name: f.name, type: 'text', maxlength: f.max, autocomplete: 'off' });
        control.value = value;
      }
      form.append(this.el('div', { class: 'field' },
        this.el('label', { for: id, text: f.label }), control,
        this.el('small', { class: 'field-error', 'data-error-for': f.name })));
    }

    const cancel = this.el('button', { type: 'button', class: 'btn-ghost', text: 'Cancel', onclick: () => { dialog.close(); dialog.remove(); } });
    const save = this.el('button', { type: 'submit', class: 'btn-primary', text: submit });
    const extraBtn = extra && this.el('button', {
      type: 'button', class: 'btn-ghost danger-text', text: extra.label,
      onclick: async () => { if (await extra.onClick()) { dialog.close(); dialog.remove(); } },
    });
    form.append(this.el('div', { class: `modal-actions${extra ? ' has-extra' : ''}` }, extraBtn, cancel, save));

    const showError = (name, msg) => { form.querySelector(`[data-error-for="${name}"]`).textContent = msg; };
    // an error disappears as soon as the person starts fixing the field
    form.addEventListener('input', (e) => { if (e.target.name) showError(e.target.name, ''); });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {};
      let ok = true;
      for (const f of fields) {
        const raw = form.elements[f.name].value;
        const v = f.type === 'colors' ? raw : raw.trim();
        data[f.name] = v;
        let msg = '';
        if (f.required && !v) msg = 'This field is required';
        else if (f.min && v.length < f.min) msg = `Please write at least ${f.min} characters`;
        else if (f.max && v.length > f.max) msg = `Please keep it under ${f.max} characters`;
        else if (f.validate) msg = f.validate(v) || '';
        showError(f.name, msg);
        if (msg && ok) { form.elements[f.name].focus?.(); }
        if (msg) ok = false;
      }
      if (!ok) return;
      save.disabled = true;
      try {
        await onSubmit(data);
        dialog.close();
        dialog.remove();               // gone at once (the "close" event below would only do it a moment later)
      } catch (err) {
        this.toast(err.message || 'Something went wrong', 'error');
      } finally {
        save.disabled = false;
      }
    });

    dialog.append(form);
    dialog.addEventListener('close', () => dialog.remove());
    document.body.append(dialog);
    dialog.showModal();
    form.querySelector('input[type="text"], textarea')?.focus();
    return dialog;
  },

  /** "Are you sure?" -> Promise<boolean> */
  confirm(message, { yes = 'Delete', title = 'Are you sure?' } = {}) {
    return new Promise((resolve) => {
      let finished = false;
      // answer at once, do not wait for the dialog's "close" event
      const finish = (answer) => {
        if (finished) return;
        finished = true;
        if (dialog.open) dialog.close();
        dialog.remove();
        resolve(answer);
      };
      const dialog = this.el('dialog', { class: 'modal small' },
        this.el('h2', { text: title }),
        this.el('p', { text: message }),
        this.el('div', { class: 'modal-actions' },
          this.el('button', { class: 'btn-ghost', text: 'Cancel', onclick: () => finish(false) }),
          this.el('button', { class: 'btn-danger', text: yes, onclick: () => finish(true) })));
      dialog.addEventListener('close', () => finish(false));      // Esc key
      document.body.append(dialog);
      dialog.showModal();
    });
  },
};
