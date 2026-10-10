// The standard admin app page. Every connected app gets this layout: status (the one hero), where it shows up,
// walkthrough videos, and "Your version" (Try it now + house rules) which is edited here and saved to the server.
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../../api';
import { useAuth } from '../../auth';
import { Page } from '../../components/Shell';
import { Alert, Avatar, Button, Caps, Hairline, Logo, LogoTile, TextField, useToast } from '../../components/ui';
import { mmss, shortDate } from '../../lib/format';
import { useApi } from '../../lib/useApi';
import type { ConnectedApp } from './Apps';
import { SelectField } from './kit';

interface AppDetailData extends ConnectedApp { stages: { id: number; name: string }[] }
type Rule = { emoji: string; title: string; body: string };
const MAX_TRY = 5;
const VSTATUS: Record<string, string> = { published: 'Published', needs_update: 'Needs update', missing: 'Not recorded yet' };

export default function AppDetail() {
  const { key } = useParams();
  const { data, error, setData, reload } = useApi<AppDetailData>(`/api/admin/apps/${key}`);
  const { org } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [tryItems, setTryItems] = useState<string[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<{ msg: string; field?: string } | null>(null);
  const [stageError, setStageError] = useState<string | null>(null);
  const [linkFor, setLinkFor] = useState<number | 'new' | null>(null);
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkErr, setLinkErr] = useState<{ msg: string; field?: string } | null>(null);
  const [linkBusy, setLinkBusy] = useState(false);

  useEffect(() => { if (data) { setTryItems(data.tryItems); setRules(data.houseRules); } }, [data?.app.key]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <Page admin crumbs={[{ label: 'Admin', to: '/admin' }, { label: 'Connected apps', to: '/admin/apps' }, { label: 'App' }]} title="That app isn’t connected."><Alert tone="error" title="Not found">{error.message}</Alert></Page>;
  if (!data) return <main className="panel"><div className="loading">Loading…</div></main>;
  const { app, status } = data;
  const company = org?.name ?? 'your team';
  const dirty = JSON.stringify(tryItems) !== JSON.stringify(data.tryItems) || JSON.stringify(rules) !== JSON.stringify(data.houseRules);
  const soon = () => toast('In-browser recording isn’t built yet. For now, record with Loom (screen + face) and paste the link.');
  const openLink = (target: number | 'new') => { setLinkFor(target); setLinkUrl(''); setLinkTitle(''); setLinkErr(null); };
  const heroAction = () => {
    const v = data.videos.find((x) => x.status === 'missing') || data.videos.find((x) => x.status === 'needs_update');
    openLink(v ? v.id : 'new');
  };
  const submitLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLinkBusy(true); setLinkErr(null);
    try {
      if (linkFor === 'new') await api.post(`/api/admin/apps/${app.key}/videos`, { title: linkTitle, url: linkUrl });
      else await api.post(`/api/admin/videos/${linkFor}/link`, { url: linkUrl });
      setLinkFor(null);
      await reload();
      toast('Published. New hires can watch it now.');
    } catch (err) {
      const ae = err as ApiError;
      setLinkErr({ msg: ae.message, field: ae.data?.field as string | undefined });
    } finally {
      setLinkBusy(false);
    }
  };
  const linkTarget = typeof linkFor === 'number' ? data.videos.find((v) => v.id === linkFor) : null;

  const moveStage = async (stageId: number) => {
    setStageError(null);
    try {
      const r = await api.patch<ConnectedApp>(`/api/admin/apps/${app.key}`, { stageId });
      setData({ ...data, ...r });
      toast(`${app.name} now shows up in ${r.stage?.name}.`);
    } catch (e) {
      setStageError((e as ApiError).message);
    }
  };
  const save = async () => {
    setSaving(true); setSaveError(null);
    try {
      const r = await api.patch<ConnectedApp>(`/api/admin/apps/${app.key}`, { tryItems, houseRules: rules });
      setData({ ...data, ...r });
      setTryItems(r.tryItems); setRules(r.houseRules);
      toast('Saved. New hires see it now.');
    } catch (e) {
      const ae = e as ApiError;
      setSaveError({ msg: ae.message, field: ae.data?.field as string | undefined });
    } finally {
      setSaving(false);
    }
  };
  const setTry = (i: number, v: string) => { setTryItems(tryItems.map((t, j) => (j === i ? v : t))); setSaveError(null); };
  const setRule = (i: number, k: keyof Rule, v: string) => { setRules(rules.map((r, j) => (j === i ? { ...r, [k]: v } : r))); setSaveError(null); };

  const aside = (
    <>
      <div className="section">
        <Caps>Connection</Caps>
        <p className="t-body row gap-8"><span className="ad-dot ok" aria-hidden />Connected · {company} workspace</p>
        <p className="t-label muted">Connected{data.connectedBy ? ` by ${data.connectedBy.name}` : ''}{data.connectedAt ? ` on ${shortDate(data.connectedAt)}` : ''}</p>
      </div>
      <Hairline />
      <div className="section">
        <Caps>New hires</Caps>
        <p className="t-h-m">{data.finished.total ? `${data.finished.done} of ${data.finished.total} new hires finished it` : 'No new hires have it yet'}</p>
        {data.finished.total > 0 && <div className="track"><i style={{ width: `${(data.finished.done / data.finished.total) * 100}%` }} /></div>}
      </div>
      <Hairline />
      <div className="section">
        <Caps>Walkthrough owner</Caps>
        {data.owner ? (
          <div className="row gap-10"><Avatar person={data.owner} size={36} /><div className="col"><span className="t-h-m">{data.owner.name}</span><span className="t-label muted">Gets a nudge when a video goes out of date</span></div></div>
        ) : <p className="t-body muted">No owner yet.</p>}
      </div>
      <Hairline />
      <div className="section">
        <Caps>About the template</Caps>
        <p className="t-body">Every connected app gets this same page. New hires see video, chapters, Try it now and your house rules, in that order, for every tool.</p>
        <button className="link-btn danger" style={{ alignSelf: 'flex-start' }} onClick={() => toast('Disconnecting isn’t built yet, so nothing was changed. Ask Tommy to remove it for now.')}>Disconnect app</button>
      </div>
    </>
  );

  return (
    <Page admin crumbs={[{ label: 'Admin', to: '/admin' }, { label: 'Connected apps', to: '/admin/apps' }, { label: app.name }]}
      kicker={<span className="row gap-8"><Logo app={app} size={16} />Admin · Connected app · {app.category}</span>}
      title={<>{app.name}, the <em>{company}</em> way.</>}
      lede="This page runs on the standard app template. The layout is shared by every app; the videos, checklist and house rules below are yours to edit."
      aside={aside}>
      <div className="hero-card">
        <div className="row top gap-20">
          <LogoTile app={app} size={56} />
          <div className="grow col gap-6">
            <Caps className="gold">{status.label}</Caps>
            <h2 className="t-h-l">{status.line}</h2>
            <div className="row gap-12 mt-8 wrap">
              <Button arrow onClick={heroAction}>{status.action}</Button>
              <Button variant="outline" arrow onClick={() => navigate(`/apps/${app.key}`)}>Preview as a new hire</Button>
            </div>
          </div>
        </div>
      </div>

      <section className="section">
        <Caps>Where it shows up</Caps>
        <div className="ad-rows" style={{ borderTop: '1px solid var(--border-default)', borderBottom: '1px solid var(--border-default)' }}>
          <div className="ad-where">
            <label className="t-label muted" htmlFor="app-stage">Stage</label>
            <SelectField id="app-stage" label="" className="ad-inline-select" value={data.stage?.id ?? ''} onChange={(e) => moveStage(Number(e.target.value))} error={stageError}>
              {!data.stage && <option value="">Pick a stage</option>}
              {data.stages.map((s, i) => <option key={s.id} value={s.id}>Stage {i + 1} · {s.name}</option>)}
            </SelectField>
          </div>
          <div className="ad-where"><span className="t-label muted">Who sees it</span><span className="t-body">{data.roles}</span></div>
          <div className="ad-where"><span className="t-label muted">Unlocks</span><span className="t-body">When the stage opens for each new hire</span></div>
        </div>
      </section>

      <section className="section">
        <Caps>Walkthrough videos</Caps>
        <p className="t-body muted">Recorded in the browser: your screen plus your face.</p>
        <div className="row gap-12 wrap">
          <Button onClick={soon}>Record in browser</Button>
          <Button variant="outline" onClick={() => openLink('new')}>Paste a Loom or YouTube link</Button>
        </div>
        {linkFor !== null && (
          <form className="card col gap-12" style={{ padding: 20 }} onSubmit={submitLink} noValidate>
            <p className="t-h-m">{linkTarget ? `Add the video for “${linkTarget.title}”` : 'Add a new walkthrough video'}</p>
            {linkFor === 'new' && <TextField label="Video title" placeholder="Getting around Slack" value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} error={linkErr?.field === 'title' ? linkErr.msg : null} />}
            <TextField label="Link" placeholder="https://www.loom.com/share/…" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)}
              help="YouTube, Loom or Vimeo. Unlisted links work too." error={linkErr?.field === 'url' ? linkErr.msg : null} />
            {linkErr && !linkErr.field && <Alert tone="error" title="That didn’t publish">{linkErr.msg}</Alert>}
            <div className="row gap-12"><Button type="submit" loading={linkBusy}>Publish video</Button><Button type="button" variant="outline" onClick={() => setLinkFor(null)}>Cancel</Button></div>
          </form>
        )}
        <p className="t-label muted">Cover card, captions and chapters are made for you.</p>
        {data.videos.length ? (
          <div className="ad-rows" style={{ borderBottom: '1px solid var(--border-default)' }}>
            {data.videos.map((v) => {
              const missing = v.status === 'missing';
              return (
                <div key={v.id} className="ad-row">
                  {missing ? <span className="ad-vthumb missing" aria-hidden><i /></span>
                    : <span className={`ad-vthumb tint-${app.tint}`}><LogoTile app={app} size={26} radius={7} /></span>}
                  <div className="grow col">
                    <span className="t-h-m">{v.title}</span>
                    <span className={`t-label ${missing ? 'danger' : v.status === 'needs_update' ? 'gold' : 'muted'}`}>
                      {[missing ? null : mmss(v.durationSec), v.presenter?.first, VSTATUS[v.status], v.status === 'needs_update' && v.flagged ? `${v.flagged} ${v.flagged === 1 ? 'person' : 'people'} flagged it` : null].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                  <button className="link-btn" onClick={() => openLink(v.id)}>{missing ? 'Add video' : v.url ? 'Replace link' : 'Replace'}</button>
                </div>
              );
            })}
          </div>
        ) : <p className="t-body muted">No videos yet. Record the first one to publish this walkthrough.</p>}
      </section>

      <section className="section">
        <Caps>Your version</Caps>
        <p className="t-body muted">What new hires check off, and how your team uses it. Everything else comes from the template.</p>
        <div className="col gap-12">
          {tryItems.map((t, i) => (
            <div key={i} className="ad-try">
              <TextField id={`try-${i}`} label={`Try it now · ${i + 1}`} value={t} onChange={(e) => setTry(i, e.target.value)} maxLength={120}
                error={saveError?.field === 'tryItems' && i === 0 ? saveError.msg : null} />
              <button className="link-btn danger" onClick={() => setTryItems(tryItems.filter((_, j) => j !== i))} aria-label={`Remove Try it now item ${i + 1}`}>Remove</button>
            </div>
          ))}
          {!tryItems.length && <p className={`t-label ${saveError?.field === 'tryItems' ? 'danger' : 'muted'}`}>{saveError?.field === 'tryItems' ? saveError.msg : 'No Try it now items. Add at least one.'}</p>}
          <button className="link-btn" style={{ alignSelf: 'flex-start' }} disabled={tryItems.length >= MAX_TRY} onClick={() => setTryItems([...tryItems, ''])}>
            {tryItems.length >= MAX_TRY ? `5 items is the limit` : '+ Add a Try it now item'}
          </button>
        </div>

        <p className="t-h-m mt-16">House rules</p>
        <div className="ad-rows" style={{ borderTop: '1px solid var(--border-default)', borderBottom: '1px solid var(--border-default)' }}>
          {rules.map((r, i) => (
            <div key={i} className="ad-rule">
              <div className="top">
                <div className="emoji"><TextField id={`rule-${i}-emoji`} label="Emoji" value={r.emoji} onChange={(e) => setRule(i, 'emoji', e.target.value)} maxLength={8} /></div>
                <div className="grow"><TextField id={`rule-${i}-title`} label={`Rule ${i + 1}`} value={r.title} onChange={(e) => setRule(i, 'title', e.target.value)} maxLength={80} /></div>
                <button className="link-btn danger" onClick={() => setRules(rules.filter((_, j) => j !== i))} aria-label={`Remove house rule ${i + 1}`}>Remove</button>
              </div>
              <TextField id={`rule-${i}-body`} label="What it means" value={r.body} onChange={(e) => setRule(i, 'body', e.target.value)} maxLength={200} />
            </div>
          ))}
          {!rules.length && <p className="t-body muted" style={{ padding: '14px 0' }}>No house rules yet.</p>}
        </div>
        <button className="link-btn" style={{ alignSelf: 'flex-start' }} onClick={() => setRules([...rules, { emoji: '💡', title: '', body: '' }])}>+ Add a house rule</button>

        {saveError && !saveError.field && <Alert tone="error" title="That didn’t save">{saveError.msg}</Alert>}
        {saveError?.field && <Alert tone="error" title="One thing to fix">{saveError.msg}</Alert>}
        <div className="ad-save">
          <span className="t-label muted grow">{dirty ? 'You have unsaved changes.' : 'Everything is saved.'}</span>
          {dirty && <Button size="sm" variant="outline" onClick={() => { setTryItems(data.tryItems); setRules(data.houseRules); setSaveError(null); }}>Undo changes</Button>}
          <Button size="sm" loading={saving} disabled={!dirty} onClick={save}>Save</Button>
        </div>
      </section>
    </Page>
  );
}
