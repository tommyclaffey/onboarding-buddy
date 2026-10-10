// Connected apps: how it works (the one hero), the connected list (open rows → app detail),
// and apps available to connect (Connect → POST, then open its detail).
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../../api';
import { Page } from '../../components/Shell';
import { Alert, Button, Caps, EmojiTile, Hairline, LogoTile, Pill } from '../../components/ui';
import type { AppInfo, Person, Video } from '../../lib/types';
import { useApi } from '../../lib/useApi';
import { Chevron } from './kit';

export interface ConnectedApp {
  app: AppInfo; stage: { id: number; name: string } | null; roles: string; tryItems: string[]; houseRules: { emoji: string; title: string; body: string }[];
  owner: Person | null; connectedBy: Person | null; connectedAt: string; videos: Video[];
  status: { tone: string; label: string; line: string; action: string }; finished: { done: number; total: number };
}
interface AppsData { connected: ConnectedApp[]; available: AppInfo[] }

/** Walkthrough state in words: pill + a sub-line. */
export function walkthroughState(c: Pick<ConnectedApp, 'videos' | 'owner'>) {
  const missing = c.videos.filter((v) => v.status === 'missing');
  const stale = c.videos.filter((v) => v.status === 'needs_update');
  const recorded = c.videos.length - missing.length;
  if (!c.videos.length) return { tone: 'danger' as const, label: 'No walkthrough yet', sub: 'Record one to publish' };
  if (missing.length) return { tone: 'danger' as const, label: `${missing.length} missing`, sub: `${recorded} of ${c.videos.length} recorded · ${missing[0].title} missing` };
  if (stale.length) return { tone: 'warning' as const, label: 'Needs update', sub: `${stale[0].flagged || 'Some'} ${stale[0].flagged === 1 ? 'person' : 'people'} flagged “${stale[0].title}”` };
  return { tone: 'success' as const, label: '✓ Ready', sub: `${c.videos.length} ${c.videos.length === 1 ? 'video' : 'videos'}${c.owner ? ` · ${c.owner.name}` : ''}` };
}

const STEPS: [string, string, string, string][] = [
  ['🔌', 'sky', 'Connect the app', 'Sign in once as an admin. Nothing reaches new hires until you publish.'],
  ['🎥', 'peach', 'Record a walkthrough', 'Your screen and your face, 3 to 5 minutes. Or start from Buddy’s template script.'],
  ['🗺', 'sage', 'Pick the stage', 'Choose where it appears and for which roles. New hires see it on that day.'],
];

