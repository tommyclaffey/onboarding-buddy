// App shell: role-aware sidebar, the page panel (breadcrumb, header, body + aside), and the Ask Buddy bar.
import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { useApi } from '../lib/useApi';
import { Avatar, Smiley } from './ui';
import { Icon } from './Icons';
import { shortDate } from '../lib/format';

type Nav = { unread: number; paperwork?: { done: number; total: number }; training?: { done: number; total: number }; tools?: { done: number; total: number }; hires?: number; videosNeedingWork?: number; open?: number };

function Item({ to, icon, label, count, end }: { to: string; icon: ReactNode; label: string; count?: ReactNode; end?: boolean }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
      <span className="icon" aria-hidden>{icon}</span>
      <span>{label}</span>
      {count != null && count !== '' && <span className="count">{count}</span>}
    </NavLink>
  );
}

const frac = (f?: { done: number; total: number }) => (f ? `${f.done}/${f.total}` : '');

export function Sidebar() {
  const { user, org, logout } = useAuth();
  const nav = useApi<Nav>('/api/nav');
  const loc = useLocation();
  const navigate = useNavigate();
  useEffect(() => { nav.reload(); }, [loc.pathname]); // keep counts fresh
  useEffect(() => { const on = () => nav.reload(); window.addEventListener('ob:data', on); return () => window.removeEventListener('ob:data', on); }, [nav.reload]);
  const n = nav.data;
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [loc.pathname]);
  if (!user) return null;
  return (
    <>
    <header className="mobile-bar">
      <div className="row gap-10"><Smiley size={28} /><b>Onboarding Buddy</b></div>
      <button className="menu-btn" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} onClick={() => setOpen(!open)}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>{open ? <path d="M5 5l10 10M15 5 5 15" /> : <path d="M3 6h14M3 10h14M3 14h14" />}</svg>
      </button>
    </header>
    {open && <div className="scrim-backdrop" onClick={() => setOpen(false)} aria-hidden />}
    <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="Main">
      <div className="workspace">
        <Smiley size={30} />
        <div><b>Onboarding Buddy</b><small>{org?.name}{user.role === 'admin' ? ' · Admin' : ''}</small></div>
      </div>
      {user.role === 'hire' && (
        <>
          <Item to="/today" icon={<Icon.today />} label="Today" />
          <Item to="/journey" icon={<Icon.journey />} label="My journey" />
          <Item to="/inbox" icon={<Icon.inbox />} label="Inbox" count={n?.unread || ''} />
          <p className="t-caps nav-label">Onboarding</p>
          <Item to="/paperwork" icon={<Icon.paperwork />} label="Paperwork" count={frac(n?.paperwork)} />
          <Item to="/training" icon={<Icon.training />} label="Training" count={frac(n?.training)} />
          <Item to="/tools" icon={<Icon.tools />} label="Tools & access" count={frac(n?.tools)} />
          <p className="t-caps nav-label">{org?.name}</p>
          <Item to="/people" icon={<Icon.people />} label="Your people" />
        </>
      )}
      {user.role === 'admin' && (
        <>
          <Item to="/admin" end icon={<Icon.home />} label="Overview" />
          <Item to="/admin/journeys/1" icon={<Icon.journey />} label="Journeys" />
          <Item to="/admin/videos" icon={<Icon.video />} label="Video library" count={n?.videosNeedingWork || ''} />
          <Item to="/admin/apps" icon={<Icon.plug />} label="Connected apps" />
          <Item to="/tasks" icon={<Icon.check />} label="My tasks" />
          <Item to="/inbox" icon={<Icon.inbox />} label="Inbox" count={n?.unread || ''} />
        </>
      )}
      {user.role === 'member' && (
        <>
          <Item to="/tasks" icon={<Icon.check />} label="My tasks" count={n?.open || ''} />
          <Item to="/inbox" icon={<Icon.inbox />} label="Inbox" count={n?.unread || ''} />
        </>
      )}
      <div className="profile">
        <Avatar person={user} size={32} />
        <div className="grow">
          <Link to="/account" style={{ color: 'inherit' }}><b>{user.name}</b></Link>
          <small>{user.role === 'hire' && user.startDate ? `Starts ${shortDate(user.startDate)}` : user.title}</small>
        </div>
        <button className="link-btn" onClick={async () => { await logout(); navigate('/login'); }} title="Sign out">Sign out</button>
      </div>
    </aside>
    </>
  );
}

