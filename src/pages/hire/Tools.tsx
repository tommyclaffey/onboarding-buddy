// Tools & access: the gear tracker. One sky hero card follows the laptop (Ordered → Shipped → Delivered → Set up,
// derived from IT's "Ship laptop" task). Then every account IT is setting up, and the connected apps with walkthroughs.
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth';
import { Page } from '../../components/Shell';
import { Arrow, Avatar, Caps, EmojiTile, EmptyState, Hairline, Logo, LogoTile, Pill } from '../../components/ui';
import { dueLabel, longDate, shortDate, todayIso } from '../../lib/format';
import type { AppInfo, Person, Task } from '../../lib/types';
import { useApi } from '../../lib/useApi';
import { MessageLink, addDaysIso } from './Journey';
import '../../styles/hire-discovery.css';

interface ToolsData { it: Task[]; apps: (AppInfo & { task: Task | null })[]; itPerson: Person | null }

/** Accounts IT sets up that may not be connected apps. Names only; logos are the official files. */
const ACCOUNT_APPS: { key: string; name: string; what: string; re: RegExp }[] = [
  { key: 'google', name: 'Google Workspace', what: 'Email, calendar and docs', re: /google/i },
  { key: 'slack', name: 'Slack', what: 'Team chat', re: /slack/i },
  { key: 'figma', name: 'Figma', what: 'Your seat on the team', re: /figma/i },
  { key: 'github', name: 'GitHub', what: 'Code and reviews', re: /github/i },
];

const weekday = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' });

