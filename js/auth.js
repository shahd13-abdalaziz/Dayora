// Login and sign-up forms (pages/login.html).

// Already logged in? Skip the form.
if (Store.getToken()) location.replace('dashboard.html');

// The sidebar's "Register" button opens the page on the Sign up tab (login.html?mode=register).
if (new URLSearchParams(location.search).get('mode') === 'register') {
  document.getElementById('mode-register').checked = true;
}

function wireAuthForm(form, path) {
  const errorBox = form.querySelector('.form-error');
  const button = form.querySelector('button[type="submit"]');
  const label = button.textContent;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.textContent = '';
    button.disabled = true;
    button.textContent = 'Please wait...';

    const body = Object.fromEntries(new FormData(form));
    if (body.email) body.email = body.email.trim();

    try {
      const { token, user } = await Api.post(path, body);
      Store.setSession(token, user);
      location.href = 'dashboard.html';
    } catch (err) {
      // Prefer the specific field message ("already used") over the generic one.
      errorBox.textContent = err.message;
      button.disabled = false;
      button.textContent = label;
    }
  });
}

wireAuthForm(document.getElementById('loginForm'), '/auth/login');
wireAuthForm(document.getElementById('registerForm'), '/auth/register');
