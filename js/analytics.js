// Analytics (pages/analytics.html). The server does the counting; this file only draws it.

function breakdownRow(label, count, total, cls) {
  const pct = total ? Math.round((100 * count) / total) : 0;
  return App.el('div', { class: 'breakdown-row' },
    App.el('span', { text: label }),
    App.el('div', { class: 'progress-bar' }, App.el('i', { class: cls, style: `width:${pct}%` })),
    App.el('strong', { text: count }));
}

function drawBars(days) {
  const box = document.getElementById('week-bars');
  box.replaceChildren();
  const max = Math.max(...days.map((d) => d.minutes), 1);
  const today = App.ymd();
  for (const d of days) {
    const label = App.parseYmd(d.date).toLocaleDateString('en-US', { weekday: 'short' });
    box.append(App.el('div', { class: 'bar-col', title: `${App.shortDate(d.date)}: ${App.formatMinutes(d.minutes)}` },
      App.el('em', { text: d.minutes ? App.formatMinutes(d.minutes) : '' }),
      App.el('div', { class: `bar${d.date === today ? ' today' : ''}`, style: `height:${Math.round((d.minutes / max) * 150)}px` }),
      App.el('span', { text: label })));
  }
}

(async function start() {
  try {
    const { tasks, focus } = await Api.get(`/analytics?today=${App.ymd()}`);

    document.getElementById('k-total').textContent = App.formatMinutes(focus.totalMinutes);
    document.getElementById('k-total-note').textContent = `${App.formatMinutes(focus.last7Minutes)} in the last 7 days`;
    document.getElementById('k-sessions').textContent = focus.sessions;
    document.getElementById('k-sessions-note').textContent =
      focus.sessions ? `about ${App.formatMinutes(focus.averagePerActiveDay)} per active day` : 'none yet';
    document.getElementById('k-streak').textContent = `${focus.streak} day${focus.streak === 1 ? '' : 's'}`;
    document.getElementById('k-streak-note').textContent = `best: ${focus.longestStreak}`;
    document.getElementById('k-rate').textContent = `${tasks.completionRate}%`;
    document.getElementById('k-rate-note').textContent =
      `${tasks.done} of ${tasks.total}${tasks.overdue ? ` · ${tasks.overdue} overdue` : ''}`;

    drawBars(focus.last7Days);

    const status = document.getElementById('status-rows');
    status.replaceChildren(
      breakdownRow('To Do', tasks.todo, tasks.total, 'todo'),
      breakdownRow('In Progress', tasks.progress, tasks.total, 'progress'),
      breakdownRow('Done', tasks.done, tasks.total, 'done'));

    const priority = document.getElementById('priority-rows');
    priority.replaceChildren(
      breakdownRow('High', tasks.byPriority.high, tasks.total, 'high'),
      breakdownRow('Medium', tasks.byPriority.medium, tasks.total, 'medium'),
      breakdownRow('Low', tasks.byPriority.low, tasks.total, 'low'));
  } catch (err) {
    App.showError(err);
  }
})();
