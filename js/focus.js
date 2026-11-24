// Focus Room (pages/focus.html): a timer that saves every finished focus session on the server.
//
//   GET  /api/settings           how long a focus / break is, and the daily goal
//   GET  /api/tasks              the tasks you can pick to work on
//   GET  /api/analytics          today's minutes, this week, streak
//   GET  /api/focus              the latest sessions
//   POST /api/focus              {minutes, taskId, date}  when a focus session ends
//   DELETE /api/focus/{id}       remove a session from the history
//
// The timer keeps an END time (not a counter), so it stays right when the tab sleeps,
// and it is saved in this browser, so a refresh does not lose it.

const MODES = {
  focus: { label: 'Focus', key: 'focusMinutes' },
  short: { label: 'Short break', key: 'shortBreakMinutes' },
  long: { label: 'Long break', key: 'longBreakMinutes' },
};
const ROUNDS_BEFORE_LONG_BREAK = 4;

const STATE_KEY = 'dayora_focus_timer';
const PENDING_KEY = 'dayora_focus_pending';      // sessions that could not be sent (server down): sent next time
const SOUND_KEY = 'dayora_focus_sound';

const RING = 2 * Math.PI * 116;                  // length of the circle drawn in focus.html (r = 116)

const $ = (id) => document.getElementById(id);

let settings = { focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15, dailyGoalMinutes: 120 };
let tasks = [];
let recent = [];
let stats = { todayMinutes: 0, last7Minutes: 0, streak: 0 };

// the timer: "totalMs" is the length of this timer, "remainingMs" what was left when it was last paused
let timer = { mode: 'focus', totalMs: 0, remainingMs: 0, endsAt: 0, running: false, taskId: null, round: 0 };
let finishing = false;
let soundOn = localStorage.getItem(SOUND_KEY) !== 'off';
let audio = null;

const lengthOf = (mode) => settings[MODES[mode].key] * 60000;
const remaining = () => (timer.running ? Math.max(0, timer.endsAt - Date.now()) : timer.remainingMs);
const elapsed = () => timer.totalMs - remaining();
const untouched = () => !timer.running && timer.remainingMs === timer.totalMs;

// ---------- keeping the timer across a refresh ----------
function saveState() {
  localStorage.setItem(STATE_KEY, JSON.stringify({ ...timer, day: UI.ymd() }));
}

function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(STATE_KEY));
    if (!s || !MODES[s.mode] || !(s.totalMs > 0)) return;
    timer = {
      mode: s.mode, totalMs: s.totalMs, remainingMs: s.remainingMs, endsAt: s.endsAt || 0,
      running: !!s.running, taskId: s.taskId ?? null,
      round: s.day === UI.ymd() ? s.round || 0 : 0,            // a new day starts a new round
    };
  } catch { /* nothing saved, or damaged: start fresh */ }
}

// ---------- sound ----------
function chime() {
  if (!soundOn) return;
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    const now = audio.currentTime;
    [[659.25, 0], [880, 0.22], [1318.5, 0.44]].forEach(([freq, delay]) => {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.18, now + delay + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.9);
      osc.connect(gain).connect(audio.destination);
      osc.start(now + delay);
      osc.stop(now + delay + 1);
    });
  } catch { /* no audio on this device: the message on screen is enough */ }
}

function paintSound() {
  const btn = $('sound-btn');
  btn.setAttribute('aria-pressed', soundOn);
  btn.querySelector('i').className = soundOn ? 'fa-solid fa-volume-high' : 'fa-solid fa-volume-xmark';
  btn.querySelector('span').textContent = soundOn ? 'Sound on' : 'Sound off';
}

$('sound-btn').addEventListener('click', () => {
  soundOn = !soundOn;
  localStorage.setItem(SOUND_KEY, soundOn ? 'on' : 'off');
  paintSound();
  if (soundOn) chime();                                      // so you hear what it sounds like
});

// ---------- drawing the timer ----------
const pad2 = (n) => String(n).padStart(2, '0');

function clock(ms) {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  return m >= 100 ? `${m}:${pad2(total % 60)}` : `${pad2(m)}:${pad2(total % 60)}`;
}

function statusText() {
  if (timer.running) return timer.mode === 'focus' ? 'Stay with it' : 'Take a breather';
  if (!untouched()) return 'Paused';
  if (timer.mode === 'focus') return 'Ready when you are';
  return timer.mode === 'short' ? 'Short break' : 'Long break, you earned it';
}

function renderTimer() {
  const left = remaining();
  const text = clock(left);
  $('time').textContent = text;
  $('status').textContent = statusText();
  $('ring-bar').style.strokeDashoffset = RING * (1 - (timer.totalMs ? left / timer.totalMs : 1));
  document.title = timer.running ? `${text} · ${MODES[timer.mode].label} - Dayora` : 'Dayora - Focus Room';

  $('timer-card').dataset.mode = timer.mode;
  document.querySelectorAll('.fr-mode').forEach((b) => b.setAttribute('aria-selected', b.dataset.mode === timer.mode));

  const label = timer.running ? 'Pause' : untouched() ? 'Start' : 'Resume';
  $('start-btn').querySelector('span').textContent = label;
  $('start-btn').querySelector('i').className = timer.running ? 'fa-solid fa-pause' : 'fa-solid fa-play';
  $('reset-btn').disabled = untouched();
  $('save-btn').hidden = !(timer.mode === 'focus' && elapsed() >= 60000);
  $('task-select').disabled = timer.mode === 'focus' && !untouched();   // the task cannot change in the middle of a session
}

