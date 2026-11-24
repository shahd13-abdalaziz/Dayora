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

// ---------- Continue with Google ----------
// How it works: Google draws the button and, after the person picks their account, hands THIS page a signed token.
// We send that token to our server (POST /api/auth/google); the server asks Google if it is real, then logs the person in.
// The button only shows when the server has a Google client id (see "Sign in with Google" in server/README.md).

const googleError = document.getElementById('googleError');

async function signInWithGoogle(credential) {
  googleError.textContent = '';
  try {
    const { token, user } = await Api.post('/auth/google', { credential });
    Store.setSession(token, user);
    location.href = 'dashboard.html';
  } catch (err) {
    googleError.textContent = err.message;
  }
}

function loadGoogleScript() {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Could not load Google sign-in (are you online?)'));
    document.head.append(s);
  });
}

async function setUpGoogle() {
  let clientId;
  try {
    ({ googleClientId: clientId } = await Api.get('/auth/config'));
  } catch {
    return;                                      // server not reachable: the forms already explain that
  }
  if (!clientId) return;                         // Google is not set up: no button

  const section = document.getElementById('googleSection');
  try {
    await loadGoogleScript();
  } catch {
    return;                                      // offline or blocked: the normal forms still work
  }
  google.accounts.id.initialize({ client_id: clientId, callback: (r) => signInWithGoogle(r.credential) });
  section.hidden = false;
  const box = document.getElementById('googleButton');
  google.accounts.id.renderButton(box, {
    theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with',
    width: Math.min(360, box.clientWidth || 320),
  });
}

setUpGoogle();
