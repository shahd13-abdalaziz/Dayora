// Focus Room (pages/focus.html): a timer that saves every finished focus session on the server.

const CIRCLE = 2 * Math.PI * 112;          // length of the ring (radius 112)
const els = {
  time: document.getElementById('time'),
  note: document.getElementById('time-note'),
  bar: document.getElementById('ring-bar'),
  start: document.getElementById('start-btn'),
  finish: document.getElementById('finish-btn'),
  reset: document.getElementById('reset-btn'),
  tabs: document.querySelectorAll('#mode-tabs button'),
  task: document.getElementById('task-select'),
  picker: document.getElementById('task-picker'),
};

let settings = { focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15, dailyGoalMinutes: 120 };
let mode = 'focus';              // 'focus' | 'short' | 'long'
let totalSeconds = 25 * 60;      // length of the current round
let remaining = totalSeconds;    // seconds left
let endsAt = null;               // clock time the round ends (null = not running)
let ticker = null;
let completedFocusRounds = 0;    // every 4th focus round is followed by a long break

const minutesFor = (m) => ({ focus: settings.focusMinutes, short: settings.shortBreakMinutes, long: settings.longBreakMinutes })[m];
const running = () => endsAt !== null;

// ---------- drawing ----------
function draw() {
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  els.time.textContent = `${App.pad(m)}:${App.pad(s)}`;
  els.bar.style.strokeDasharray = CIRCLE;
  els.bar.style.strokeDashoffset = CIRCLE * (1 - remaining / totalSeconds);
  document.title = running() ? `${els.time.textContent} · Dayora` : 'Dayora - Focus Room';
  els.note.textContent = running() ? (mode === 'focus' ? 'Focusing' : 'Break') : remaining === totalSeconds ? 'Ready' : 'Paused';
  els.start.textContent = running() ? 'Pause' : remaining === totalSeconds ? 'Start' : 'Resume';
  // "Finish & save" only makes sense once a focus round has really started.
  els.finish.hidden = !(mode === 'focus' && remaining < totalSeconds);
  els.picker.style.display = mode === 'focus' ? '' : 'none';
  els.tabs.forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
}

function setMode(next) {
  stop();
  mode = next;
  totalSeconds = minutesFor(mode) * 60;
  remaining = totalSeconds;
  draw();
}

// ---------- the clock ----------
// We store when the round ends instead of counting ticks, so the timer stays correct
// even if the browser slows this tab down in the background.
function tick() {
  remaining = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
  draw();
  if (remaining === 0) roundFinished();
}

function start() {
  endsAt = Date.now() + remaining * 1000;
  ticker = setInterval(tick, 250);
  draw();
}

function stop() {
  if (ticker) clearInterval(ticker);
  ticker = null;
  endsAt = null;
}

function pause() {
  if (running()) tick();   // bring `remaining` up to date before stopping
  stop();
  draw();
}

function beep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    osc.frequency.value = 660;
    osc.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch { /* no sound available: fine */ }
}

// ---------- saving ----------
async function saveFocus(minutes) {
  if (minutes < 1) return false;
  try {
    await Api.post('/focus', { minutes, taskId: els.task.value ? Number(els.task.value) : null, date: App.ymd() });
    await loadToday();
    return true;
  } catch (err) {
    App.showError(err);
    return false;
  }
}

async function roundFinished() {
  stop();
  beep();
  if (mode === 'focus') {
    const saved = await saveFocus(minutesFor('focus'));
    if (saved) App.toast(`Nice! ${minutesFor('focus')} minutes of focus saved.`);
    completedFocusRounds += 1;
    setMode(completedFocusRounds % 4 === 0 ? 'long' : 'short');
  } else {
    App.toast('Break is over. Ready for the next round?');
    setMode('focus');
  }
}

// Finish early: save only the time that really went by.
async function finishEarly() {
  const elapsedMinutes = Math.round((totalSeconds - remaining) / 60);
  pause();
  if (elapsedMinutes < 1) {
    App.toast('Less than a minute so far, nothing to save yet.', 'error');
    return;
  }
  if (await saveFocus(elapsedMinutes)) App.toast(`Saved ${elapsedMinutes} minute${elapsedMinutes === 1 ? '' : 's'} of focus.`);
  setMode('focus');
}

// ---------- the side panels ----------
async function loadToday() {
  try {
    const [{ focus }, { sessions }] = await Promise.all([
      Api.get(`/analytics?today=${App.ymd()}`),
      Api.get('/focus?limit=8'),
    ]);
    const f = focus;
    document.getElementById('today-text').textContent =
      `${App.formatMinutes(f.todayMinutes)} of ${App.formatMinutes(f.dailyGoalMinutes)} goal`;
    document.getElementById('goal-bar').style.width = `${Math.min(100, Math.round((100 * f.todayMinutes) / f.dailyGoalMinutes))}%`;
    document.getElementById('streak-text').textContent =
      f.streak > 0 ? `🔥 ${f.streak}-day streak. Best: ${f.longestStreak}.` : 'Finish one session today to start a streak.';

    const list = document.getElementById('recent');
    list.replaceChildren();
    if (!sessions.length) list.append(App.el('div', { class: 'empty', text: 'No sessions yet. Your first one is a click away.' }));
    for (const s of sessions) {
      list.append(App.el('div', { class: 'list-item' },
        App.el('div', {}, App.el('b', { text: s.taskTitle || 'Free focus' }), App.el('small', { text: App.shortDate(s.date) })),
        App.el('strong', { text: App.formatMinutes(s.minutes) })));
    }
  } catch (err) {
    App.showError(err);
  }
}

async function loadTasks() {
  try {
    const { tasks } = await Api.get('/tasks');
    for (const t of tasks.filter((x) => x.status !== 'done')) {
      els.task.append(App.el('option', { value: t.id, text: t.title }));
    }
  } catch (err) {
    App.showError(err);
  }
}

// ---------- buttons ----------
els.start.addEventListener('click', () => (running() ? pause() : start()));
els.reset.addEventListener('click', () => { setMode(mode); });
els.finish.addEventListener('click', finishEarly);
els.tabs.forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));

// Leaving in the middle of a round? Ask first, the time would be lost.
window.addEventListener('beforeunload', (e) => {
  if (running() && mode === 'focus') e.preventDefault();
});

// ---------- start ----------
(async function init() {
  try {
    ({ settings } = await Api.get('/settings'));
  } catch (err) {
    App.showError(err);
  }
  setMode('focus');
  loadTasks();
  loadToday();
})();
