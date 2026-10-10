// My tasks: everything the signed-in owner (People Ops, IT, manager, buddy) owns on other people's journeys.
// One yellow hero only when something is overdue or due today; otherwise groups per new hire.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../../api';
import { useAuth } from '../../auth';
import { Page } from '../../components/Shell';
import { TaskRowCompact } from '../../components/Rows';
import { Alert, Avatar, Button, Caps, Choice, EmptyState, Hairline, useToast } from '../../components/ui';
import { dayDate, lateLabel, longDate, todayIso } from '../../lib/format';
import type { Person, Task } from '../../lib/types';
import { useApi } from '../../lib/useApi';
import '../../styles/admin.css';

interface MyTasksData {
  me: Person & { duty?: string | null };
  counts: { open: number; overdue: number; dueToday: number; done: number };
  groups: { hire: Person & { startDate: string }; tasks: Task[] }[];
}

const DUTY: Record<string, string> = { people_ops: 'People Ops', it: 'IT' };
const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;

export default function MyTasks() {
  const { data, reload } = useApi<MyTasksData>('/api/my-tasks');
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [err, setErr] = useState<string | null>(null);
  const [checkin, setCheckin] = useState<{ task: Task; hire: Person } | null>(null);
  const [rating, setRating] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [ratingErr, setRatingErr] = useState(false);
  if (!data) return <main className="panel"><div className="loading">Loading your tasks…</div></main>;
  const isAdmin = user?.role === 'admin';

  const isCheckin = (t: Task) => t.type === 'meeting' && /check-in|review/i.test(t.title) && t.ownerRole === 'manager';
  const hireOf = (t: Task) => data.groups.find((g) => g.tasks.some((x) => x.id === t.id))?.hire;
  const toggle = async (t: Task, done: boolean) => {
    setErr(null);
    if (done && isCheckin(t)) { setCheckin({ task: t, hire: hireOf(t)! }); setRating(null); setNotes(''); setRatingErr(false); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    try {
      await api.post(`/api/tasks/${t.id}/${done ? 'complete' : 'undo'}`);
      await reload();
      if (done) toast(`${t.title}: done.`, { label: 'Undo', run: async () => { await api.post(`/api/tasks/${t.id}/undo`); reload(); } });
      else toast(`${t.title} is open again.`);
    } catch (e) {
      setErr((e as ApiError).message);
    }
  };

  const saveCheckin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkin) return;
    if (!rating) { setRatingErr(true); return; }
    try {
      await api.post(`/api/tasks/${checkin.task.id}/complete`, { data: { rating, notes: notes.trim() } });
      toast(`${checkin.task.title} saved. ${checkin.hire.first}’s page shows it to People Ops.`);
      setCheckin(null);
      await reload();
    } catch (x) {
      setErr((x as ApiError).message);
    }
  };
  const RATINGS = [
    { value: 'on_track', title: 'On track', desc: 'Settling in well. Keep doing what you’re doing.' },
    { value: 'support', title: 'Needs a bit of support', desc: 'A few things to work on together.' },
    { value: 'struggling', title: 'Struggling', desc: 'People Ops will reach out to help.' },
  ];

  const { counts, groups } = data;
  const urgent = groups.flatMap((g) => g.tasks.filter((t) => t.overdue || t.dueToday).map((t) => ({ t, hire: g.hire })))
    .sort((a, b) => a.t.dueDate.localeCompare(b.t.dueDate));
  const hiresWithOpen = groups.filter((g) => g.tasks.some((t) => t.status !== 'done')).length;
  const lede = counts.open
    ? `${plural(counts.open, 'open task')} across ${plural(hiresWithOpen, 'new hire')}. ${counts.dueToday ? `${counts.dueToday} due today` : 'Nothing due today'}, ${counts.overdue ? `${counts.overdue} overdue` : 'none overdue'}.`
    : 'Nothing open right now.';
  const role = data.me.duty ? DUTY[data.me.duty] : null;

  const aside = groups.length ? (
    <>
      <div className="section">
        <Caps>At a glance</Caps>
        <div className="row"><span className="ad-dot sky" aria-hidden /><span className="t-body grow">Open</span><span className="ad-stat">{counts.open}</span></div>
        <div className="row"><span className="ad-dot gold" aria-hidden /><span className="t-body grow">Due today</span><span className="ad-stat">{counts.dueToday}</span></div>
        <div className="row"><span className="ad-dot" aria-hidden style={counts.overdue ? { borderColor: 'var(--text-danger)' } : undefined} /><span className="t-body grow">Overdue</span><span className={`ad-stat ${counts.overdue ? 'danger' : ''}`}>{counts.overdue}</span></div>
        <div className="row"><span className="ad-dot ok" aria-hidden /><span className="t-body grow">Done</span><span className="ad-stat">{counts.done}</span></div>
      </div>
      <Hairline />
      <div className="section">
        <Caps>How this works</Caps>
        <p className="t-body">Every task on a new hire’s journey has one owner. These are yours. When you tick one, the new hire’s progress updates straight away.</p>
      </div>
    </>
  ) : undefined;

  return (
    <Page admin crumbs={[{ label: 'My tasks' }]} kicker={`${role ? `${role} · ` : ''}${longDate(todayIso())}`}
      title={<>{data.me.first}, here’s <em>what’s yours.</em></>} lede={lede} aside={aside}>
      {checkin && (
        <form className="hero-card col gap-14" onSubmit={saveCheckin} noValidate>
          <div className="row gap-12"><Avatar person={checkin.hire} size={40} /><div><Caps className="gold">{checkin.task.title}</Caps><h2 className="t-m">How is {checkin.hire.first} doing?</h2></div></div>
          {ratingErr && <Alert tone="error" title="Pick one to save the check-in.">It helps People Ops know who might need a hand.</Alert>}
          <div className="choices" role="radiogroup" aria-label={`How is ${checkin.hire.first} doing?`}>
            {RATINGS.map((r) => <Choice key={r.value} title={r.title} desc={r.desc} checked={rating === r.value} error={ratingErr} onSelect={() => { setRating(r.value); setRatingErr(false); }} />)}
          </div>
          <div className="field"><label htmlFor="ci-notes">Notes (optional)</label><textarea id="ci-notes" rows={3} value={notes} maxLength={1000} onChange={(e) => setNotes(e.target.value)} placeholder="What went well, and what you agreed to try next" /><span className="help">Only you and People Ops can see this.</span></div>
          <div className="row gap-12"><Button type="submit" arrow>Save check-in</Button><Button type="button" variant="outline" onClick={() => setCheckin(null)}>Cancel</Button></div>
        </form>
      )}
      {err && <Alert tone="error" title="That didn’t save">{err}</Alert>}
      {urgent.length > 0 && (
        <div className="hero-card">
          <div className="row between"><Caps className="gold">{urgent.some((u) => u.t.overdue) ? 'Overdue and due today' : 'Due today'}</Caps><span className="t-mono gold">{urgent.length}</span></div>
          <div className="row-list mt-8">
            {urgent.slice(0, 4).map(({ t, hire }) => (
              <div key={t.id} className="ad-hero-item">
                <Avatar person={hire} size={40} />
                <div className="grow col">
                  <span className="t-h-m17">{t.title}</span>
                  <span className={`t-label ${t.overdue ? 'danger' : 'muted'}`}>For {hire.first} · {t.stageName} · {t.overdue ? lateLabel(t.dueDate) : 'due today'}</span>
                </div>
                <Button size="sm" onClick={() => toggle(t, true)}>Mark done</Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {counts.open === 0 && (
        <EmptyState emoji="🎉" title="You’re all caught up." action={isAdmin ? <Button variant="outline" onClick={() => navigate('/admin')}>Back to the overview</Button> : undefined}>
          {groups.length ? 'Everything you own is done. New tasks show up here when someone new joins.' : 'You don’t own any tasks on a new hire’s journey yet.'}
        </EmptyState>
      )}

      {groups.length > 0 && (
        <section className="section">
          <Caps>By new hire</Caps>
          <div className="ad-rows" style={{ borderTop: '1px solid var(--border-default)' }}>
            {groups.map((g) => {
              const done = g.tasks.filter((t) => t.status === 'done').length;
              const started = g.hire.startDate <= todayIso();
              return (
                <div key={g.hire.id} className="ad-group">
                  <div className="head">
                    <Avatar person={g.hire} size={40} />
                    <div className="grow col">
                      <span className="t-h-m17">{g.hire.name}</span>
                      <span className="t-label muted">{started ? 'Started' : 'Starts'} {dayDate(g.hire.startDate)}{g.hire.title ? ` · ${g.hire.title}` : ''}</span>
                    </div>
                    <span className="t-mono muted">{done} / {g.tasks.length} done</span>
                    {isAdmin && <button className="link-btn" onClick={() => navigate(`/admin/hires/${g.hire.id}`)}>Open</button>}
                  </div>
                  <div className="col" style={{ paddingLeft: 52 }}>
                    {g.tasks.map((t) => <TaskRowCompact key={t.id} task={t} onToggle={(v) => toggle(t, v)} />)}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </Page>
  );
}
