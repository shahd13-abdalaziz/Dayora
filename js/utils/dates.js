// Date and time helpers for the pages that talk to the server (Tasks, Planner).
// The server sends dates as "2026-10-19" and hours as numbers (13 = 1 PM, 9.5 = 9:30 AM).

const Dates = {
  /** "2026-10-19" -> a Date at local midnight. */
  parse(s) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  },

  /** "2026-04-20" -> "Apr 20" */
  short(s) {
    return s ? this.parse(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'No date';
  },

  /** 13 -> "1:00 PM", 9.5 -> "9:30 AM" */
  hour(h) {
    const hour = Math.floor(h);
    const minutes = Math.round((h - hour) * 60);
    const suffix = hour >= 12 && hour < 24 ? 'PM' : 'AM';
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
    return `${hour12}:${String(minutes).padStart(2, '0')} ${suffix}`;
  },

  /** "Shahd Tester" -> "ST" */
  initials(name = '') {
    return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
  },
};
