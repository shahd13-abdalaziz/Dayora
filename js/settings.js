// Settings page (pages/settings.html).
//
//   GET/PUT  /api/auth/me          your name
//   GET/PUT  /api/settings         focus / break lengths and the daily goal (the Focus Room reads them)
//   PUT      /api/auth/password    change password
//   GET      /api/export/*.csv     download your data
//   DELETE   /api/auth/me          delete the account
//
// The light / dark choice is not sent to the server: it lives in this browser (see js/utils/theme.js).

const DEFAULT_TIMER = { focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15, dailyGoalMinutes: 120 };

// the same limits the server checks (SettingsDto), so a mistake is explained before anything is sent
const TIMER_RULES = {
  focusMinutes: { label: 'Focus', min: 1, max: 180 },
  shortBreakMinutes: { label: 'Short break', min: 1, max: 60 },
  longBreakMinutes: { label: 'Long break', min: 1, max: 120 },
  dailyGoalMinutes: { label: 'Daily goal', min: 10, max: 1440 },
};

let me = Store.getUser() || {};

const $ = (id) => document.getElementById(id);

function showError(form, name, message) {
  form.querySelector(`[data-error-for="${name}"]`).textContent = message;
}

function clearErrors(form) {
  form.querySelectorAll('.field-error').forEach((e) => (e.textContent = ''));
}

/** Shows server messages ({ fields: { name: "..." } }) under the right input, plus a toast. */
function reportError(form, err) {
  for (const [name, msg] of Object.entries(err.fields || {})) {
    const box = form.querySelector(`[data-error-for="${name}"]`);
    if (box) box.textContent = msg;
  }
  UI.toast(err.message || 'Something went wrong', 'error');
}

// ---------- profile ----------
function paintProfile() {
  $('set-avatar').textContent = Dates.initials(me.name || '');
  $('set-name-view').textContent = me.name || '';
  $('set-email-view').textContent = me.email || '';
  $('p-name').value = me.name || '';
  $('p-email').value = me.email || '';
  Session.showUser();                                   // the sidebar too
}

$('profile-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  clearErrors(form);
  const name = $('p-name').value.trim();
  if (name.length < 2) return showError(form, 'name', 'Please write at least 2 characters');
  if (name.length > 80) return showError(form, 'name', 'Please keep it under 80 characters');
  if (name === me.name) return UI.toast('That is already your name');

  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    const { user } = await Api.put('/auth/me', { name });
    me = { ...me, ...user };
    Store.setUser(me);
    paintProfile();
    UI.toast('Name saved');
  } catch (err) {
    reportError(form, err);
  } finally {
    button.disabled = false;
  }
});

// ---------- focus timer ----------
function fillTimer(values) {
  $('t-focus').value = values.focusMinutes;
  $('t-short').value = values.shortBreakMinutes;
  $('t-long').value = values.longBreakMinutes;
  $('t-goal').value = values.dailyGoalMinutes;
}

$('timer-reset').addEventListener('click', () => {
  fillTimer(DEFAULT_TIMER);
  clearErrors($('timer-form'));
  UI.toast('Default times filled in. Press "Save timer" to keep them.');
});

$('timer-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  clearErrors(form);

  const body = {};
  let ok = true;
  for (const [name, rule] of Object.entries(TIMER_RULES)) {
    const raw = form.elements[name].value.trim();
    const n = Number(raw);
    let msg = '';
    if (raw === '') msg = 'Please enter a number';
    else if (!Number.isInteger(n)) msg = 'Use a whole number of minutes';
    else if (n < rule.min || n > rule.max) msg = `Must be between ${rule.min} and ${rule.max}`;
    showError(form, name, msg);
    if (msg) ok = false;
    body[name] = n;
  }
  if (!ok) return;

  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    const { settings } = await Api.put('/settings', body);
    fillTimer(settings);
    UI.toast('Timer saved');
  } catch (err) {
    reportError(form, err);
  } finally {
    button.disabled = false;
  }
});

// ---------- appearance ----------
const themeRadios = [...document.querySelectorAll('input[name="theme"]')];

function paintTheme() {
  const value = Theme.isDark() ? 'dark' : 'light';
  themeRadios.forEach((r) => (r.checked = r.value === value));
}

themeRadios.forEach((r) => r.addEventListener('change', () => Theme.set(r.value === 'dark')));
// the sidebar's own switch changes the page class: follow it
new MutationObserver(paintTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
paintTheme();

// ---------- password ----------
function paintPassword() {
  const box = $('pass-box');
  box.replaceChildren();
  if (me.hasPassword === false) {
    $('pass-sub').textContent = 'This account signs in with Google.';
    box.append(UI.el('p', { class: 'set-hint' }, 'You log in with your Google account, so there is no Dayora password to change or remember.'));
    return;
  }
  box.append(
    UI.el('p', { class: 'set-hint' }, 'Use at least 6 characters. You stay logged in on this device after changing it.'),
    UI.el('div', { class: 'set-actions set-actions--left' },
      UI.el('button', { class: 'btn-ghost', type: 'button', text: 'Change password', onclick: openPasswordForm })));
}

function openPasswordForm() {
  UI.form({
    title: 'Change password',
    submit: 'Change password',
    fields: [
      { name: 'currentPassword', label: 'Current password', type: 'password', required: true },
      { name: 'newPassword', label: 'New password', type: 'password', required: true,
        validate: (v) => (v.length < 6 ? 'Please write at least 6 characters' : v.length > 72 ? 'Please keep it under 72 characters' : '') },
      { name: 'again', label: 'New password again', type: 'password', required: true,
        validate: (v, all) => (v !== all.newPassword ? 'The two passwords are not the same' : '') },
    ],
    onSubmit: async ({ currentPassword, newPassword }) => {
      await Api.put('/auth/password', { currentPassword, newPassword });
      UI.toast('Password changed');
    },
  });
}

// ---------- download my data ----------
document.querySelectorAll('[data-export]').forEach((button) => {
  button.addEventListener('click', async () => {
    const what = button.dataset.export;                  // "tasks" or "focus"
    button.disabled = true;
    try {
      await Api.download(`/export/${what}.csv`, `dayora-${what}.csv`);
    } catch (err) {
      UI.toast(err.message, 'error');
    } finally {
      button.disabled = false;
    }
  });
});

// ---------- delete account ----------
$('delete-account').addEventListener('click', () => {
  const withPassword = me.hasPassword !== false;
  UI.form({
    title: 'Delete your account?',
    submit: 'Delete forever',
    fields: [withPassword
      ? { name: 'password', label: 'Type your password to confirm', type: 'password', required: true }
      : { name: 'confirmEmail', label: `Type your e-mail (${me.email}) to confirm`, type: 'text', required: true,
          validate: (v) => (v.toLowerCase() === (me.email || '').toLowerCase() ? '' : 'That is not your e-mail') }],
    onSubmit: async (values) => {
      await Api.del('/auth/me', withPassword ? { password: values.password } : { confirmEmail: values.confirmEmail });
      Store.clear();
      location.href = 'home.html';
    },
  });
});

// ---------- start ----------
async function start() {
  if (!Store.getToken()) return;                        // session.js is already sending the visitor to the login page
  paintProfile();
  paintPassword();
  fillTimer(DEFAULT_TIMER);

  try {
    const [{ user }, { settings }] = await Promise.all([Api.get('/auth/me'), Api.get('/settings')]);
    me = { ...me, ...user };
    Store.setUser(me);
    paintProfile();
    paintPassword();
    fillTimer(settings);
  } catch (err) {
    UI.toast(err.message, 'error');
  }
}

start();
