// Dashboard (pages/dashboard.html): one request, then draw.

function greetingFor(hour) {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

(async function start() {
  document.getElementById('today-date').textContent =
    new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  try {
    const data = await Api.get(`/dashboard?today=${App.ymd()}`);

    const first = data.user.name.split(' ')[0];
    document.getElementById('greeting').textContent = `${greetingFor(new Date().getHours())}, ${first}`;

    document.getElementById('s-open').textContent = data.counts.open;
    document.getElementById('s-due').textContent = data.counts.dueToday;
    document.getElementById('s-focus').textContent = App.formatMinutes(data.focus.todayMinutes);
    document.getElementById('s-streak').textContent = `${data.focus.streak} day${data.focus.streak === 1 ? '' : 's'}`;

    const { todayMinutes, dailyGoalMinutes } = data.focus;
    document.getElementById('goal-text').textContent =
      `${App.formatMinutes(todayMinutes)} of ${App.formatMinutes(dailyGoalMinutes)}` +
      (todayMinutes >= dailyGoalMinutes ? ' · goal reached 🎉' : '');
    document.getElementById('goal-bar').style.width = `${Math.min(100, Math.round((100 * todayMinutes) / dailyGoalMinutes))}%`;

    const upcoming = document.getElementById('upcoming');
    upcoming.replaceChildren();
    if (!data.upcomingTasks.length) upcoming.append(App.el('div', { class: 'empty', text: 'No open tasks. Enjoy the calm, or add one.' }));
    for (const t of data.upcomingTasks) {
      const late = t.dueDate && t.dueDate < App.ymd();
      upcoming.append(App.el('div', { class: 'list-item' },
        App.el('div', {}, App.el('b', { text: t.title }),
          App.el('small', { text: late ? `${App.shortDate(t.dueDate)} · overdue` : App.shortDate(t.dueDate) })),
        App.el('span', { class: `pill ${t.priority}`, text: t.priority })));
    }

    const today = document.getElementById('today-sessions');
    today.replaceChildren();
    if (!data.todaySessions.length) today.append(App.el('div', { class: 'empty', text: 'Nothing planned for today.' }));
    for (const s of data.todaySessions) {
      today.append(App.el('div', { class: 'list-item' },
        App.el('div', {}, App.el('b', { text: s.title }),
          App.el('small', { text: `${App.formatHour(s.startHour)} – ${App.formatHour(s.endHour)}` })),
        App.el('span', { class: 'pill low', text: s.type })));
    }
  } catch (err) {
    App.showError(err);
  }
})();
