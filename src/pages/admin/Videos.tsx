// Video library: the next thing to record (the one hero), filter chips, and a grid of cards.
// App walkthroughs show the app's official logo; people videos show a still (or the presenter's photo).
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Page } from '../../components/Shell';
import { Avatar, Button, Caps, Hairline, LogoTile, Pill, useToast } from '../../components/ui';
import { VideoCard } from '../../components/Video';
import { mins } from '../../lib/format';
import type { Video } from '../../lib/types';
import { VideoModal } from '../hire/Journey';
import { useApi } from '../../lib/useApi';
import { CATALOG, lengthLabel } from './kit';

interface VideosData { videos: Video[]; stats: { count: number; totalSec: number } }
type Filter = 'all' | Video['kind'];
const FILTERS: [Filter, string][] = [['all', 'All'], ['intro', 'Intros'], ['app', 'Apps'], ['hello', 'Hellos'], ['lesson', 'Lessons']];
const KIND: Record<Video['kind'], string> = { intro: 'Stage intro', app: 'App walkthrough', hello: 'Hello', lesson: 'Lesson' };
const STATUS: Record<Video['status'], ['success' | 'warning' | 'danger', string]> = { published: ['success', 'Published'], needs_update: ['warning', 'Needs update'], missing: ['danger', 'Missing'] };

/** Starter talking points. Buddy drafts these per app; the generic set covers anything else. */
const POINTS: Record<string, string[]> = {
  linear: ['How engineers pick up an issue', 'Cycles, estimates and what “done” means here', 'Linking pull requests to issues', 'Your first ticket: fix a typo in the docs'],
  notion: ['Where the team wiki lives', 'Search first: the fastest way to find things', 'Team spaces and meeting notes', 'Fix what’s out of date'],
  slack: ['The channels everyone joins', 'Threads, always', 'Status and focus time', 'Say hi in #introductions'],
};
const pointsFor = (v: Video) => (v.appKey && POINTS[v.appKey]) || ['Why the team uses it', 'Where to find the things you need', '1 small thing to try today', 'Who to ask when you’re stuck'];