export default function Tools() {
  const { data } = useApi<ToolsData>('/api/tools');
  const { org } = useAuth();
  if (!data) return <main className="panel"><div className="loading">Loading your gear…</div></main>;

  const laptop = data.it.find((t) => /laptop/i.test(t.title)) || null;
  const anyTask = data.it[0] || data.apps.find((a) => a.task)?.task || null;
  const startDate = anyTask ? addDaysIso(anyTask.dueDate, -anyTask.dueDay) : todayIso();
  const today = todayIso();

  // Laptop stepper, derived from the task: not done = being prepared; done = shipped, delivered ~3 days later.
  const shippedOn = laptop?.status === 'done' ? (laptop.doneAt || laptop.dueDate).slice(0, 10) : null;
  const expected = shippedOn ? addDaysIso(shippedOn, 3) : null;
  const delivered = !!expected && today >= expected;
  const setUp = delivered && today > startDate;
  const steps = [
    { label: 'Ordered', date: null as string | null, done: !!shippedOn, planned: false },
    { label: 'Shipped', date: shippedOn || laptop?.dueDate || null, done: !!shippedOn, planned: !shippedOn },
    { label: 'Delivered', date: expected, done: delivered, planned: !delivered },
    { label: 'Set up', date: startDate, done: setUp, planned: !setUp },
  ];
  const currentStep = steps.findIndex((s) => !s.done);
  const caps = !shippedOn ? 'Being prepared' : !delivered ? 'On its way' : setUp ? 'All set' : 'Delivered';
  const headline = !shippedOn ? `ships by ${dueLabel(laptop?.dueDate || startDate)}` : !delivered ? `arrives ${weekday(expected!)}` : setUp ? 'set up and ready' : 'has arrived';

  const accounts = data.it.filter((t) => t !== laptop).flatMap((t): { id: string; task: Task; app: (typeof ACCOUNT_APPS)[number] | null }[] => {
    const hits = ACCOUNT_APPS.filter((a) => a.re.test(t.title));
    return hits.length ? hits.map((a) => ({ id: `${t.id}-${a.key}`, task: t, app: a })) : [{ id: String(t.id), task: t, app: null }];
  });
  const ready = accounts.filter((a) => a.task.status === 'done').length;
  const it = data.itPerson;

  const aside = (
    <>
      {it && (
        <section className="section">
          <Caps>Who’s on it</Caps>
          <div className="row gap-10">
            <Avatar person={it} size={40} />
            <div><p className="t-h-m">{it.name}</p><p className="t-label muted">{it.title} · sets up your laptop and accounts</p></div>
          </div>
          <MessageLink to={it} />
        </section>
      )}
      <Hairline />
      <section className="section">
        <Caps>Good to know</Caps>
        <p className="t-body">Your laptop and accounts belong to {org?.name || 'the company'}. Keep them locked when you step away, and never share passwords.</p>
        <p className="t-body">If anything breaks, tell {it?.first || 'IT'}. Don’t try to fix it yourself.</p>
      </section>
    </>
  );

  return (
    <Page crumbs={[{ label: 'Onboarding' }, { label: 'Tools & access' }]} kicker="Tools & access"
      title={<>Your gear and <em>logins.</em></>}
      lede="Everything you’ll need on Day 1, and where each piece is right now."
      aside={aside}>
      {laptop && (
        <div className="hero-card sky" style={{ color: 'var(--text-primary)' }}>
          <div className="row between"><Caps className="sky">{caps}</Caps>{it && <span className="t-label muted">Sent by {it.first} in IT</span>}</div>
          <div className="row gap-16 mt-16">
            <span className="laptop-tile" aria-hidden>{laptop.emoji || '💻'}</span>
            <div className="grow">
              <h2 className="t-m">Your laptop · {headline}</h2>
              <p className="t-body muted" style={{ marginTop: 4 }}>
                {expected && !delivered ? `${longDate(expected)}, by end of day · ships to your home` : shippedOn ? `Shipped ${shortDate(shippedOn)} · ready for Day 1` : `IT is getting it ready · ships to your home`}
              </p>
            </div>
          </div>
          <ol className="stepper mt-24" style={{ listStyle: 'none', padding: 0, margin: '24px 0 0' }} aria-label="Laptop delivery">
            {steps.map((s, i) => (
              <li key={s.label} className={`step ${s.done ? 'done' : ''} ${i === currentStep ? 'current' : ''}`} aria-current={i === currentStep ? 'step' : undefined}>
                <span className="s-dot" aria-hidden>{s.done && <svg width="9" height="9" viewBox="0 0 12 12" fill="none"><path d="m2.5 6.3 2.3 2.2 4.7-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}</span>
                <span className={`t-label ${i === currentStep ? 'sky strong' : ''}`}>{s.label}{s.done ? <span className="sr-only"> (done)</span> : ''}</span>
                {s.date && <span className={`t-mono ${i === currentStep ? 'sky' : 'muted'}`}>{s.done ? '' : s.planned ? 'By ' : ''}{shortDate(s.date)}</span>}
              </li>
            ))}
          </ol>
        </div>
      )}

      <section className="section">
        <div className="section-head"><Caps>Accounts</Caps><span className="t-mono muted">{ready} of {accounts.length} ready</span></div>
        {accounts.length ? (
          <div className="col">
            {accounts.map(({ id, task, app }) => {
              const done = task.status === 'done';
              const connected = app ? data.apps.find((a) => a.key === app.key) : null;
              return (
                <div key={id} className="acct-row">
                  {app ? <span className="round-logo"><Logo app={app} size={18} /></span> : <EmojiTile emoji={task.emoji || '🔑'} size={36} />}
                  <div className="grow">
                    <p className="t-h-m">{app ? app.name : task.title}</p>
                    <p className="t-label muted">{app ? app.what : task.typeLabel} · {done ? `ready since ${shortDate(task.doneAt)}` : `due ${dueLabel(task.dueDate)}`}</p>
                  </div>
                  <Pill tone={done ? 'success' : 'warning'}>{done ? 'Ready' : 'Being set up'}</Pill>
                  {done && connected && <a className="t-label" href={connected.open} target="_blank" rel="noopener noreferrer">Open<span className="sr-only"> {connected.name}</span> ↗</a>}
                </div>
              );
            })}
          </div>
        ) : <EmptyState emoji="🔑" title="No accounts to set up.">{it?.first || 'IT'} will add anything you need.</EmptyState>}
        <p className="t-label muted">Anything still being set up is due by Day 1, {longDate(startDate)}.</p>
      </section>

      <Hairline />

      <section className="section">
        <div className="section-head"><Caps>Your tools</Caps><span className="t-label muted">Each one has a short walkthrough</span></div>
        <div className="col">
          {data.apps.map((a) => (
            <Link key={a.key} to={`/apps/${a.key}`} className="tool-row">
              <LogoTile app={a} size={40} />
              <div className="grow">
                <p className="t-h-m">{a.name}</p>
                <p className="t-label muted">{a.category}{a.task ? ` · ${a.task.stageName}` : ''}</p>
              </div>
              {a.task && <Pill tone={a.task.status === 'done' ? 'success' : 'sky'}>{a.task.status === 'done' ? '✓ Walkthrough done' : 'Walkthrough'}</Pill>}
              <span className="muted" aria-hidden><Arrow /></span>
            </Link>
          ))}
        </div>
      </section>
    </Page>
  );
}