function renderRounds() {
  const box = $('rounds');
  const done = timer.mode === 'long' && timer.round === 0 ? ROUNDS_BEFORE_LONG_BREAK : timer.round;
  box.replaceChildren(...Array.from({ length: ROUNDS_BEFORE_LONG_BREAK }, (_, i) =>
    UI.el('span', { class: `fr-dot${i < done ? ' on' : ''}` })));
  box.title = `${timer.round} of ${ROUNDS_BEFORE_LONG_BREAK} focus sessions before the long break`;
}

// ---------- the controls ----------
function setMode(mode, { keepRound = true } = {}) {
  timer.mode = mode;
  timer.running = false;
  timer.totalMs = timer.remainingMs = lengthOf(mode);
  timer.endsAt = 0;
  if (!keepRound) timer.round = 0;
  saveState();
  renderTimer();
  renderRounds();
}

function startOrPause() {
  if (timer.running) {
    timer.remainingMs = remaining();
    timer.running = false;
  } else {
    if (timer.remainingMs <= 0) timer.remainingMs = timer.totalMs;
    timer.endsAt = Date.now() + timer.remainingMs;
    timer.running = true;
    try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); audio.resume?.(); } catch { /* no audio */ }
  }
  saveState();
  renderTimer();
}

function reset() {
  timer.running = false;
  timer.remainingMs = timer.totalMs;
  timer.endsAt = 0;
  saveState();
  renderTimer();
}

async function switchMode(mode) {
  if (mode === timer.mode) return;
  if (!untouched() && !(await UI.confirm('The time on the clock will be reset.', { yes: 'Switch', title: 'Switch timer?' }))) return;
  setMode(mode);
}

async function skip() {
  if (!untouched() && !(await UI.confirm('This session will not be saved.', { yes: 'Skip', title: 'Skip to the next timer?' }))) return;
  if (timer.mode === 'focus') setMode(timer.round >= ROUNDS_BEFORE_LONG_BREAK ? 'long' : 'short');
  else setMode('focus', { keepRound: timer.mode === 'short' });
}

/** Stop a focus session early and keep the whole minutes already done. */
async function stopAndSave() {
  const minutes = Math.floor(elapsed() / 60000);
  if (minutes < 1) return;
  timer.running = false;
  const taskId = timer.taskId;
  setMode('focus');
  await logFocus(minutes, taskId, UI.ymd());
  UI.toast(`Saved ${minutes} min of focus`);
  await loadStats();
}

// ---------- a timer reached zero ----------
async function finish() {
  if (finishing) return;
  finishing = true;
  const finishedMode = timer.mode;
  const minutes = Math.round(timer.totalMs / 60000);
  const taskId = timer.taskId;
  const endedAt = timer.endsAt ? new Date(timer.endsAt) : new Date();
  timer.running = false;
  chime();

  if (finishedMode === 'focus') {
    timer.round += 1;
    const next = timer.round >= ROUNDS_BEFORE_LONG_BREAK ? 'long' : 'short';
    setMode(next);
    UI.toast(`Well done! ${minutes} min of focus saved. Time for a ${next === 'long' ? 'long' : 'short'} break.`);
    await logFocus(minutes, taskId, UI.ymd(endedAt));
    await loadStats();
  } else {
    if (finishedMode === 'long') timer.round = 0;
    setMode('focus');
    UI.toast('Break is over. Ready for the next one?');
  }
  finishing = false;
}

setInterval(() => {
  if (!timer.running) return;
  renderTimer();
  if (remaining() <= 0) finish();
}, 250);

// ---------- saving a session (and not losing it when the server is away) ----------
function readPending() {
  try { return JSON.parse(localStorage.getItem(PENDING_KEY)) || []; } catch { return []; }
}

async function logFocus(minutes, taskId, date) {
  const body = { minutes, date, ...(taskId ? { taskId } : {}) };
  try {
    await Api.post('/focus', body);
  } catch (err) {
    if (err.status === 0 || err.status >= 500) {
      localStorage.setItem(PENDING_KEY, JSON.stringify([...readPending(), body]));
      UI.toast('The server is not answering. Your session is kept and will be saved next time.', 'error');
    } else if (taskId && err.fields?.taskId) {
      await logFocus(minutes, null, date);          // the task was deleted meanwhile: keep the minutes anyway
    } else {
      UI.toast(err.message, 'error');
    }
  }
}

async function sendPending() {
  const waiting = readPending();
  if (!waiting.length) return;
  localStorage.removeItem(PENDING_KEY);
  for (const body of waiting) await logFocus(body.minutes, body.taskId, body.date);
}

