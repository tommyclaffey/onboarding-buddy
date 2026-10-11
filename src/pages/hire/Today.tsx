// Today: the reference screen. One hero card (what's current, yellow), open sections split by hairlines,
// side column with the Day 1 card, journey progress, your people and the feelings check.
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { Page } from '../../components/Shell';
import { TaskRow } from '../../components/Rows';
import { Avatar, Button, Caps, Checkbox, EmojiTile, Hairline, useToast } from '../../components/ui';
import { calParts, greeting, longDate } from '../../lib/format';
import type { Person, Task } from '../../lib/types';
import { useApi } from '../../lib/useApi';

interface TodayData {
  me: { first: string; name: string };
  startDate: string; daysToGo: number;
  stage: { name: string; emoji: string; done: number; total: number; position: number };
  stages: { id: number; name: string; state: string; done: number; total: number }[];
  now: (Task & { step: number | null; steps: string[] | null }) | null;
  next: Task[]; doneToday: number;
  buddy: (Person & { quote: string }) | null; manager: Person | null; peopleOps: Person | null;
  feeling: number | null;
}

const FEELINGS = ['😬', '🤔', '😐', '🙂', '🤩'];
const FEELING_WORDS = ['Nervous', 'Unsure', 'Okay', 'Good', 'Excited'];

export const openTask = (navigate: (to: string) => void, t: Task) => navigate(t.type === 'app' && t.ref ? `/apps/${t.ref}` : `/tasks/${t.id}`);

