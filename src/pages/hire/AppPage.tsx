// THE STANDARD APP TEMPLATE. One layout for every connected app; every word and video comes from
// GET /api/apps/:key (catalogue + this company's connected_apps row). Any role can view it; only a
// hire with the matching task saves "Try it now" progress.
import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../auth';
import { Page, type Crumb } from '../../components/Shell';
import { VideoPlayer } from '../../components/Video';
import { Arrow, Avatar, Button, Caps, Checkbox, EmojiTile, EmptyState, Hairline, Logo, LogoTile, useToast } from '../../components/ui';
import { mmss } from '../../lib/format';
import type { AppInfo, Person, Stage, Video } from '../../lib/types';
import { useApi } from '../../lib/useApi';
import { MessageLink, numWord } from './Journey';
import '../../styles/hire-discovery.css';

interface AppData {
  app: AppInfo;
  stage: { name: string; position: number } | null;
  roles: string;
  tryItems: string[];
  houseRules: { emoji: string; title: string; body: string }[];
  owner: (Person & { duty?: string | null }) | null;
  videos: Video[];
  task: { id: number; status: 'todo' | 'done' } | null;
  data: { tried?: number[] } | null;
}

const RULE_TINTS = ['sky', 'butter', 'peach'];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function AppPage() {
  const { key = '' } = useParams();
  const { user, org } = useAuth();
  const isHire = user?.role === 'hire';
  const { data, error, setData } = useApi<AppData>(`/api/apps/${key}`);
  // Hires: read their task title ("How we talk in Slack") from the journey, so the page title matches Today and My journey.
  const journey = useApi<{ stages: Stage[] }>(isHire ? '/api/journey' : null);
  const navigate = useNavigate();
  const toast = useToast();
  const [sel, setSel] = useState(0);
  const [watched, setWatched] = useState<Set<number>>(new Set());
  const [localTried, setLocalTried] = useState<number[] | null>(null);
  const tryRef = useRef<HTMLElement>(null);

  if (error) {
    return (
      <Page crumbs={[{ label: 'Training', to: isHire ? '/training' : undefined }, { label: 'App walkthrough' }]} title="App walkthrough">
        <EmptyState emoji="🔌" title="That app isn’t connected yet.">{error.message}</EmptyState>
      </Page>
    );
  }
  if (!data) return <main className="panel"><div className="loading">Loading the walkthrough…</div></main>;

  const { app, videos, tryItems, houseRules, owner, task, stage } = data;
  const video = videos[sel] || null;
  const next = videos[sel + 1] || null;
  const taskTitle = journey.data?.stages.flatMap((s) => s.tasks).find((t) => t.type === 'app' && t.ref === app.key)?.title;
  const title = taskTitle && /^How we /.test(taskTitle) && taskTitle.includes(app.name) ? taskTitle : `Getting started with ${app.name}`;
  const [before, after] = [title.slice(0, title.lastIndexOf(app.name)), title.slice(title.lastIndexOf(app.name) + app.name.length)];
  const stageLabel = stage ? `Stage ${stage.position} · ${stage.name}` : '';
  const done = task?.status === 'done';
  const tried: number[] = localTried ?? (data.data?.tried || (done ? tryItems.map((_, i) => i) : []));
  const totalMin = Math.max(1, Math.round(videos.reduce((n, v) => n + (v.durationSec || 0), 0) / 60));
  const watchedCount = videos.filter((v) => watched.has(v.id)).length;
  const watchedPct = videos.length ? (watchedCount / videos.length) * 100 : 0;

  const scrollToTry = () => tryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const setTried = async (i: number, on: boolean) => {
    const list = on ? [...new Set([...tried, i])].sort() : tried.filter((x) => x !== i);
    setLocalTried(list);
    if (!task) return; // admins preview: ticks stay local
    try {
      const all = tryItems.length > 0 && list.length === tryItems.length;
      if (all && !done) {
        await api.post(`/api/tasks/${task.id}/complete`, { data: { tried: list } });
        setData({ ...data, task: { ...task, status: 'done' }, data: { tried: list } });
        toast(`${app.name} walkthrough done`);
      } else if (!all && done) {
        await api.post(`/api/tasks/${task.id}/undo`);
        await api.post(`/api/tasks/${task.id}/data`, { data: { tried: list } });
        setData({ ...data, task: { ...task, status: 'todo' }, data: { tried: list } });
      } else {
        await api.post(`/api/tasks/${task.id}/data`, { data: { tried: list } });
        setData({ ...data, data: { tried: list } });
      }
    } catch (e) {
      setLocalTried(tried);
      toast((e as Error).message);
    }
  };

  const crumbs: Crumb[] = isHire
    ? [{ label: 'Training', to: '/training' }, ...(stage ? [{ label: `Stage ${stage.position}` }] : []), { label: app.name }]
    : user?.role === 'admin' ? [{ label: 'Connected apps', to: '/admin/apps' }, { label: app.name }] : [{ label: app.name }];

  const aside = (
    <>
      <section className="section">
        <div className="row gap-12">
          <LogoTile app={app} size={48} />
          <div><p className="t-h-l">{app.name}</p><p className="t-label muted">{app.category}</p></div>
        </div>
        <dl className="kv mt-8">
          {stage && <><dt>Part of</dt><dd>{stageLabel}</dd></>}
          <dt>For</dt><dd>{data.roles}</dd>
        </dl>
        <a className="btn btn-outline btn-sm" style={{ alignSelf: 'flex-start' }} href={app.open} target="_blank" rel="noopener noreferrer">Open {app.name} <Arrow /></a>
      </section>
      <Hairline />
      <section className="section">
        <Caps>Your progress</Caps>
        <p className="t-body">{watchedCount} of {videos.length} videos watched</p>
        <div className="track" role="progressbar" aria-valuenow={watchedCount} aria-valuemin={0} aria-valuemax={videos.length} aria-label="Videos watched"><i style={{ width: `${watchedPct}%` }} /></div>
        {tryItems.length > 0 && <p className="t-label muted">{done ? '✓ Walkthrough done' : `${tried.length} of ${tryItems.length} things tried`}</p>}
      </section>
      {owner && (
        <>
          <Hairline />
          <section className="section">
            <Caps>Stuck?</Caps>
            <div className="row gap-10">
              <Avatar person={owner} size={40} />
              <div><p className="t-h-m">{owner.name}</p>{owner.title && <p className="t-label muted">{owner.title}</p>}</div>
            </div>
            <p className="t-body">{owner.first} looks after {app.name} here{videos.some((v) => v.presenter?.id === owner.id) ? ' and recorded these videos' : ''}. Happy to help.</p>
            {owner.id !== user?.id && <MessageLink to={owner} />}
          </section>
        </>
      )}
    </>
  );

  return (
    <Page crumbs={crumbs}
      kicker={<span className="kicker-row"><Logo app={app} size={16} />App walkthrough{stageLabel ? ` · ${stageLabel}` : ''}</span>}
      title={<>{before}<em>{app.name}</em>{after}.</>}
      lede={`${videos.length ? `${cap(numWord(videos.length))} short video${videos.length === 1 ? '' : 's'}${owner ? ` from ${owner.first}` : ''}` : 'A quick tour'}, then ${numWord(tryItems.length)} thing${tryItems.length === 1 ? '' : 's'} to try while it’s fresh.`}
      aside={aside} glow={['#FFF1B8', '#DDEBFF']}>
      {video ? (
        <section className="section gap-16" aria-label="Videos">
          <VideoPlayer key={video.id} video={video} app={app} index={sel + 1} total={videos.length}
            onFinish={() => setWatched((w) => new Set(w).add(video.id))}
            nextLabel={next?.title || null} onNext={next ? () => setSel(sel + 1) : undefined} onTry={tryItems.length ? scrollToTry : undefined} />
          {video.chapters.length > 0 && (
            <div className="row wrap gap-8" aria-label="Chapters">
              {video.chapters.map(([sec, label], i) => <span key={i} className={`chapter ${i === 0 ? 'first' : ''}`}><span className="t-mono">{mmss(sec)}</span>{label}</span>)}
            </div>
          )}
        </section>
      ) : (
        <EmptyState emoji="🎬" title="No videos yet.">{owner ? `${owner.first} hasn’t recorded this walkthrough yet.` : 'This walkthrough hasn’t been recorded yet.'}</EmptyState>
      )}

      {videos.length > 1 && (
        <section className="section">
          <Caps>{videos.length} videos · {totalMin} min</Caps>
          <div className="playlist">
            {videos.map((v, i) => (
              <button key={v.id} type="button" className={`pl-card ${i === sel ? 'on' : ''}`} onClick={() => setSel(i)} aria-current={i === sel || undefined}>
                <span className={`pl-thumb tint-${app.tint}`}><LogoTile app={app} size={26} radius={7} /></span>
                <span className="pl-text">
                  <span className="t-h-m">{v.title}</span>
                  {i === sel ? <span className="now-playing">Now playing</span>
                    : watched.has(v.id) ? <span className="t-label success strong">✓ Watched</span>
                    : <span className="t-mono muted">{mmss(v.durationSec)}</span>}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {tryItems.length > 0 && (
        <section className="section" ref={tryRef} style={{ scrollMarginTop: 24 }}>
          <div>
            <Caps>Try it now</Caps>
            <p className="t-label muted" style={{ marginTop: 4 }}>{cap(numWord(tryItems.length))} small thing{tryItems.length === 1 ? '' : 's'}. Tick each one when you’ve done it.</p>
          </div>
          <div className="col">
            {tryItems.map((item, i) => {
              const on = tried.includes(i);
              return (
                <div key={i} className="try-row" onClick={() => setTried(i, !on)}>
                  <Checkbox checked={on} label={item} onChange={(v) => setTried(i, v)} />
                  <span className={`t-body ${on ? 'done' : ''}`}>{item}</span>
                </div>
              );
            })}
          </div>
          {!task && <p className="t-label muted">You’re previewing this page. Ticks aren’t saved.</p>}
          {done && task && <div className="row gap-12"><span className="t-label success strong">✓ All done. Nice work.</span><Button size="sm" variant="outline" onClick={() => navigate('/today')}>Back to Today</Button></div>}
        </section>
      )}

      {houseRules.length > 0 && (
        <section className="section">
          <div>
            <Caps>How we use it here</Caps>
            <p className="t-label muted" style={{ marginTop: 4 }}>{org?.name ? `${org.name}’s` : 'Your team’s'} own habits.</p>
          </div>
          <div className="col gap-4">
            {houseRules.map((r, i) => (
              <div key={i} className="rule-row">
                <EmojiTile emoji={r.emoji} tint={RULE_TINTS[i % RULE_TINTS.length]} size={34} />
                <div><p className="t-h-m">{r.title}</p><p className="t-body muted">{r.body}</p></div>
              </div>
            ))}
          </div>
        </section>
      )}
    </Page>
  );
}