// ---------- the numbers and the history ----------
function dayLabel(date) {
  if (date === UI.ymd()) return 'Today';
  if (date === UI.ymd(UI.addDays(new Date(), -1))) return 'Yesterday';
  return Dates.short(date);
}

function renderStats() {
  const goal = settings.dailyGoalMinutes;
  const today = stats.todayMinutes;
  const percent = Math.min(100, Math.round((today / goal) * 100));
  $('today-min').textContent = `${today} min`;
  $('today-goal').textContent = `of ${goal} min`;
  $('goal-fill').style.width = `${percent}%`;
  $('goal-bar').setAttribute('aria-valuenow', percent);
  $('goal-note').textContent = today === 0 ? 'Your first session is waiting.'
    : today >= goal ? 'Goal reached. Well done!'
    : `${goal - today} min to go`;
  $('today-count').textContent = recent.filter((s) => s.date === UI.ymd()).length;
  $('week-min').textContent = stats.last7Minutes;
  $('best-streak').textContent = stats.streak;
}

function renderRecent() {
  const list = $('recent-list');
  if (!recent.length) {
    list.replaceChildren(UI.el('li', { class: 'fr-empty' }, 'No sessions yet. Finish a focus timer and it shows up here.'));
    return;
  }
  list.replaceChildren(...recent.slice(0, 8).map((s) => UI.el('li', { class: 'fr-item' },
    UI.el('span', { class: 'fr-item_icon' }, UI.el('i', { class: 'fa-solid fa-bullseye' })),
    UI.el('div', { class: 'fr-item_text' },
      UI.el('strong', { text: s.taskTitle || 'Focus session' }),
      UI.el('small', { text: `${dayLabel(s.date)} · ${s.minutes} min` })),
    UI.el('button', {
      class: 'icon-btn', type: 'button', title: 'Remove', 'aria-label': `Remove the ${s.minutes} minute session`,
      onclick: () => removeSession(s),
    }, UI.el('i', { class: 'fa-regular fa-trash-can' })))));
}

async function removeSession(s) {
  if (!(await UI.confirm(`The ${s.minutes} minute session will be removed from your history.`, { title: 'Remove session?' }))) return;
  try {
    await Api.del(`/focus/${s.id}`);
    UI.toast('Session removed');
    await loadStats();
  } catch (err) {
    UI.toast(err.message, 'error');
  }
}

async function loadStats() {
  try {
    const [{ focus }, { sessions }] = await Promise.all([Api.get(`/analytics?today=${UI.ymd()}`), Api.get('/focus?limit=100')]);
    stats = { todayMinutes: focus.todayMinutes, last7Minutes: focus.last7Minutes, streak: focus.streak };
    recent = sessions;
  } catch (err) {
    UI.toast(err.message, 'error');
  }
  renderStats();
  renderRecent();
}

// ---------- the task picker ----------
function renderTasks() {
  const select = $('task-select');
  const open = tasks.filter((t) => t.status !== 'done');
  select.replaceChildren(
    UI.el('option', { value: '', text: 'No task, just focus' }),
    ...open.map((t) => UI.el('option', { value: t.id, text: t.title })));
  if (timer.taskId && !open.some((t) => t.id === timer.taskId)) timer.taskId = null;
  select.value = timer.taskId ?? '';
}

$('task-select').addEventListener('change', (e) => {
  timer.taskId = e.target.value ? Number(e.target.value) : null;
  saveState();
});

// ---------- buttons and keys ----------
$('start-btn').addEventListener('click', startOrPause);
$('reset-btn').addEventListener('click', reset);
$('skip-btn').addEventListener('click', skip);
$('save-btn').addEventListener('click', stopAndSave);
document.querySelectorAll('.fr-mode').forEach((b) => b.addEventListener('click', () => switchMode(b.dataset.mode)));

document.addEventListener('keydown', (e) => {
  if (e.code !== 'Space' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target.closest?.('input, select, textarea, button, a, dialog')) return;
  e.preventDefault();
  startOrPause();
});

// the timer is the same in two tabs: follow the other one
window.addEventListener('storage', (e) => {
  if (e.key !== STATE_KEY) return;
  loadState();
  renderTasks();
  renderTimer();
  renderRounds();
});

// ---------- start ----------
async function start() {
  if (!Store.getToken()) return;                    // session.js is already sending the visitor to the login page
  paintSound();
  loadState();
  if (!timer.totalMs) setMode('focus');             // nothing saved yet: a fresh timer with the default length
  renderTimer();
  renderRounds();
  renderStats();
  renderRecent();

  try {
    ({ settings } = await Api.get('/settings'));
  } catch (err) {
    UI.toast(err.message, 'error');
  }
  if (untouched()) {                                // a timer nobody started follows the lengths from Settings
    timer.totalMs = timer.remainingMs = lengthOf(timer.mode);
    saveState();
  }

  try {
    ({ tasks } = await Api.get('/tasks'));
  } catch { /* the picker just stays "No task" */ }
  renderTasks();

  await sendPending();
  await loadStats();

  // the timer ran out while the page was closed: it still counts
  if (timer.running && remaining() <= 0) finish();
  renderTimer();
}

start();
