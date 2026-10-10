// Date, time and wording helpers. Dates from the API are ISO "YYYY-MM-DD".
const d = (iso: string) => new Date(iso.length === 10 ? iso + 'T12:00:00' : iso);

/** "Mon, Oct 19" */
export const dayDate = (iso?: string | null) => (iso ? d(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '');
/** "Oct 19" */
export const shortDate = (iso?: string | null) => (iso ? d(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '');
/** "Monday, October 19" */
export const longDate = (iso?: string | null) => (iso ? d(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : '');
/** "OCT" + "19" for the calendar tile */
export const calParts = (iso: string) => ({ mon: d(iso).toLocaleDateString('en-US', { month: 'short' }).toUpperCase(), day: d(iso).getDate(), wd: d(iso).toLocaleDateString('en-US', { weekday: 'long' }) });

export const todayIso = () => new Date().toISOString().slice(0, 10);

/** "Today", "Tomorrow", "Oct 19" */
export function dueLabel(iso: string) {
  const t = todayIso();
  if (iso === t) return 'Today';
  const tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
  if (iso === tomorrow) return 'Tomorrow';
  return shortDate(iso);
}

/** Overdue in words: "2 days late" */
export function lateLabel(iso: string) {
  const days = Math.round((d(todayIso()).getTime() - d(iso).getTime()) / 864e5);
  return days <= 0 ? '' : days === 1 ? '1 day late' : `${days} days late`;
}

/** Journey-builder day: "Day −7", "Day 0", "Day +3" */
export const dayLabel = (n: number) => (n === 0 ? 'Day 0' : n < 0 ? `Day −${Math.abs(n)}` : `Day +${n}`);

/** 252 → "4:12" */
export const mmss = (sec?: number | null) => (sec == null ? '—' : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`);
/** 252 → "4 min" */
export const mins = (sec?: number | null) => (sec == null ? '' : `${Math.max(1, Math.round(sec / 60))} min`);

export function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export const relTime = (iso: string) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return shortDate(iso);
};

export const TINTS = ['sky', 'butter', 'peach', 'sage'] as const;
export const tintAt = (i: number) => TINTS[i % TINTS.length];
