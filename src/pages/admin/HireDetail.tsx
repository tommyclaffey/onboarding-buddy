// One new hire, seen by People Ops: what they're on right now (the one hero), the current stage's tasks
// grouped by owner (People Ops can tick any), paperwork deadlines, and an aside with profile and mood.
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, ApiError } from '../../api';
import { Page } from '../../components/Shell';
import { TaskRowCompact } from '../../components/Rows';
import { Alert, Avatar, Button, Caps, Hairline, Pill, useToast } from '../../components/ui';
import { dayDate, dueLabel, lateLabel, longDate, relTime, shortDate, todayIso } from '../../lib/format';
import type { Person, Task } from '../../lib/types';
import { useApi } from '../../lib/useApi';
import { FEELING_WORDS, FEELINGS, InviteOutcome, Note, type InviteResult } from './kit';
import { sendNudge } from './Overview';

interface Paper { label: string; detail: string; due?: string | null; status: string }
interface HireData {
  hire: Person & { email: string; title?: string; team?: string; startDate: string; manager: Person | null; buddy: Person | null };
  summary: { status: { tone: string; label: string } };
  now: Task | null;
  stage: { name: string; done: number; total: number };
  byOwner: { role: string; label: string; person: Person | null; done: number; tasks: Task[] }[];
  paperwork: Paper[];
  feeling: { value: number; created_at: string } | null;
  activity: { at: string; text: string }[];
  videos: { done: number; total: number };
  invite: { state: 'accepted' | 'sent' | 'not_sent' | 'expired'; sentAt?: string | null; via?: string | null };
  checkins?: { title: string; at: string | null; rating: string; notes: string; by: { name: string; first: string } | null }[];
}

const PAPER_TONE: Record<string, 'success' | 'sky' | 'warning' | undefined> = { Done: 'success', Scheduled: 'sky', 'In progress': 'warning', Automatic: 'sky' };

