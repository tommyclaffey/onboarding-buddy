// Small helpers shared by the People Ops and owner screens. Page-local, so shared components stay untouched.
import type { ReactNode, SelectHTMLAttributes } from 'react';
import { dayDate, todayIso } from '../../lib/format';
import type { AppInfo } from '../../lib/types';
import '../../styles/admin.css';

export const FEELINGS = ['😬', '🤔', '😐', '🙂', '🤩'];
export const FEELING_WORDS = ['Nervous', 'Unsure', 'Okay', 'Good', 'Excited'];

/** Server status tone → Pill tone. "neutral" is the plain pill. */
export const pillTone = (tone?: string) => (tone === 'success' || tone === 'danger' || tone === 'warning' || tone === 'sky' ? tone : undefined);

/** Replace raw ISO dates inside server-written text: "due 2026-10-10" → "due Sat, Oct 10". */
export const humanDates = (s: string) => s.replace(/\d{4}-\d{2}-\d{2}/g, (m) => (m === todayIso() ? 'today' : dayDate(m)));

// Numerals, never number words (Tommy’s rule).
export const countWord = (n: number) => (n === 0 ? 'No one' : String(n));

/** 3018 → "50 min", 6720 → "1 h 52 min" */
export const lengthLabel = (sec: number) => {
  const m = Math.round(sec / 60);
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
};

/** Days from today (local) to an ISO date. Negative = in the past. */
export const daysFromToday = (iso: string) => {
  const t = new Date(); t.setHours(12, 0, 0, 0);
  return Math.round((new Date(iso + 'T12:00:00').getTime() - t.getTime()) / 864e5);
};

/** The app catalogue as the client needs it (mirrors server/catalog.mjs). */
export const CATALOG: Record<string, AppInfo> = {
  slack: { key: 'slack', name: 'Slack', category: 'Team chat', tint: 'peach', icons: ['💬', '🧵', '🔔'], open: 'https://slack.com' },
  notion: { key: 'notion', name: 'Notion', category: 'Wiki and docs', tint: 'butter', icons: ['🔎', '📄', '🗂️'], open: 'https://notion.so' },
  linear: { key: 'linear', name: 'Linear', category: 'Projects and issues', tint: 'sky', icons: ['🎯', '🗓️', '🏷️'], open: 'https://linear.app' },
  figma: { key: 'figma', name: 'Figma', category: 'Design files', tint: 'sage', icons: ['🎨', '🧩', '💬'], open: 'https://figma.com' },
  github: { key: 'github', name: 'GitHub', category: 'Code and reviews', tint: 'sky', icons: ['🔀', '👀', '✅'], open: 'https://github.com' },
  google: { key: 'google', name: 'Google Workspace', category: 'Email, calendar, docs', tint: 'butter', icons: ['📧', '📅', '📝'], open: 'https://workspace.google.com' },
};

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { label: string; error?: string | null; children: ReactNode; className?: string };
/** A labelled select that matches TextField. */
export function SelectField({ label, error, id, children, className = '', ...rest }: SelectProps) {
  const fid = id || 's-' + label.toLowerCase().replace(/\W+/g, '-');
  return (
    <div className={`ad-select ${error ? 'error' : ''} ${className}`}>
      {label && <label htmlFor={fid}>{label}</label>}
      <select id={fid} aria-invalid={!!error} aria-describedby={error ? fid + '-h' : undefined} {...rest}>{children}</select>
      {error && <span className="help" id={fid + '-h'}>{error}</span>}
    </div>
  );
}

export const Chevron = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden><path d="m6 3.5 4.5 4.5L6 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
export const ChevronDown = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden><path d="M3.5 6 8 10.5 12.5 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

/** The "ⓘ" note line used under tables. */
export const Note = ({ children }: { children: ReactNode }) => <p className="ad-note"><span className="i" aria-hidden>i</span><span>{children}</span></p>;
