// My journey: a vertical timeline of every stage. The current stage is the one hero card (yellow);
// the rest are open StageCards on the rail. Aside: milestones, the 30-60-90 plan, and who to ask.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../../api';
import { Page } from '../../components/Shell';
import { StageCard, TaskRow } from '../../components/Rows';
import { VideoPlayer } from '../../components/Video';
import { Avatar, Button, Caps, Hairline, PlayIcon, useToast } from '../../components/ui';
import { dayDate, mins, shortDate } from '../../lib/format';
import type { Person, Stage, Task, Video } from '../../lib/types';
import { useApi } from '../../lib/useApi';
import { openTask } from './Today';
import '../../styles/hire-discovery.css';

interface JourneyData { startDate: string; stages: Stage[] }

/* ---------- small helpers shared with the other discovery screens ---------- */
export const addDaysIso = (iso: string, n: number) => {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
/** "MON OCT 19" */
export const monoDate = (iso?: string | null) => dayDate(iso).replace(',', '').toUpperCase();
export const numWord = (n: number) => String(n); // Tommy’s rule: numerals, never number words
/** The person who owns tasks of a role in this journey (e.g. People Ops), read from the task list. */
export const ownerOfRole = (tasks: Task[], role: Task['ownerRole']): Person | null => tasks.find((t) => t.ownerRole === role && t.owner)?.owner || null;

/** A video in a centred overlay. Escape or the Close button dismisses it. */
export function VideoModal({ video, onClose }: { video: Video | null; onClose: () => void }) {
  useEffect(() => {
    if (!video) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [video, onClose]);
  if (!video) return null;
  return (
    <div className="ob-modal" role="dialog" aria-modal="true" aria-label={video.title} onClick={onClose}>
      <div className="m-inner" onClick={(e) => e.stopPropagation()}>
        <button className="m-close" onClick={onClose} autoFocus>Close</button>
        <VideoPlayer video={video} kicker={mins(video.durationSec)} />
      </div>
    </div>
  );
}

/** Inline compose box: prefilled "Hi {first}! ", POST /api/messages, toast on success, server error under the field. */
export function MessageCompose({ to, onClose, label, prefill }: { to: Person; onClose: () => void; label?: string; prefill?: string }) {
  const toast = useToast();
  const [body, setBody] = useState(prefill ?? `Hi ${to.first}! `);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fid = `msg-${to.id}`;
  const send = async () => {
    setBusy(true); setError(null);
    try {
      await api.post('/api/messages', { toId: to.id, body });
      toast(`Sent to ${to.first}. You’ll see replies in your Inbox.`);
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'That didn’t send. Try again.');
    } finally { setBusy(false); }
  };
  return (
    <form className={`field compose ${error ? 'error' : ''}`} onSubmit={(e) => { e.preventDefault(); send(); }}>
      <label htmlFor={fid}>{label || `Message to ${to.first}`}</label>
      <textarea id={fid} rows={3} value={body} autoFocus aria-invalid={!!error} aria-describedby={error ? fid + '-h' : undefined}
        onChange={(e) => setBody(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') onClose(); if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send(); }} />
      {error && <span className="help" id={fid + '-h'} role="alert">{error}</span>}
      <div className="row gap-12">
        <Button size="sm" loading={busy} type="submit">Send</Button>
        <button type="button" className="link-btn" onClick={onClose}>Cancel</button>
      </div>
    </form>
  );
}

/** "Message {first}" link that opens the compose box in place. */
export function MessageLink({ to, text }: { to: Person | null; text?: string }) {
  const [open, setOpen] = useState(false);
  if (!to) return null;
  return open ? <MessageCompose to={to} onClose={() => setOpen(false)} />
    : <button type="button" className="link-btn" style={{ alignSelf: 'flex-start' }} onClick={() => setOpen(true)}>{text || `Message ${to.first}`}</button>;
}

/** Date column: "OCT 19", "OCT 20–24", or "NOV 18 →" for long stages. */
function dateLabel(s: Stage) {
  const start = s.opens;
  const ends = s.tasks.filter((t) => t.ownerRole === 'hire').map((t) => t.dueDate).sort();
  const end = ends.length ? ends[ends.length - 1] : start;
  const span = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 864e5);
  const a = shortDate(start).toUpperCase();
  if (span > 14) return `${a} →`;
  if (span >= 1) {
    const b = shortDate(end).toUpperCase();
    return a.slice(0, 3) === b.slice(0, 3) ? `${a}–${b.slice(4)}` : `${a}–${b}`;
  }
  return a;
}

export default function Journey() {
  const { data, reload } = useApi<JourneyData>('/api/journey');
  const navigate = useNavigate();
  const toast = useToast();
  const [playing, setPlaying] = useState<Video | null>(null);
  if (!data) return <main className="panel"><div className="loading">Loading your journey…</div></main>;

  const stages = data.stages;
  const current = stages.find((s) => s.state === 'current') || stages[stages.length - 1];
  const all = stages.flatMap((s) => s.tasks);
  const peopleOps = ownerOfRole(all, 'people_ops');
  const manager = ownerOfRole(all, 'manager');
  const mine = current.tasks.filter((t) => t.ownerRole === 'hire');
  const open = mine.filter((t) => t.status !== 'done');
  const doneMine = mine.filter((t) => t.status === 'done');
  const pct = current.total ? Math.round((current.done / current.total) * 100) : 0;
  const introTask = current.intro ? current.tasks.find((t) => t.type === 'video' && t.ref === String(current.intro!.id)) : null;
  const watched = introTask?.status === 'done';
  const plan = all.find((t) => t.ownerRole === 'manager' && /30-60-90/.test(t.title));

  const toggle = async (t: Task, done: boolean) => {
    await api.post(`/api/tasks/${t.id}/${done ? 'complete' : 'undo'}`);
    await reload();
    if (done) toast(`${t.title}: done.`, { label: 'Undo', run: async () => { await api.post(`/api/tasks/${t.id}/undo`); reload(); } });
  };

  const milestones = [
    { label: 'Day One', iso: data.startDate, color: 'var(--bg-sky)' },
    { label: 'Day 30 check-in', iso: addDaysIso(data.startDate, 30), color: 'var(--text-highlight)' },
    { label: 'Day 60 check-in', iso: addDaysIso(data.startDate, 60), color: 'var(--bg-primary)' },
    { label: 'Day 90 review', iso: addDaysIso(data.startDate, 90), color: 'var(--text-success)' },
  ];

  const aside = (
    <>
      <section className="section">
        <Caps>Milestones</Caps>
        <div className="col gap-12">
          {milestones.map((m) => (
            <div key={m.label} className="milestone">
              <span className="m-dot" style={{ background: m.color }} aria-hidden />
              <span className="t-body">{m.label}</span>
              <span className="t-mono muted">{monoDate(m.iso)}</span>
            </div>
          ))}
        </div>
      </section>
      <Hairline />
      <section className="section">
        <Caps>Your 30-60-90 plan</Caps>
        <div className="col gap-10">
          {[[30, 'Learn the product and ship one small fix.'], [60, 'Own a feature from start to finish.'], [90, 'Lead your first design review.']].map(([n, text]) => (
            <div key={n} className="plan-row"><span className="t-m">{n}</span><span className="t-body">{text}</span></div>
          ))}
        </div>
        {manager && (
          <div className="row gap-8">
            <Avatar person={manager} size={24} />
            <span className="t-label muted">{plan?.status === 'done' ? `Written by ${manager.first}, your manager` : `${manager.first}, your manager, is writing it now`}</span>
          </div>
        )}
      </section>
      <Hairline />
      <section className="section">
        <Caps>Questions about your journey?</Caps>
        <p className="t-body">{peopleOps ? `${peopleOps.first} in People Ops` : 'People Ops'} can walk you through any stage.</p>
        <MessageLink to={peopleOps} />
      </section>
    </>
  );

  return (
    <Page crumbs={[{ label: 'Onboarding' }, { label: 'My journey' }]} kicker="My journey"
      title={<>Your first 90 <em>days.</em></>}
      lede={`${stages.length} stages. You’re in stage ${current.position}. Each stage opens when the last one wraps up.`}
      aside={aside}>
      <div className="timeline">
        {stages.map((s, i) => {
          const isCurrent = s.id === current.id;
          return (
            <div key={s.id} className={`tl-row ${i === stages.length - 1 ? 'last' : ''}`}>
              <span className={`tl-date ${isCurrent ? 'now' : ''}`}>{isCurrent ? 'Now' : dateLabel(s)}</span>
              <span className="tl-rail"><span className={`tl-dot ${s.state}`} aria-hidden /></span>
              <div className="tl-body">
                {isCurrent ? (
                  <div className="hero-card">
                    <div className="row between"><Caps className="gold">Stage {s.position} · You’re here</Caps><span className="t-mono muted">{s.done} of {s.total}</span></div>
                    <h2 className="t-l mt-8"><span aria-hidden>{s.emoji}</span> {s.name}</h2>
                    <p className="t-body mt-8">{s.summary}</p>
                    {s.intro && (
                      <button className="watched-pill mt-16" onClick={() => setPlaying(s.intro)}>
                        <span className="pc"><PlayIcon size={9} color="#fff" /></span>
                        {watched ? `Watched · ${s.intro.title}` : 'Play · stage intro'} · {mins(s.intro.durationSec)}
                      </button>
                    )}
                    <div className="row gap-12 mt-16">
                      <div className="track grow" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${s.name} progress`}><i style={{ width: `${pct}%` }} /></div>
                      <span className="t-mono muted">{pct}%</span>
                    </div>
                    {open.length > 0 && (
                      <div className="card hero-rows mt-16">
                        <div className="row-list">
                          {open.map((t, idx) => <TaskRow key={t.id} task={t} index={idx} onOpen={() => openTask(navigate, t)} onToggle={(v) => toggle(t, v)} />)}
                        </div>
                      </div>
                    )}
                    {doneMine.length > 0 && <p className="t-label muted mt-16"><span className="success strong">✓ {doneMine.length} done:</span> {doneMine.map((t) => t.title).join('  ·  ')}</p>}
                    {open[0] && (
                      <div className="row mt-16" style={{ justifyContent: 'flex-end' }}>
                        <Button arrow onClick={() => openTask(navigate, open[0])}>Continue where you left off</Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <StageCard stage={s} onPlay={() => setPlaying(s.intro)} onApp={(key) => navigate(`/apps/${key}`)} />
                )}
              </div>
            </div>
          );
        })}
      </div>
      <VideoModal video={playing} onClose={() => setPlaying(null)} />
    </Page>
  );
}