export default function HireDetail() {
  const { id } = useParams();
  const { data, error, reload } = useApi<HireData>(`/api/admin/hires/${id}`);
  const toast = useToast();
  const [notice, setNotice] = useState<{ tone: 'warning' | 'error'; title: string; msg: string } | null>(null);
  const [nudging, setNudging] = useState(false);
  const [composing, setComposing] = useState(false);
  const [msg, setMsg] = useState('');
  const [msgError, setMsgError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [invited, setInvited] = useState<InviteResult | null>(null);

  if (error) return <Page admin crumbs={[{ label: 'Admin', to: '/admin' }, { label: 'New hire' }]} title="We couldn’t find that person."><Alert tone="error" title="Not found">{error.message}</Alert></Page>;
  if (!data) return <main className="panel"><div className="loading">Loading…</div></main>;
  const { hire, now } = data;
  const behind = data.summary.status.tone === 'danger';

  const toggle = async (t: Task, done: boolean) => {
    try {
      await api.post(`/api/tasks/${t.id}/${done ? 'complete' : 'undo'}`);
      await reload();
      if (done) toast(`${t.title}: done.`, { label: 'Undo', run: async () => { await api.post(`/api/tasks/${t.id}/undo`); reload(); } });
    } catch (e) {
      setNotice({ tone: 'error', title: 'That didn’t save', msg: (e as ApiError).message });
    }
  };
  const resend = async () => {
    setInviting(true); setNotice(null); setInvited(null);
    try { const r = await api.post<{ invite: InviteResult }>(`/api/admin/hires/${hire.id}/invite`); setInvited(r.invite); await reload(); }
    catch (e) { setNotice({ tone: 'error', title: 'Invite not sent', msg: (e as ApiError).message }); }
    finally { setInviting(false); }
  };
  const VIA: Record<string, string> = { google: 'Google', microsoft: 'Microsoft', smtp: 'company email', app: 'Onboarding Buddy' };
  const inv = data.invite;
  const inviteLine = inv.state === 'accepted' ? '✓ Account set up'
    : inv.state === 'sent' ? `Invite sent ${relTime(inv.sentAt!)}${inv.via ? ` via ${VIA[inv.via] || inv.via}` : ''}`
    : inv.state === 'expired' ? 'Invite link expired' : 'Invite not emailed yet';
  const nudge = async () => {
    setNudging(true); setNotice(null);
    const r = await sendNudge(hire.id);
    setNudging(false);
    if (r.ok) toast(r.message); else setNotice({ tone: 'warning', title: 'Nudge not sent', msg: r.message });
  };
  const send = async () => {
    setSending(true); setMsgError(null);
    try {
      const r = await api.post<{ ok: boolean; to: string }>('/api/messages', { toId: hire.id, body: msg });
      toast(`Message sent to ${r.to}.`);
      setMsg(''); setComposing(false);
    } catch (e) {
      setMsgError((e as ApiError).message);
    } finally {
      setSending(false);
    }
  };

  const lastActive = data.activity[0]?.at;
  const nowLine = now ? [
    now.overdue ? `Due ${shortDate(now.dueDate)}, ${lateLabel(now.dueDate)}` : now.dueToday ? 'Due today' : `Due ${dueLabel(now.dueDate) === 'Tomorrow' ? 'tomorrow' : dayDate(now.dueDate)}`,
    lastActive ? `last active ${relTime(lastActive)}` : null,
    `${data.stage.done} of ${data.stage.total} ${data.stage.name} tasks done`,
  ].filter(Boolean).join(' · ') : `${data.stage.done} of ${data.stage.total} ${data.stage.name} tasks done`;

  const feeling = data.feeling;
  const aside = (
    <>
      <div className="section">
        <Caps>Profile</Caps>
        <dl className="ad-kv">
          <dt>Role</dt><dd>{hire.title || '—'}</dd>
          <dt>Team</dt><dd>{hire.team || '—'}</dd>
          <dt>Starts</dt><dd>{dayDate(hire.startDate)} · 9:00 AM</dd>
          <dt>Manager</dt><dd>{hire.manager?.name || 'Not set'}</dd>
          <dt>Buddy</dt><dd>{hire.buddy?.name || 'Not set'}</dd>
          <dt>Account</dt><dd><span className={inv.state === 'accepted' ? 'success strong' : inv.state === 'sent' ? '' : 'danger strong'}>{inviteLine}</span></dd>
        </dl>
        {inv.state !== 'accepted' && <div><Button size="sm" variant="outline" loading={inviting} onClick={resend}>{inv.state === 'not_sent' ? 'Send invite' : 'Send a new invite'}</Button></div>}
        {invited && <InviteOutcome first={hire.first} email={hire.email} invite={invited} />}
      </div>
      <Hairline />
      <div className="section">
        <div className="section-head"><Caps>Videos watched</Caps><span className="t-mono muted">{data.videos.done} / {data.videos.total}</span></div>
        <div className="track"><i style={{ width: `${data.videos.total ? (data.videos.done / data.videos.total) * 100 : 0}%` }} /></div>
        <p className="t-label muted">Stage intros, lessons and app walkthroughs across the journey.</p>
      </div>
      <Hairline />
      <div className="section">
        <Caps>How {hire.first}’s feeling</Caps>
        {feeling ? (
          <p className="t-body row gap-8"><span aria-hidden style={{ fontSize: 20 }}>{FEELINGS[feeling.value - 1]}</span><span><b>{FEELING_WORDS[feeling.value - 1]}</b> · checked in {feeling.created_at.slice(0, 10) === todayIso() ? 'today' : relTime(feeling.created_at)}</span></p>
        ) : <p className="t-body muted">No check-in yet.</p>}
        <p className="t-label muted">🔒 Only People Ops sees this.</p>
      </div>
      {!!data.checkins?.length && (<>
        <Hairline />
        <div className="section">
          <Caps>Manager check-ins</Caps>
          {data.checkins.map((c, i) => (
            <div key={i} className="col gap-2">
              <p className="t-body"><b>{c.title}</b> · <span className={c.rating === 'struggling' ? 'danger strong' : c.rating === 'support' ? 'gold strong' : 'success strong'}>{c.rating === 'on_track' ? 'On track' : c.rating === 'support' ? 'Needs a bit of support' : 'Struggling'}</span></p>
              {c.notes && <p className="t-label muted">“{c.notes}”{c.by ? ` · ${c.by.first}` : ''}</p>}
            </div>
          ))}
        </div>
      </>)}
      <Hairline />
      <div className="section">
        <Caps>Recent activity</Caps>
        {data.activity.length ? (
          <div className="ad-activity">
            {data.activity.map((a, i) => [
              <span key={`t${i}`} className="t-mono muted">{a.at.slice(0, 10) === todayIso() ? `Today ${new Date(a.at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}` : shortDate(a.at)}</span>,
              <span key={`x${i}`} className="t-body">{a.text}</span>,
            ])}
          </div>
        ) : <p className="t-body muted">Nothing done yet.</p>}
      </div>
    </>
  );

  return (
    <Page admin crumbs={[{ label: 'Admin', to: '/admin' }, { label: 'New hires', to: '/admin' }, { label: hire.name }]}
      kicker={`Admin · New hires · ${hire.name}`}
      title={behind ? <>{hire.first} <em>needs a nudge.</em></> : <>{hire.first} is <em>on track.</em></>}
      lede={<>{[hire.title, `starts ${longDate(hire.startDate)}`, hire.manager && `manager ${hire.manager.name}`, hire.buddy && `buddy ${hire.buddy.name}`].filter(Boolean).join(' · ')}. Every task below has one owner, so nothing falls between people.</>}
      aside={aside}>
      <div className="hero-card">
        <div className="row top gap-16">
          <Avatar person={hire} size={56} />
          <div className="grow col gap-4">
            <Caps className="gold">Right now</Caps>
            <h2 className="t-h-l">{now ? now.title : `Nothing waiting on ${hire.first}`}</h2>
            <p className={`t-label ${now?.overdue ? 'danger' : 'muted'}`}>{nowLine}</p>
            <div className="row gap-12 mt-16 wrap">
              <Button variant="outline" loading={nudging} onClick={nudge} disabled={!now}>Send a nudge</Button>
              <Button arrow onClick={() => { setComposing(!composing); setMsgError(null); }} aria-expanded={composing}>Message {hire.first}</Button>
            </div>
            {composing && (
              <div className={`ad-compose ${msgError ? 'error' : ''}`}>
                <label className="t-label" htmlFor="compose">Message to {hire.first}. It lands in their Inbox.</label>
                <textarea id="compose" value={msg} onChange={(e) => { setMsg(e.target.value); setMsgError(null); }} placeholder={`Hi ${hire.first}, just checking in…`} aria-invalid={!!msgError} aria-describedby={msgError ? 'compose-h' : undefined} autoFocus />
                {msgError && <span id="compose-h" className="t-label danger">{msgError}</span>}
                <div className="row gap-12"><Button size="sm" loading={sending} onClick={send}>Send</Button><Button size="sm" variant="outline" onClick={() => setComposing(false)}>Cancel</Button></div>
              </div>
            )}
            {notice && <div className="mt-16"><Alert tone={notice.tone} title={notice.title}>{notice.msg}</Alert></div>}
          </div>
        </div>
      </div>

      <section className="section">
        <div className="section-head"><Caps>{data.stage.name} stage · tasks by owner</Caps><span className="t-mono muted">{data.stage.done} of {data.stage.total} done</span></div>
        <div className="ad-rows" style={{ borderTop: '1px solid var(--border-default)' }}>
          {data.byOwner.map((g) => (
            <div key={g.role} className="ad-owner">
              <div className="who">
                <Avatar person={g.person} size={32} />
                <div className="col" style={{ minWidth: 0 }}><span className="t-h-m">{g.person?.name ?? g.label}</span><span className="t-label muted">{g.label} · {g.done}/{g.tasks.length}</span></div>
              </div>
              <div className="col">
                {g.tasks.map((t) => <TaskRowCompact key={t.id} task={t} onToggle={(v) => toggle(t, v)} />)}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <Caps>Paperwork and deadlines</Caps>
        <table className="table ad-table">
          <thead><tr><th>Item</th><th>Due</th><th>Status</th></tr></thead>
          <tbody>
            {data.paperwork.map((p) => {
              const late = p.due && p.due < todayIso() && !['Done', 'Automatic'].includes(p.status);
              return (
                <tr key={p.label}>
                  <td><div className="col"><span className="t-h-m">{p.label}</span><span className="t-label muted">{p.detail}</span></div></td>
                  <td className={`mono ${late ? 'danger' : ''}`}>{p.status === 'Done' ? 'Done' : p.due ? (p.due === todayIso() ? 'Due today' : `Due ${dayDate(p.due)}`) : '—'}</td>
                  <td>{late ? <Pill tone="danger">Overdue · {lateLabel(p.due!)}</Pill> : <Pill tone={PAPER_TONE[p.status]}>{p.status}</Pill>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <Note>Dates follow federal rules. Check your state’s new-hire reporting deadline.</Note>
      </section>
    </Page>
  );
}
