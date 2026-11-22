// The sidebar shared by every page of the app (dashboard, tasks, calendar).
// It is the dashboard's sidebar (the one in Ahmed's branch), written once here, so a new menu item is a one-place change.
//
// A page only needs an empty placeholder where the sidebar goes:
//     <div id="app-sidebar"></div>
// and the files:   css/sidebar.css   and   js/sidebar.js   (and js/utils/theme.js in the <head> for dark mode).
//
// On phones the sidebar becomes a drawer that slides in from the left (menu button in the top bar).

(function () {
  var placeholder = document.getElementById('app-sidebar');
  if (!placeholder) return;

  // The icons are Font Awesome (like the dashboard). Load it if the page did not.
  if (!document.querySelector('link[href*="font-awesome"]')) {
    var fa = document.createElement('link');
    fa.rel = 'stylesheet';
    fa.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css';
    document.head.appendChild(fa);
  }

  // [link, icon classes, label]  - the menu, in order
  var MENU = [
    ['../index.html', 'fa-solid fa-house', 'Home'],
    ['tasks.html', 'fa-regular fa-square-check', 'Tasks'],
    ['planner.html', 'fa-regular fa-calendar', 'Calendar'],
    ['habits.html', 'fa-solid fa-seedling', 'Habits'],
    ['notes.html', 'fa-regular fa-note-sticky', 'Notes'],
    ['contact.html', 'fa-regular fa-user', 'Contact-Us'],
  ];

  var current = location.pathname.split('/').pop() || '';
  var logo = '../imgs/file_00000000322c8210980e21a958c092d7.png';

  var links = MENU.map(function (m) {
    var active = m[0] === current;
    return '<a href="' + m[0] + '" class="app-nav_item' + (active ? ' active' : '') + '"' +
      (active ? ' aria-current="page"' : '') + '><i class="' + m[1] + '"></i><span>' + m[2] + '</span></a>';
  }).join('');

  var aside = document.createElement('aside');
  aside.className = 'app-sidebar';
  aside.id = 'appSidebar';
  aside.innerHTML =
    '<a href="../index.html" class="app-brand"><img src="' + logo + '" alt=""><span>Dayora</span></a>' +
    '<nav class="app-nav" aria-label="Main menu">' + links + '</nav>' +
    '<div class="app-sidebar_bottom">' +
      '<div class="app-divider"></div>' +
      '<div class="app-auth">' +
        '<a href="login.html" class="app-auth_btn app-auth_primary">Login</a>' +
        '<a href="login.html" class="app-auth_btn app-auth_outline">Register</a>' +
      '</div>' +
      '<button type="button" class="theme-btn" data-theme-toggle aria-label="Switch to dark mode" aria-pressed="false">' +
        '<i class="fa-solid fa-moon icon-moon"></i><i class="fa-solid fa-sun icon-sun"></i>' +
        '<span class="theme-label">Dark Mode</span>' +
      '</button>' +
      '<div class="app-user">' +
        '<div class="sb-avatar" aria-hidden="true"><i class="fa-solid fa-user"></i></div>' +
        '<div class="app-user_text"><span id="profileName">User Name</span><small id="profileEmail">user@email.com</small></div>' +
        '<span class="app-user_more" aria-hidden="true"><i class="fa-solid fa-ellipsis"></i></span>' +
      '</div>' +
    '</div>' +
    '<div class="app-sidebar_foot"><i class="fa-solid fa-seedling"></i><p>Small Steps, Big Progress</p><span>&#10084;&#65039;</span></div>';

  // top bar + dark backdrop, only visible on phones
  var topbar = document.createElement('div');
  topbar.className = 'app-mobilebar';
  topbar.innerHTML =
    '<button type="button" class="app-mobilebar_btn" id="appMenuBtn" aria-label="Open menu" aria-expanded="false" aria-controls="appSidebar"><i class="fa-solid fa-bars"></i></button>' +
    '<a href="../index.html" class="app-brand"><img src="' + logo + '" alt=""><span>Dayora</span></a>';
  var backdrop = document.createElement('div');
  backdrop.className = 'app-backdrop';

  placeholder.replaceWith(aside);
  aside.after(topbar, backdrop);

  function setOpen(open) {
    aside.classList.toggle('open', open);
    backdrop.classList.toggle('show', open);
    document.getElementById('appMenuBtn').setAttribute('aria-expanded', open);
    document.body.classList.toggle('no-scroll', open);
  }

  document.getElementById('appMenuBtn').addEventListener('click', function () { setOpen(!aside.classList.contains('open')); });
  backdrop.addEventListener('click', function () { setOpen(false); });
  aside.addEventListener('click', function (e) { if (e.target.closest('a')) setOpen(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setOpen(false); });
})();
