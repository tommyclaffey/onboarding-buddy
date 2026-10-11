// Welcome (first login): the team's hello video, how Onboarding Buddy works, a preview of the journey,
// and the first three steps. The video is the one bright thing; the rest stays open and quiet.
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../auth';
import { Page } from '../../components/Shell';
import { VideoPlayer } from '../../components/Video';
import { Button, Caps, Checkbox, Hairline, useToast } from '../../components/ui';
import { calParts, longDate, todayIso } from '../../lib/format';
import type { Stage, Task } from '../../lib/types';
import { useApi } from '../../lib/useApi';
import { openTask } from './Today';
import { HelpBlock, useCrew } from './TaskPage';
import '../../styles/hire-flows.css';

const short = (name: string) => name.replace('Find Your Feet', 'Week 1').replace('Hit Your Stride', 'Ramp-up').replace('You Did It', 'Graduate');

export default function Welcome() {
  const { data, reload } = useApi<{ startDate: string; stages: Stage[] }>('/api/journey');
  const crew = useCrew();
  const { user, org } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  if (!data) return <main className="panel"><div className="loading">Loading your welcome…</div></main>;

  const first = user?.name.split(' ')[0] || 'there';
  const hello = data.stages[0];
  const intro = hello?.intro;
  const mine = data.stages.flatMap((s) => s.tasks).filter((t) => t.ownerRole === 'hire');
  const firstThree = (hello?.tasks || []).filter((t) => t.ownerRole === 'hire').slice(0, 3);
  const nextOpen = mine.find((t) => t.status !== 'done');
  const beforeDayOne = mine.filter((t) => t.dueDay <= 0 && t.status !== 'done').length;
  const buddy = crew?.buddy;
  const cal = calParts(data.startDate);
  const days = crew?.daysToGo ?? null;
  const welcomeTask = intro ? mine.find((t) => t.type === 'video' && t.ref === String(intro.id)) : undefined;

  const toggle = async (t: Task, done: boolean) => {
    await api.post(`/api/tasks/${t.id}/${done ? 'complete' : 'undo'}`);
    await reload();
    if (done) toast(`${t.title}: done.`, { label: 'Undo', run: async () => { await api.post(`/api/tasks/${t.id}/undo`); reload(); } });
  };
  const finishedVideo = () => { if (welcomeTask && welcomeTask.status !== 'done') toggle(welcomeTask, true); };

  const aside = (
    <>
      <div className="section">
        <div className="section-head"><Caps>Your first 3 steps</Caps><span className="t-mono muted">{firstThree.filter((t) => t.status === 'done').length} / {firstThree.length}</span></div>
        <div className="aside-list">
          {firstThree.map((t) => (
            <div key={t.id} className="al" style={{ alignItems: 'flex-start' }}>
              <span style={{ marginTop: 2 }}><Checkbox checked={t.status === 'done'} label={`Mark “${t.title}” ${t.status === 'done' ? 'not done' : 'done'}`} onChange={(v) => toggle(t, v)} /></span>
              <button className="grow col gap-2" style={{ background: 'none', border: 0, padding: 0, textAlign: 'left', cursor: 'pointer' }} onClick={() => openTask(navigate, t)}>
                <span className={`t-body ${t.status === 'done' ? 'muted' : 'strong'}`}>{t.title}</span>
                <span className="t-label muted">{t.status === 'done' ? 'Done' : t.meta.split(' · ').slice(-2).join(' · ')}</span>
              </button>
            </div>
          ))}
        </div>
      </div>
      <Hairline />
      <div className="row gap-16">
        <div className="cal-tile" aria-hidden><div className="mon">{cal.mon}</div><div className="t-m" style={{ padding: '4px 0 6px' }}>{cal.day}</div></div>
        <div className="col gap-2">
          <Caps>Day 1</Caps>
          <p className="t-h-l">{days == null ? longDate(data.startDate) : days === 0 ? 'It’s today!' : `${days} ${days === 1 ? 'day' : 'days'} to go`}</p>
          <p className="t-label muted">{cal.wd} · 9:00 AM · remote</p>
        </div>
      </div>
      <Hairline />
      <HelpBlock person={crew?.peopleOps} role="People Ops · your HR contact" caps="Questions before you start?" />
    </>
  );

  return (
    <Page crumbs={[{ label: 'Onboarding' }, { label: 'Welcome' }]} kicker={`Welcome · ${longDate(todayIso())}`}
      title={<>Welcome to {org?.name || 'the team'}, <em>{first}.</em></>}
      lede="We’re really glad you said yes. Start with this short hello from the team, then take everything else one step at a time." aside={aside}>
      {intro && <VideoPlayer video={intro} kicker={`Watch first · ${Math.max(1, Math.round((intro.durationSec || 60) / 60))} min`} onFinish={finishedVideo} />}

      <section className="section">
        <Caps>How Onboarding Buddy works</Caps>
        <div className="how-grid">
          <div className="how-card tint-sky">
            <span className="hc-icon" aria-hidden>👣</span>
            <h3 className="t-h-m17">One step at a time</h3>
            <p className="t-body">Today only shows what’s next. Everything else waits until it’s time.</p>
          </div>
          <div className="how-card tint-peach">
            <span className="hc-icon" aria-hidden>🤝</span>
            <h3 className="t-h-m17">A real buddy</h3>
            <p className="t-body">{buddy ? `${buddy.first} is your buddy, a real person on the team. Ask them anything, especially the small stuff.` : 'A real person on the team is your buddy. Ask them anything, especially the small stuff.'}</p>
          </div>
          <div className="how-card tint-butter">
            <span className="hc-icon" aria-hidden>💬</span>
            <h3 className="t-h-m17">Ask Buddy, any time</h3>
            <p className="t-body">Stuck on a form or a word? Press ⌘J and ask. It answers common questions and points you to the right person.</p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head"><Caps>Before {longDate(data.startDate)}</Caps><span className="t-mono muted">{beforeDayOne} small {beforeDayOne === 1 ? 'task' : 'tasks'} before Day 1</span></div>
        <div className="journey-strip" style={{ gridTemplateColumns: `repeat(${data.stages.length}, 1fr)` }}>
          {data.stages.map((s) => <span key={s.id} className={`bar ${s.state}`} style={{ ['--p' as string]: `${s.total ? (s.done / s.total) * 100 : 0}%` }} title={`${s.name}: ${s.done} of ${s.total} done`} />)}
          {data.stages.map((s) => <span key={`l${s.id}`} className="lbl"><span aria-hidden>{s.emoji}</span>{short(s.name)}</span>)}
        </div>
        <p className="t-body muted">You don’t have to do it all today. Most people finish the {hello?.name || 'first'} stage in 3 or 4 short sessions.</p>
      </section>

      <div className="row gap-12 wrap">
        <Button arrow onClick={() => (nextOpen ? openTask(navigate, nextOpen) : navigate('/today'))}>Start my first task</Button>
        <Button variant="outline" onClick={() => navigate('/people')}>{buddy ? `Meet ${buddy.first}, your buddy` : 'Meet your buddy'}</Button>
      </div>
    </Page>
  );
}