export default function Apps() {
  const { data } = useApi<AppsData>('/api/admin/apps');
  const navigate = useNavigate();
  const [connecting, setConnecting] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  if (!data) return <main className="panel"><div className="loading">Loading your apps…</div></main>;

  const connect = async (a: AppInfo) => {
    setConnecting(a.key); setErr(null);
    try {
      await api.post(`/api/admin/apps/${a.key}/connect`);
      navigate(`/admin/apps/${a.key}`);
    } catch (e) {
      setErr((e as ApiError).message);
      setConnecting(null);
    }
  };
  const allVideos = data.connected.flatMap((c) => c.videos);
  const toRecord = allVideos.filter((v) => v.status === 'missing').length;
  const stale = allVideos.filter((v) => v.status === 'needs_update').length;

  const aside = (
    <>
      <div className="section ad-tips">
        <Caps>Recording a walkthrough</Caps>
        <div className="col">
          {[['🖥', 'Your screen and your face', 'Record in the browser. Nothing to install.'], ['💬', 'Captions and chapters', 'Added for you, so people can skim.'], ['🔁', 'Re-record any time', 'Update the video when the tool changes. Progress carries over.']].map(([e, t, b], i) => (
            <div key={t} className="ad-row"><EmojiTile emoji={e} tint={['sky', 'butter', 'peach'][i]} size={32} /><div className="col"><span className="t-h-m">{t}</span><span className="t-label muted">{b}</span></div></div>
          ))}
        </div>
      </div>
      <Hairline />
      <div className="section">
        <Caps>Your library</Caps>
        <div className="row"><span className="ad-dot sky" aria-hidden /><span className="t-body grow">Apps connected</span><span className="ad-stat">{data.connected.length}</span></div>
        <div className="row"><span className="ad-dot sky" aria-hidden /><span className="t-body grow">Walkthrough videos</span><span className="ad-stat">{allVideos.length - toRecord}</span></div>
        <div className="row"><span className="ad-dot gold" aria-hidden /><span className="t-body grow">Still to record</span><span className="ad-stat">{toRecord}</span></div>
        {stale > 0 && <div className="row"><span className="ad-dot gold" aria-hidden /><span className="t-body grow">Needs an update</span><span className="ad-stat">{stale}</span></div>}
      </div>
      <Hairline />
      <div className="section">
        <Caps>What new hires see</Caps>
        <p className="t-body">Only the walkthrough and a link to open the app. Connecting doesn’t give new hires access; IT still sets up their accounts.</p>
      </div>
    </>
  );

  return (
    <Page admin crumbs={[{ label: 'Admin', to: '/admin' }, { label: 'Connected apps' }]} kicker="Admin · Connected apps"
      title={<>The tools your team <em>actually uses.</em></>}
      lede="Connect an app once. It becomes a section in the stage you choose, with a recorded walkthrough of how your team uses it." aside={aside}>
      <div className="hero-card">
        <Caps className="gold">How it works</Caps>
        <div className="ad-steps">
          {STEPS.map(([e, tint, t, b], i) => (
            <div key={t} className="ad-step">
              <div className="row gap-10"><EmojiTile emoji={e} tint={tint} size={32} /><span className="num">0{i + 1}</span></div>
              <span className="t-h-m17">{t}</span>
              <span className="t-label muted">{b}</span>
            </div>
          ))}
        </div>
      </div>

      <section className="section">
        <Caps>Connected · {data.connected.length}</Caps>
        {data.connected.length ? (
          <div className="ad-rows" style={{ borderTop: '1px solid var(--border-default)' }}>
            {data.connected.map((c) => {
              const w = walkthroughState(c);
              const go = () => navigate(`/admin/apps/${c.app.key}`);
              return (
                <div key={c.app.key} className="ad-app-row ad-row click" role="link" tabIndex={0} onClick={go} onKeyDown={(e) => e.key === 'Enter' && go()} aria-label={`Open ${c.app.name}`}>
                  <div className="who"><LogoTile app={c.app} size={44} /><div className="col" style={{ minWidth: 0 }}><span className="t-h-m17">{c.app.name}</span><span className="t-label muted">{c.app.category}</span></div></div>
                  <div className="col" style={{ minWidth: 0 }}><span className="t-body">{c.stage ? c.stage.name : 'No stage yet'}</span><span className="t-label muted">{c.roles}</span></div>
                  <div className="col gap-4" style={{ minWidth: 0, alignItems: 'flex-start' }}><Pill tone={w.tone}>{w.label}</Pill><span className="t-label muted">{w.sub}</span></div>
                  <span className="ad-chev"><Chevron /></span>
                </div>
              );
            })}
          </div>
        ) : <p className="t-body muted">Nothing connected yet. Start with the app your team opens first every morning.</p>}
      </section>

      <section className="section">
        <Caps>Available to connect</Caps>
        {err && <Alert tone="error" title="Couldn’t connect">{err}</Alert>}
        {data.available.length ? (
          <div className="ad-rows" style={{ borderTop: '1px solid var(--border-default)' }}>
            {data.available.map((a) => (
              <div key={a.key} className="ad-row">
                <LogoTile app={a} size={44} />
                <div className="grow col"><span className="t-h-m17">{a.name} · {a.category}</span><span className="t-label muted">Adds a walkthrough section to the stage you pick</span></div>
                <Button variant="outline" loading={connecting === a.key} disabled={!!connecting && connecting !== a.key} onClick={() => connect(a)}>Connect</Button>
              </div>
            ))}
          </div>
        ) : <p className="t-body muted">Every supported app is connected.</p>}
      </section>
    </Page>
  );
}
