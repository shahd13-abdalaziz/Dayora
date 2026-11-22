// Settings (pages/settings.html).

const $ = (id) => document.getElementById(id);

/** Runs `work` while the form's button is disabled; shows the server's message if it fails. */
async function submitForm(form, work) {
  const button = form.querySelector('button[type="submit"]');
  form.querySelectorAll('.field-error').forEach((e) => (e.textContent = ''));
  button.disabled = true;
  try {
    await work(Object.fromEntries(new FormData(form)));
  } catch (err) {
    App.showError(err, form);
  } finally {
    button.disabled = false;
  }
}

// ---------- profile ----------
const profileForm = $('profile-form');
const user = Store.getUser();
if (user) {
  profileForm.elements.name.value = user.name;
  profileForm.elements.email.value = user.email;
}

profileForm.addEventListener('submit', (e) => {
  e.preventDefault();
  submitForm(profileForm, async ({ name }) => {
    const { user: saved } = await Api.put('/auth/me', { name });
    Store.setUser(saved);
    App.showUser();
    App.toast('Profile saved');
  });
});

// ---------- password ----------
const passwordForm = $('password-form');
passwordForm.addEventListener('submit', (e) => {
  e.preventDefault();
  submitForm(passwordForm, async (v) => {
    await Api.put('/auth/password', { currentPassword: v.currentPassword, newPassword: v.newPassword });
    passwordForm.reset();
    App.toast('Password changed');
  });
});

// ---------- timer ----------
const timerForm = $('timer-form');
const timerFields = ['focusMinutes', 'shortBreakMinutes', 'longBreakMinutes', 'dailyGoalMinutes'];

Api.get('/settings')
  .then(({ settings }) => timerFields.forEach((f) => (timerForm.elements[f].value = settings[f])))
  .catch((err) => App.showError(err));

timerForm.addEventListener('submit', (e) => {
  e.preventDefault();
  submitForm(timerForm, async (v) => {
    const body = Object.fromEntries(timerFields.map((f) => [f, Number(v[f])]));
    await Api.put('/settings', body);
    App.toast('Timer settings saved');
  });
});

// ---------- export ----------
const exportButton = (id, path, file) =>
  $(id).addEventListener('click', async () => {
    try {
      await Api.download(path, file);
    } catch (err) {
      App.showError(err);
    }
  });
exportButton('export-tasks', '/export/tasks.csv', 'dayora-tasks.csv');
exportButton('export-focus', '/export/focus.csv', 'dayora-focus.csv');

// ---------- delete account ----------
$('delete-account').addEventListener('click', () => {
  App.form({
    title: 'Delete your account?',
    submit: 'Delete everything',
    danger: true,
    fields: [{ name: 'password', label: 'Type your password to confirm', type: 'password', required: true, autocomplete: 'current-password' }],
    onSubmit: async ({ password }) => {
      await Api.del('/auth/me', { password });
      Store.clear();
      location.href = Api.loginUrl;
    },
  });
});
