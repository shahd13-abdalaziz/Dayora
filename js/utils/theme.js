// One dark-mode switch for every page of Dayora.
//
// Load it in the <head> of each page (before the page is drawn, so there is no white flash):
//   <script src="../js/utils/theme.js"></script>
//
// Any element with   data-theme-toggle   (or the dashboard's  .theme-btn)  becomes the switch.
// The choice is saved under the key "theme" ("dark" / "light") and is shared by all pages,
// even when two pages are open in different tabs.
//
// Dark mode is the class "dark-mode" on <html> and on <body>:
//   html.dark-mode ...   is used by the home page, the app pages, login and contact
//   body.dark-mode ...   is used by dashboard.css

(function () {
  var KEY = 'theme';
  var root = document.documentElement;

  function saved() {
    try { return localStorage.getItem(KEY) === 'dark'; } catch (e) { return false; }
  }

  function save(dark) {
    try { localStorage.setItem(KEY, dark ? 'dark' : 'light'); } catch (e) { /* private mode: still works for this visit */ }
  }

  function isDark() {
    return root.classList.contains('dark-mode');
  }

  // Updates the classes and every switch button on the page.
  function paint(dark) {
    root.classList.toggle('dark-mode', dark);
    if (document.body) document.body.classList.toggle('dark-mode', dark);

    document.querySelectorAll('[data-theme-toggle]').forEach(function (btn) {
      btn.setAttribute('aria-pressed', dark);
      btn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
      btn.setAttribute('title', dark ? 'Light mode' : 'Dark mode');
    });

    // The dashboard's sidebar button has its own icon + label.
    document.querySelectorAll('.theme-btn').forEach(function (btn) {
      var text = btn.querySelector('span');
      var icon = btn.querySelector('i');
      if (text) text.textContent = dark ? 'Light Mode' : 'Dark Mode';
      if (icon) {
        icon.classList.toggle('fa-sun', dark);
        icon.classList.toggle('fa-moon', !dark);
      }
    });
  }

  function set(dark) {
    save(dark);
    paint(dark);
  }

  // 1) Right now (we are in <head>, so only <html> exists).
  paint(saved());

  // 2) The moment <body> appears, give it the class too (dashboard.css needs it on <body>).
  if (!document.body) {
    new MutationObserver(function (_, observer) {
      if (document.body) {
        document.body.classList.toggle('dark-mode', isDark());
        observer.disconnect();
      }
    }).observe(root, { childList: true });
  }

  // 3) When the page is ready, the buttons exist: update them.
  document.addEventListener('DOMContentLoaded', function () { paint(saved()); });

  // 4) Clicks (works for buttons added later too).
  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('[data-theme-toggle], .theme-btn')) set(!isDark());
  });

  // 5) Another tab changed the choice: follow it.
  window.addEventListener('storage', function (e) {
    if (e.key === KEY) paint(saved());
  });

  window.Theme = { isDark: isDark, set: set };
})();
