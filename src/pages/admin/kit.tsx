// Small helpers shared by the People Ops and owner screens. Page-local, so shared components stay untouched.
import { useState, type ReactNode, type SelectHTMLAttributes } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button } from '../../components/ui';
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

/** What the server says after creating or resending an invite. `link` only comes back when the email didn't go out. */
export interface InviteResult { sent: boolean; via: string | null; error: string | null; link?: string; expiresAt: string }
const VIA_NAME: Record<string, string> = { google: 'your Google Workspace address', microsoft: 'your Microsoft 365 address', smtp: 'your company email', app: 'Onboarding Buddy' };

/** Sent → success line. Not sent → the reason, plus the link to copy and a pointer to Settings → Email. */
export function InviteOutcome({ first, email, invite }: { first: string; email: string; invite: InviteResult }) {
  const [copied, setCopied] = useState(false);
  if (invite.sent) {
    return <Alert tone="success" title={`${first}’s invite is on its way.`}>We emailed {email} from {VIA_NAME[invite.via || ''] || 'your email'}. The link works for 14 days.</Alert>;
  }
  const copy = async () => { try { await navigator.clipboard.writeText(invite.link || ''); setCopied(true); } catch { /* select-all fallback below */ } };
  return (
    <Alert tone="warning" title={`${first}’s account is ready, but no email went out.`}>
      <span className="col gap-8" style={{ display: 'flex' }}>
        <span>{invite.error} Send {first} this link yourself. It works for 14 days and only once.</span>
        <span className="row gap-8" style={{ flexWrap: 'wrap' }}>
          <span className="ad-secret" style={{ overflowWrap: 'anywhere', fontSize: 13 }}>{invite.link}</span>
          <Button size="sm" variant="outline" type="button" onClick={copy}>{copied ? '✓ Copied' : 'Copy link'}</Button>
        </span>
        <span>To send invites automatically, <Link to="/admin/settings/email">connect your email</Link>.</span>
      </span>
    </Alert>
  );
}