export default function Videos() {
  const { data } = useApi<VideosData>('/api/admin/videos');
  const navigate = useNavigate();
  const toast = useToast();
  const [filter, setFilter] = useState<Filter>('all');
  const [playing, setPlaying] = useState<Video | null>(null);
  if (!data) return <main className="panel"><div className="loading">Loading the library…</div></main>;

  const vids = data.videos;
  const next = vids.find((v) => v.status === 'missing') || vids.find((v) => v.status === 'needs_update') || null;
  const nextApp = next?.appKey ? CATALOG[next.appKey] : null;
  const attention = vids.filter((v) => v.status !== 'published');
  const shown = filter === 'all' ? vids : vids.filter((v) => v.kind === filter);
  const count = (f: Filter) => (f === 'all' ? vids.length : vids.filter((v) => v.kind === f).length);
  const open = (v: Video) => (v.appKey ? navigate(`/admin/apps/${v.appKey}`) : setPlaying(v));

  const aside = (
    <>
      <div className="section">
        <Caps>Your library</Caps>
        <div className="row"><span className="ad-dot sky" aria-hidden /><span className="t-body grow">Videos</span><span className="ad-stat">{data.stats.count}</span></div>
        <div className="row"><span className="ad-dot sky" aria-hidden /><span className="t-body grow">Total length</span><span className="ad-stat">{lengthLabel(data.stats.totalSec)}</span></div>
        <div className="row"><span className="ad-dot gold" aria-hidden /><span className="t-body grow">Still to record</span><span className="ad-stat">{vids.filter((v) => v.status === 'missing').length}</span></div>
      </div>
      <Hairline />
      <div className="section">
        <div className="section-head"><Caps>Needs attention</Caps><span className="t-mono muted">{attention.length}</span></div>
        {attention.length ? attention.map((v) => (
          <div key={v.id} className="col">
            <span className="t-h-m">{v.title} {v.status === 'missing' ? 'is missing' : 'looks out of date'}</span>
            <span className="t-label muted">{v.status === 'missing' ? `Not recorded yet${v.presenter ? ` · ${v.presenter.first} owns it` : ''}` : `${v.flagged || 'Some'} new ${v.flagged === 1 ? 'hire' : 'hires'} flagged it`}</span>
          </div>
        )) : <p className="t-body muted">Nothing. Every video is current.</p>}
      </div>
      <Hairline />
      <p className="t-label muted">💬 Every video gets captions and a transcript, so people can watch on mute or read instead.</p>
      <Hairline />
      <div className="section">
        <Caps>Recording tips</Caps>
        {['Keep it under 5 minutes. Split longer topics.', 'Show your real screen, not slides.', 'Say why, not just how.'].map((t) => (
          <p key={t} className="t-body row top gap-8"><span aria-hidden className="success">✓</span>{t}</p>
        ))}
      </div>
    </>
  );

  return (
    <Page admin crumbs={[{ label: 'Admin', to: '/admin' }, { label: 'Video library' }]} kicker="Admin · Video library"
      title={<>Record it once. <em>Every hire watches.</em></>}
      lede="Stage intros, app walkthroughs, hellos and lessons, all in one place. This page shows what’s missing and what’s gone out of date." aside={aside}>
      {next ? (
        <div className="hero-card">
          <div className="row top gap-20">
            {nextApp ? <LogoTile app={nextApp} size={64} /> : <Avatar person={next.presenter} size={64} />}
            <div className="grow col gap-4">
              <Caps className="gold">{next.status === 'missing' ? 'Next to record' : 'Needs an update'} · {KIND[next.kind]}</Caps>
              <h2 className="t-h-l">{next.title}</h2>
              <p className="t-body muted mt-8">
                {next.status === 'missing' ? 'Not recorded yet, so new hires would see an empty section. ' : `${next.flagged || 'Some'} new ${next.flagged === 1 ? 'hire' : 'hires'} said it looks out of date. `}
                About {next.durationSec ? mins(next.durationSec) : '4 minutes'}. Suggested talking points:
              </p>
              <ol className="ad-points">
                {pointsFor(next).map((p, i) => <li key={p}><span className="n">0{i + 1}</span><span className="t-body">{p}</span></li>)}
              </ol>
              <div className="row gap-12 mt-16 wrap">
                {next.appKey ? <Button arrow onClick={() => navigate(`/admin/apps/${next.appKey}`)}>Add the video</Button> : <Button onClick={() => toast('In-browser recording isn’t built yet. Record with Loom (screen + face) and paste the link on the app’s page.')}><span className="rec-dot" aria-hidden />Start recording</Button>}
                
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="hero-card sky"><Caps>Next to record</Caps><h2 className="t-l mt-8">Everything’s recorded.</h2><p className="t-body muted mt-8">No missing or out-of-date videos. New hires see every section.</p></div>
      )}

      <section className="section">
        <div className="ad-chips" role="group" aria-label="Filter videos">
          {FILTERS.map(([f, label]) => (
            <button key={f} className="chip" aria-pressed={filter === f} onClick={() => setFilter(f)}>{label} · {count(f)}</button>
          ))}
        </div>
        {shown.length ? (
          <div className="ad-grid">
            {shown.map((v) => {
              const app = v.appKey ? CATALOG[v.appKey] : null;
              const card = v.kind === 'hello' && !v.still && v.presenter?.photo ? { ...v, still: v.presenter.photo } : v;
              const [tone, label] = STATUS[v.status];
              return (
                <VideoCard key={v.id} video={card} app={app} kind={app ? `${KIND[v.kind]} · ${app.name}` : KIND[v.kind]} title={v.title}
                  meta={v.presenter ? <span className="row gap-6"><Avatar person={v.presenter} size={20} />{v.presenter.name}</span> : undefined}
                  status={<span><Pill tone={tone}>{label}{v.status === 'needs_update' && v.flagged ? ` · ${v.flagged} flagged` : ''}</Pill></span>}
                  onClick={() => open(v)} />
              );
            })}
          </div>
        ) : <p className="t-body muted">No videos of this kind yet.</p>}
      </section>
          <VideoModal video={playing} onClose={() => setPlaying(null)} />
    </Page>
  );
}
