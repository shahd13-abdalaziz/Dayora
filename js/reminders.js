// Planner reminders: a browser notification 10 minutes before a session, and another when it starts.
// Runs on every app page, so it works while any Dayora tab is open. Needs js/utils/notify.js loaded first.
//
// It only does something when the person turned notifications on in Settings (Notify.enabled()).
// It asks the server for TODAY's sessions every few minutes and checks the clock every 20 seconds.
// Each reminder is remembered (localStorage), so two open tabs, or a reload, never repeat it.

(function () {
  if (typeof Notify === 'undefined' || !Notify.supported) return;
  if (!localStorage.getItem('dayora_token')) return;               // not logged in: nothing to remind

  var LEAD_MINUTES = 10;
  var REFRESH_MS = 5 * 60 * 1000;
  var CHECK_MS = 20 * 1000;
  var SEEN_KEY = 'dayora_reminded';

  // same rule as js/utils/api.js (the pages may be opened from Live Server or a file)
  var API = location.protocol === 'file:' || location.port === '5501' ? 'http://localhost:5000/api' : '/api';

  var sessions = [];
  var loadedAt = 0;
  var loadedDay = '';
  var loading = false;

  function pad(n) { return String(n).padStart(2, '0'); }
  function today() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

  /** 13 -> "1:00 PM", 9.5 -> "9:30 AM" */
  function hourText(h) {
    var hour = Math.floor(h);
    var minutes = Math.round((h - hour) * 60);
    var h12 = hour % 12 === 0 ? 12 : hour % 12;
    return h12 + ':' + pad(minutes) + (hour >= 12 && hour < 24 ? ' PM' : ' AM');
  }

  // ---------- what was already announced today ----------
  function seen() {
    try {
      var s = JSON.parse(localStorage.getItem(SEEN_KEY));
      if (s && s.day === today() && Array.isArray(s.keys)) return s.keys;
    } catch (e) { /* damaged: start again */ }
    return [];
  }

  function remember(key) {
    var keys = seen();
    keys.push(key);
    try { localStorage.setItem(SEEN_KEY, JSON.stringify({ day: today(), keys: keys })); } catch (e) { /* ignore */ }
  }

  // ---------- today's sessions ----------
  function load() {
    if (loading) return Promise.resolve();
    loading = true;
    var day = today();
    return fetch(API + '/sessions?from=' + day + '&to=' + day, {
      headers: { Authorization: 'Bearer ' + localStorage.getItem('dayora_token') },
    })
      .then(function (res) { return res.ok ? res.json() : { sessions: [] }; })
      .then(function (data) { sessions = data.sessions || []; loadedAt = Date.now(); loadedDay = day; })
      .catch(function () { /* server away: try again next time */ })
      .then(function () { loading = false; });
  }

  // ---------- the clock check ----------
  function check() {
    var now = new Date();
    var nowMinutes = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
    var done = seen();

    sessions.forEach(function (s) {
      var untilStart = s.startHour * 60 - nowMinutes;            // minutes until it starts (negative = already started)
      var lead = s.id + ':lead';
      var start = s.id + ':start';

      if (untilStart > 0 && untilStart <= LEAD_MINUTES && done.indexOf(lead) < 0) {
        remember(lead);
        Notify.show('Starting in ' + Math.ceil(untilStart) + ' min: ' + s.title,
          hourText(s.startHour) + ' to ' + hourText(s.endHour) + ' · ' + s.type, { tag: 'dayora-session-' + s.id });
      } else if (untilStart <= 0 && untilStart > -3 && done.indexOf(start) < 0) {
        // it just started (3 minutes of grace, so a page opened a moment late still tells you)
        remember(start);
        Notify.show('Time to start: ' + s.title, hourText(s.startHour) + ' to ' + hourText(s.endHour), { tag: 'dayora-session-' + s.id });
      }
    });
  }

  function tick() {
    if (!Notify.enabled()) return;
    var stale = loadedDay !== today() || Date.now() - loadedAt > REFRESH_MS;
    (stale ? load() : Promise.resolve()).then(check);
  }

  setInterval(tick, CHECK_MS);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) tick(); });
  tick();
})();
