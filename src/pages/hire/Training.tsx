// Training: the stage hub. The stage intro video, its chapters, your team's connected tools (each one a
// walkthrough), and the other videos this week. If the current stage has no training in it yet (Hello!),
// it shows the next stage that does, labelled "Coming up".
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../auth';
import { Page } from '../../components/Shell';
import { TaskRow } from '../../components/Rows';
import { VideoCard, VideoPlayer } from '../../components/Video';
import { Button, Caps, EmptyState, Hairline, LogoTile, Pill, useToast } from '../../components/ui';
import { dueLabel, mins, mmss } from '../../lib/format';
import type { AppInfo, Person, Stage, Task, Video } from '../../lib/types';
import { useApi } from '../../lib/useApi';
import { openTask } from './Today';
import { MessageLink, ownerOfRole } from './Journey';
import '../../styles/hire-discovery.css';

interface ToolsData { apps: (AppInfo & { task: Task | null })[] }
interface AppDetail { app: AppInfo; videos: Video[]; tryItems: string[]; owner: Person | null; task: { id: number; status: string } | null; data: { tried?: number[] } | null }

const isTraining = (s: Stage) => {
  const mine = s.tasks.filter((t) => t.ownerRole === 'hire');
  const apps = mine.filter((t) => t.type === 'app').length;
  const vids = mine.filter((t) => t.type === 'video').length;
  return apps >= 1 && apps + vids >= 2;
};
const SHORT: Record<string, string> = { 'Find Your Feet': 'Week 1', 'Hit Your Stride': 'Ramp-up', 'You Did It': 'Graduate' };