export interface Crumb { label: string; to?: string }

/** One screen. Header (kicker, serif title, lede) + body (main column + optional 300px aside). */
export function Page({ crumbs, kicker, title, lede, aside, children, admin, glow = ['#FFF1B8', '#DDEBFF'], wide }: {
  crumbs: Crumb[]; kicker?: ReactNode; title: ReactNode; lede?: ReactNode; aside?: ReactNode; children: ReactNode; admin?: boolean; glow?: [string, string]; wide?: boolean;
}) {
  useEffect(() => {
    const plain = typeof title === 'string' ? title : crumbs[crumbs.length - 1]?.label;
    document.title = `${plain} · Onboarding Buddy`;
  }, [title, crumbs]);
  return (
    <main className="panel">
      <span className="glow" style={{ width: 520, height: 520, right: -120, top: -260, background: glow[0] }} aria-hidden />
      <span className="glow" style={{ width: 380, height: 380, right: -160, top: -40, background: glow[1] }} aria-hidden />
      <div className="topbar">
        <nav className="crumbs" aria-label="Breadcrumb">
          {crumbs.map((c, i) => (
            <span key={i} className="row gap-8">
              {i > 0 && <span aria-hidden>/</span>}
              {c.to ? <Link to={c.to}>{c.label}</Link> : <span>{c.label}</span>}
            </span>
          ))}
        </nav>
      </div>
      <header className="page-head">
        {kicker && <p className="t-caps">{kicker}</p>}
        <h1 className="t-hero">{title}</h1>
        {lede && <p className="t-body-l lede">{lede}</p>}
      </header>
      <div className={`page-body ${admin ? 'admin' : ''}`}>
        <div className="main-col" style={wide ? { maxWidth: 'none' } : undefined}>{children}</div>
        {aside && <aside className="aside">{aside}</aside>}
      </div>
    </main>
  );
}

const FAQ: [RegExp, string][] = [
  [/w-?4|tax/i, 'A W-4 tells payroll how much federal tax to hold back from each paycheck. Yours takes about 4 more minutes, and only you and People Ops can see it.'],
  [/park|office|address/i, 'Brightside is remote-first. If you visit the office, there’s free parking in the garage on 5th; ask Sam for the door code.'],
  [/team|who/i, 'You’re joining the Design team: Jordan is your manager and Sam is your buddy. See everyone on Your people.'],
  [/laptop|gear|computer/i, 'Your laptop ships before Day One. Track it on Tools & access; Dev in IT can help if anything’s missing.'],
  [/slack|notion|linear|app/i, 'Each tool has its own walkthrough with short videos and 3 things to try. You’ll find them in Training.'],
];

/** Ask Buddy: a pinned bar. This build answers from a small set of company FAQs; anything else points to People Ops. */
export function AskBuddy() {
  const [q, setQ] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') { e.preventDefault(); document.getElementById('ask')?.focus(); }
      if (e.key === 'Escape') setAnswer(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const ask = (text: string) => {
    const hit = FAQ.find(([re]) => re.test(text));
    setAnswer(hit ? hit[1] : 'I don’t know that one yet. Priya in People Ops can help: message her from Your people.');
  };
  return (
    <>
      {answer && (
        <div className="ask-panel" role="dialog" aria-label="Buddy’s answer">
          <div className="row top gap-12"><Smiley size={28} /><p className="t-body grow">{answer}</p>
            <button className="link-btn" onClick={() => setAnswer(null)}>Close</button></div>
          <div className="row wrap gap-8">{['What’s a W-4?', 'Who’s on my team?', 'When does my laptop arrive?'].map((s) => <button key={s} className="chip" onClick={() => { setQ(s); ask(s); }}>{s}</button>)}</div>
        </div>
      )}
      <form className="ask-bar" onSubmit={(e) => { e.preventDefault(); if (q.trim()) ask(q); }} role="search">
        <Smiley size={36} />
        <label className="sr-only" htmlFor="ask">Ask Buddy</label>
        <input id="ask" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask Buddy anything…" onFocus={() => !answer && setAnswer(null)} />
        <span className="kbd">⌘J</span>
        <button className="send" aria-label="Ask"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
      </form>
    </>
  );
}
