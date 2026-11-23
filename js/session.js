// Who is logged in, for the pages that talk to the server (Tasks, Planner).
// Needs js/utils/storage.js and js/utils/api.js loaded first, and js/sidebar.js before this file.
//
//   <body data-protected>   the page needs a login: visitors are sent to the login page.
//
// The login itself happens on pages/login.html (js/auth.js): the server gives a token, Store keeps it.

const Session = {
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

  /** Puts the real name and e-mail in the sidebar and in the top bar (where the pages show a user). */
  showUser() {
    const user = Store.getUser();
    if (!user) return;
    document.querySelectorAll('.user-name, #profileName').forEach((e) => (e.textContent = user.name));
    document.querySelectorAll('#profileEmail').forEach((e) => (e.textContent = user.email));
    document.querySelectorAll('.avatar, .sb-avatar').forEach((e) => (e.textContent = Dates.initials(user.name)));
  },
};

// one listener for every "Log out" button (the sidebar's is added by js/sidebar.js)
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-logout]')) {
    e.preventDefault();
    Session.logout();
  }
});

if (document.body.hasAttribute('data-protected') && Session.requireLogin()) {
  Session.showUser();
  // make sure the name on screen is the real one, and that the token still works
  Api.get('/auth/me').then(({ user }) => { Store.setUser(user); Session.showUser(); }).catch(() => {});
}