export default function Today() {
  const { data, reload, setData } = useApi<TodayData>('/api/today');
  const navigate = useNavigate();
  const toast = useToast();
  // Brand-new hires (welcome video not watched yet) start on the Welcome page, once per session.
  useEffect(() => {
    if (data?.now?.title === 'Watch the welcome video' && !sessionStorage.getItem('ob-welcomed')) { sessionStorage.setItem('ob-welcomed', '1'); navigate('/welcome', { replace: true }); }
  }, [data, navigate]);
  if (!data) return <main className="panel"><div className="loading">Loading your day…</div></main>;

  const toggle = async (t: Task, done: boolean) => {
    await api.post(`/api/tasks/${t.id}/${done ? 'complete' : 'undo'}`);
    await reload();
    if (done) toast(`${t.title}: done. ${data.stage.done + 1} of ${data.stage.total} ${data.stage.name} tasks finished.`, { label: 'Undo', run: async () => { await api.post(`/api/tasks/${t.id}/undo`); reload(); } });
  };
  const setFeeling = async (v: number) => {
    setData({ ...data, feeling: v });
    await api.post('/api/feeling', { value: v });
  };
  const cal = calParts(data.startDate);
  const pct = data.stage.total ? Math.round((data.stage.done / data.stage.total) * 100) : 0;
  const nowTask = data.now;

  const aside = (
    <>
      <div className="hero-card sky" style={{ padding: 22 }}>
        <div className="row between top">
          <div>
            <Caps>Day 1</Caps>
            <p className="t-l" style={{ marginTop: 6 }}>{data.daysToGo === 0 ? 'Today!' : `${data.daysToGo} days`}</p>
            <p className="t-label muted">{longDate(data.startDate)} · 9:00 AM · remote</p>
          </div>
          <div className="card" style={{ width: 64, textAlign: 'center', transform: 'rotate(4deg)', boxShadow: 'var(--shadow-soft)' }}>
            <div style={{ background: 'var(--bg-primary)', color: '#fff', font: '600 12px var(--font-body)', padding: '3px 0' }}>{cal.mon}</div>
            <div className="t-m" style={{ padding: '4px 0 6px' }}>{cal.day}</div>
          </div>
        </div>
      </div>
      <div className="section">
        <div className="section-head"><Caps>Your journey</Caps><a href="/journey" onClick={(e) => { e.preventDefault(); navigate('/journey'); }} className="t-label">See all</a></div>
        <div className="stage-bars" style={{ gridTemplateColumns: `repeat(${data.stages.length}, 1fr)` }}>
          {data.stages.map((s) => <span key={s.id} className={`bar ${s.state}`} style={{ ['--p' as string]: `${s.total ? (s.done / s.total) * 100 : 0}%` }} title={s.name} />)}
        </div>
        <div className="row between t-label muted" style={{ fontSize: 12 }}>{data.stages.map((s) => <span key={s.id}>{s.name.replace('Find Your Feet', 'Week 1').replace('Hit Your Stride', 'Ramp-up').replace('You Did It', 'Graduate')}</span>)}</div>
        <p className="t-body"><span aria-hidden>{data.stage.emoji}</span> Stage {data.stage.position} · {data.stage.name} · <b>{data.stage.done} of {data.stage.total} done</b></p>
      </div>
      <Hairline />
      <div className="section">
        <Caps>Your people</Caps>
        {data.buddy && (
          <div className="col gap-10">
            <div className="row gap-10"><Avatar person={data.buddy} size={40} /><div className="grow"><p className="t-h-m">{data.buddy.name}</p><p className="t-label muted">Your buddy · {data.buddy.title}</p></div>
              <Button size="sm" variant="outline" onClick={() => navigate('/people')}>Say hi</Button></div>
            <p className="t-body" style={{ background: 'var(--bg-subtle)', padding: '12px 14px', borderRadius: 14 }}>“{data.buddy.quote}”</p>
          </div>
        )}
        {[{ p: data.manager, r: 'Your manager' }, { p: data.peopleOps, r: 'People Ops · your HR contact' }].filter((x) => x.p).map((x) => (
          <div key={x.p!.id} className="row gap-10"><Avatar person={x.p} size={32} /><div><p className="t-h-m">{x.p!.name}</p><p className="t-label muted">{x.r}</p></div></div>
        ))}
      </div>
      <Hairline />
      <div className="section">
        <Caps>How are you feeling?</Caps>
        <div className="row gap-4" role="radiogroup" aria-label="How are you feeling?" style={{ background: 'var(--bg-subtle)', borderRadius: 14, padding: 4 }}>
          {FEELINGS.map((f, i) => (
            <button key={i} role="radio" aria-checked={data.feeling === i + 1} aria-label={FEELING_WORDS[i]} onClick={() => setFeeling(i + 1)}
              style={{ flex: 1, border: 0, borderRadius: 10, padding: '8px 0', fontSize: 20, cursor: 'pointer', background: data.feeling === i + 1 ? 'var(--bg-highlight-soft)' : 'transparent', boxShadow: data.feeling === i + 1 ? 'inset 0 0 0 1.5px var(--text-highlight)' : 'none' }}>{f}</button>
          ))}
        </div>
        <p className="t-label muted">🔒 Only {data.peopleOps?.first || 'People Ops'} in People Ops sees this.</p>
      </div>
    </>
  );

  return (
    <Page crumbs={[{ label: 'Onboarding' }, { label: 'Today' }]} kicker={`${data.stage.name} · ${longDate(new Date().toISOString().slice(0, 10))}`}
      title={<>{greeting()}, <em>{data.me.first}.</em></>}
      lede={nowTask ? `${data.next.length + 1} small things today. ${data.doneToday ? `${data.doneToday} already done. ` : ''}You’re right on track.` : 'Nothing left for today. Enjoy the rest of your day.'}
      aside={aside}>
      {nowTask ? (
        <div className="hero-card">
          <div className="row between"><Caps className="gold">Now</Caps><span className="t-mono muted">{nowTask.meta?.match(/\d+ min/)?.[0] ? `~${nowTask.meta.match(/\d+ min/)![0]}` : ''}</span></div>
          <div className="row gap-12 mt-8"><EmojiTile emoji={nowTask.emoji} tint="butter" size={40} /><h2 className="t-l">{nowTask.title}</h2></div>
          <p className="t-label muted mt-8">{nowTask.meta}</p>
          {nowTask.steps && (
            <div className="card mt-16" style={{ padding: '4px 16px' }}>
              <div className="row-list">
                {nowTask.steps.map((s, i) => (
                  <div key={s} className="row gap-12" style={{ padding: '11px 0' }}>
                    <Checkbox checked={(nowTask.step || 1) > i + 1} disabled label={s} />
                    <span className={`t-body grow ${(nowTask.step || 1) > i + 1 ? 'muted' : ''}`}>{s}</span>
                    <span className="t-mono muted">0{i + 1}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="row gap-16 mt-16">
            {nowTask.steps && <><div className="track grow"><i style={{ width: `${(((nowTask.step || 1) - 1) / nowTask.steps.length) * 100}%` }} /></div><span className="t-mono muted">{(nowTask.step || 1) - 1} of {nowTask.steps.length}</span></>}
            <span className={nowTask.steps ? '' : 'grow'} />
            <Button arrow onClick={() => openTask(navigate, nowTask)}>{nowTask.step && nowTask.step > 1 ? 'Continue' : 'Start'}</Button>
          </div>
        </div>
      ) : (
        <div className="hero-card sky center"><h2 className="t-l">All done for now.</h2><p className="t-body muted mt-8">Your next stage opens soon. Have a look at what’s coming on My journey.</p></div>
      )}

      {data.next.length > 0 && (
        <section className="section">
          <div className="section-head"><Caps>Up next</Caps><span className="t-label muted">{pct}% of {data.stage.name}</span></div>
          <div className="col">
            {data.next.map((t, i) => <TaskRow key={t.id} task={t} index={i} onOpen={() => openTask(navigate, t)} onToggle={(v) => toggle(t, v)} />)}
          </div>
        </section>
      )}
      <p className="t-m muted" style={{ fontStyle: 'italic', fontWeight: 300 }}>Free for the rest of the day.</p>
    </Page>
  );
}