export default function Training() {
  const { org } = useAuth();
  const journey = useApi<{ startDate: string; stages: Stage[] }>('/api/journey');
  const tools = useApi<ToolsData>('/api/tools');
  const [details, setDetails] = useState<Record<string, AppDetail>>({});
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    if (!tools.data) return;
    let live = true;
    Promise.all(tools.data.apps.map((a) => api.get<AppDetail>(`/api/apps/${a.key}`).catch(() => null))).then((list) => {
      if (live) setDetails(Object.fromEntries(list.filter(Boolean).map((d) => [d!.app.key, d!])));
    });
    return () => { live = false; };
  }, [tools.data]);

  if (!journey.data || !tools.data) return <main className="panel"><div className="loading">Loading your training…</div></main>;

  const stages = journey.data.stages;
  const current = stages.find((s) => s.state === 'current') || stages[stages.length - 1];
  const focus = isTraining(current) ? current : stages.find((s) => s.position > current.position && isTraining(s)) || current;
  const comingUp = focus.id !== current.id;
  const all = stages.flatMap((s) => s.tasks);
  const peopleOps = ownerOfRole(all, 'people_ops');
  const mine = focus.tasks.filter((t) => t.ownerRole === 'hire');
  const videoTasks = mine.filter((t) => t.type === 'video');
  const appTasks = mine.filter((t) => t.type === 'app');
  const nextApp = appTasks.find((t) => t.status !== 'done');
  const nextDetail = nextApp?.ref ? details[nextApp.ref] : null;
  const intro = focus.intro;

  const toggle = async (t: Task, done: boolean) => {
    await api.post(`/api/tasks/${t.id}/${done ? 'complete' : 'undo'}`);
    await journey.reload();
    if (done) toast(`${t.title}: done.`, { label: 'Undo', run: async () => { await api.post(`/api/tasks/${t.id}/undo`); journey.reload(); } });
  };

  const aside = (
    <>
      <section className="section">
        <div className="section-head"><Caps>Stage {focus.position} progress</Caps><span className="t-mono muted">{focus.done} / {focus.total}</span></div>
        <div className="stage-bars" style={{ gridTemplateColumns: `repeat(${stages.length}, 1fr)` }}>
          {stages.map((s) => <span key={s.id} className={`bar ${s.state}`} style={{ ['--p' as string]: `${s.total ? (s.done / s.total) * 100 : 0}%` }} title={s.name} />)}
        </div>
        <div className="row between t-label muted" style={{ fontSize: 12 }}>{stages.map((s) => <span key={s.id} className={s.id === focus.id ? 'strong' : ''} style={s.id === focus.id ? { color: 'var(--text-primary)' } : undefined}>{SHORT[s.name] || s.name}</span>)}</div>
      </section>
      {nextApp?.app && (
        <>
          <Hairline />
          <section className="section">
            <Caps>Up next</Caps>
            <div className="row gap-12">
              <LogoTile app={nextApp.app} size={40} />
              <div className="grow">
                <p className="t-h-m">{nextApp.app.name} · {nextDetail?.videos[0]?.title || nextApp.title}</p>
                <p className="t-label muted">{nextDetail?.videos.length ? `Video 1 of ${nextDetail.videos.length} · ${mmss(nextDetail.videos[0].durationSec)}` : nextApp.meta}</p>
              </div>
            </div>
            <Button arrow style={{ alignSelf: 'flex-start' }} onClick={() => openTask(navigate, nextApp)}>{nextDetail?.data?.tried?.length ? 'Keep going' : 'Start watching'}</Button>
          </section>
        </>
      )}
      <Hairline />
      <section className="section">
        <Caps>Missing a tool?</Caps>
        <p className="t-body">If your team uses an app that isn’t here, ask {peopleOps?.first || 'People Ops'} to connect it. Its walkthrough shows up in this stage automatically.</p>
        <MessageLink to={peopleOps} />
      </section>
    </>
  );

  return (
    <Page crumbs={[{ label: 'Onboarding' }, { label: 'Training' }, { label: `Stage ${focus.position} · ${focus.name}` }]}
      kicker={`Training · Stage ${focus.position} of ${stages.length} · ${focus.name}`}
      title={<>{focus.name}, <em>on video.</em></>}
      lede="Every stage starts with a short video. Your team’s tools come with their own walkthroughs, recorded by the people who use them every day."
      aside={aside}>
      {comingUp && (
        <div className="row gap-12" style={{ marginBottom: -24 }}>
          <Pill tone="sky">Coming up</Pill>
          <span className="t-label muted">Opens {dueLabel(focus.opens)}. You can watch ahead any time.</span>
        </div>
      )}
      {intro ? (
        <section className="section gap-10" aria-label="Stage intro">
          <VideoPlayer key={intro.id} video={intro} kicker={`Stage intro · ${mins(intro.durationSec)}`} />
          {intro.chapters.length > 0 && (
            <div className="chapters-3" style={{ gridTemplateColumns: `repeat(${Math.min(intro.chapters.length, 4)}, 1fr)` }}>
              {intro.chapters.map(([sec, label], i) => <span key={i} className={`chapter ${i === 0 ? 'first' : ''}`}><span className="t-mono">{mmss(sec)}</span>{label}</span>)}
            </div>
          )}
        </section>
      ) : (
        <EmptyState emoji="🎬" title="No stage intro yet.">This stage doesn’t have an intro video yet.</EmptyState>
      )}

      <section className="section">
        <div className="section-head">
          <Caps>Your team’s tools</Caps>
          <span className="t-label muted">🔌 {tools.data.apps.length} connected by {org?.name || 'your company'}</span>
        </div>
        <p className="t-body muted">{org?.name || 'Your company'} connected these apps, so each one comes with a walkthrough of how the team actually uses it.</p>
        {tools.data.apps.length ? (
          <div className="grid-3">
            {tools.data.apps.map((a) => {
              const d = details[a.key];
              const vids = d?.videos || [];
              const total = vids.reduce((n, v) => n + (v.durationSec || 0), 0);
              const triedN = d?.data?.tried?.length || 0;
              const tryN = d?.tryItems.length || 0;
              const done = a.task?.status === 'done';
              return (
                <VideoCard key={a.key} app={a} video={vids[0] || null} kind={a.name} title={a.task?.title || vids[0]?.title || `Getting started with ${a.name}`}
                  meta={d ? [d.owner && `Recorded by ${d.owner.name}`, `${vids.length} video${vids.length === 1 ? '' : 's'}`, total && mins(total)].filter(Boolean).join(' · ') : a.category}
                  onClick={() => navigate(`/apps/${a.key}`)}
                  footer={
                    <span className="tool-progress">
                      <span className="track"><i style={{ width: `${done ? 100 : tryN ? (triedN / tryN) * 100 : 0}%` }} /></span>
                      <span className={`t-mono ${done ? 'success' : 'muted'}`}>{done ? '✓ Done' : triedN ? `${triedN} of ${tryN}` : 'Not started'}</span>
                    </span>
                  } />
              );
            })}
          </div>
        ) : (
          <EmptyState emoji="🔌" title="No tools connected yet.">{peopleOps?.first || 'People Ops'} will add them before you need them.</EmptyState>
        )}
      </section>

      {videoTasks.length > 0 && (
        <section className="section">
          <div className="section-head"><Caps>Also this {comingUp ? 'stage' : 'week'}</Caps><span className="t-mono muted">{videoTasks.filter((t) => t.status === 'done').length} of {videoTasks.length} watched</span></div>
          <div className="col">
            {videoTasks.map((t, i) => <TaskRow key={t.id} task={t} index={i} onOpen={() => openTask(navigate, t)} onToggle={(v) => toggle(t, v)} />)}
          </div>
        </section>
      )}
    </Page>
  );
}
