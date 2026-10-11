// People Ops overview: who's starting, what needs People Ops (one yellow hero), the new-hire table,
// and an aside with what's coming up, onboarding health and quick actions (Invite a new hire opens a modal).
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../../api';
import { Page } from '../../components/Shell';
import { Alert, Avatar, Button, Caps, EmojiTile, Hairline, Pill, TextField, useToast } from '../../components/ui';
import { dayDate, longDate, todayIso } from '../../lib/format';
import type { Person } from '../../lib/types';
import { useApi } from '../../lib/useApi';
import { Chevron, countWord, FEELING_WORDS, FEELINGS, humanDates, InviteOutcome, pillTone, SelectField, type InviteResult } from './kit';

interface HireRow extends Person { startDate: string; stage: { name?: string; emoji?: string }; done: number; total: number; status: { tone: string; label: string } }
interface Need { kind: 'i9' | 'nudge' | 'video'; title: string; body: string; hireId?: number; appKey?: string | null; action: string; due?: string }
interface OverviewData {
  hires: HireRow[]; needs: Need[]; upcoming: { date: string; label: string }[];
  health: { ready: number; total: number; mood: number | null };
}

const NEED_ICON: Record<Need['kind'], [string, string]> = { i9: ['🪪', 'peach'], video: ['🎬', 'sky'], nudge: ['📝', 'butter'] };

/** Send a nudge. Returns the outcome so callers can show it as a Toast (sent) or an Alert (refused). */
export async function sendNudge(hireId: number): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  try {
    const r = await api.post<{ ok: boolean; task: string; first: string }>(`/api/admin/hires/${hireId}/nudge`);
    return { ok: true, message: `Nudge sent to ${r.first}: ${r.task}` };
  } catch (e) {
    return { ok: false, message: (e as ApiError).message };
  }
}

export default function Overview() {
  const { data, reload } = useApi<OverviewData>('/api/admin/overview');
  const navigate = useNavigate();
  const toast = useToast();
  const [showAll, setShowAll] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [inviting, setInviting] = useState(false);
  if (!data) return <main className="panel"><div className="loading">Loading the overview…</div></main>;

  const month = todayIso().slice(0, 7);
  const thisMonth = data.hires.filter((h) => h.startDate.slice(0, 7) === month && h.startDate >= todayIso()).length;
  const needs = showAll ? data.needs : data.needs.slice(0, 3);
  const byId = new Map(data.hires.map((h) => [h.id, h]));

  const act = async (n: Need, i: number) => {
    if (n.kind === 'i9' && n.hireId) return navigate(`/admin/hires/${n.hireId}`);
    if (n.kind === 'video' && n.appKey) return navigate(`/admin/apps/${n.appKey}`);
    if (n.kind === 'nudge' && n.hireId) {
      setBusy(i); setNotice(null);
      const r = await sendNudge(n.hireId);
      setBusy(null);
      if (r.ok) toast(r.message); else setNotice(r.message);
    }
  };

  // Coming up: first days plus I-9 document checks, in date order.
  const coming = [
    ...data.upcoming.map((u) => ({ ...u, tone: 'sky' })),
    ...data.needs.filter((n) => n.kind === 'i9' && n.due && n.due >= todayIso()).map((n) => ({ date: n.due!, label: `${byId.get(n.hireId!)?.first ?? 'New hire'}’s I-9 check due`, tone: 'gold' })),
  ].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);

  const aside = (
    <>
      <div className="section">
        <Caps>Coming up</Caps>
        {coming.length ? (
          <div className="ad-upcoming">
            {coming.map((c, i) => (
              <div key={i} className="row"><span className={`ad-dot ${c.tone}`} aria-hidden /><span className="t-body grow">{c.label}</span><span className="t-mono muted">{dayDate(c.date)}</span></div>
            ))}
          </div>
        ) : <p className="t-body muted">Nothing on the calendar yet.</p>}
      </div>
      <Hairline />
      <div className="section">
        <Caps>Onboarding health</Caps>
        <div className="row"><span className="ad-dot sky" aria-hidden /><span className="t-body grow">On track</span><span className="ad-stat">{data.health.ready} of {data.health.total}</span></div>
        <div className="row"><span className="ad-dot gold" aria-hidden /><span className="t-body grow">How new hires feel</span>
          {data.health.mood ? <span className="ad-stat"><span aria-hidden style={{ fontSize: 18 }}>{FEELINGS[data.health.mood - 1]}</span> {FEELING_WORDS[data.health.mood - 1]}</span> : <span className="t-body muted">No check-ins yet</span>}
        </div>
        <p className="t-label muted">🔒 Feelings are averaged. Only People Ops sees them.</p>
      </div>
      <Hairline />
      <div className="section">
        <Caps>Quick actions</Caps>
        <div className="col gap-10" style={{ alignItems: 'flex-start' }}>
          <Button arrow onClick={() => setInviting(true)}>Invite a new hire</Button>
          <Button variant="outline" onClick={() => navigate('/admin/journeys/1')}>Build a journey</Button>
        </div>
      </div>
    </>
  );

  return (
    <Page admin crumbs={[{ label: 'Admin' }, { label: 'Overview' }]} kicker={`Admin · Overview · ${longDate(todayIso())}`}
      title={<>{countWord(thisMonth)} {thisMonth === 1 ? 'person' : 'people'} starting <em>this month.</em></>}
      lede="Who’s on track, who could use a nudge, and the few things waiting on you." aside={aside}>
      {data.needs.length ? (
        <div className="hero-card">
          <div className="row between"><Caps className="gold">Needs you</Caps><span className="t-mono gold">{data.needs.length}</span></div>
          <div className="card ad-needs">
            <div className="row-list">
              {needs.map((n, i) => {
                const [emoji, tint] = NEED_ICON[n.kind];
                const first = n.hireId ? byId.get(n.hireId)?.first : null;
                return (
                  <div key={i} className="ad-need">
                    <EmojiTile emoji={emoji} tint={tint} size={40} />
                    <div className="txt"><p className="t-h-m">{humanDates(n.title)}</p><p className="t-label muted">{n.body}</p></div>
                    <Button size="sm" variant={n.kind === 'nudge' ? 'outline' : 'ink'} loading={busy === i} onClick={() => act(n, i)}>
                      {n.kind === 'nudge' && first ? `Nudge ${first}` : n.action}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
          {notice && <div className="mt-16"><Alert tone="warning" title="Nudge not sent">{notice}</Alert></div>}
          {data.needs.length > 3 && (
            <button className="link-btn mt-16" onClick={() => setShowAll(!showAll)}>{showAll ? 'Show fewer' : `Show ${data.needs.length - 3} more`}</button>
          )}
        </div>
      ) : (
        <div className="hero-card sky"><Caps>Needs you</Caps><h2 className="t-l mt-8">Nothing needs you.</h2><p className="t-body muted mt-8">Every new hire is on track and every video is recorded.</p></div>
      )}

      <section className="section">
        <div className="section-head"><Caps>New hires · {data.hires.length}</Caps></div>
        {data.hires.length ? (
          <table className="table ad-table">
            <thead><tr><th>Person</th><th>Starts</th><th>Stage</th><th>Progress</th><th>Status</th><th><span className="sr-only">Open</span></th></tr></thead>
            <tbody>
              {data.hires.map((h) => (
                <tr key={h.id} className="click" tabIndex={0} onClick={() => navigate(`/admin/hires/${h.id}`)} onKeyDown={(e) => e.key === 'Enter' && navigate(`/admin/hires/${h.id}`)} aria-label={`Open ${h.name}`}>
                  <td><div className="who"><Avatar person={h} size={36} /><div className="col" style={{ minWidth: 0 }}><span className="t-h-m">{h.name}</span><span className="t-label muted">{h.title}</span></div></div></td>
                  <td className="mono">{dayDate(h.startDate)}</td>
                  <td style={{ whiteSpace: 'nowrap' }}><span aria-hidden>{h.stage.emoji}</span> {h.stage.name}</td>
                  <td><div className="col gap-4"><div className="track ad-mini-track"><i style={{ width: `${h.total ? (h.done / h.total) * 100 : 0}%` }} /></div><span className="t-mono muted">{h.done} / {h.total}</span></div></td>
                  <td><Pill tone={pillTone(h.status.tone)}>{h.status.label}</Pill></td>
                  <td className="ad-chev"><Chevron /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="t-body muted">No new hires yet. Invite your first one from Quick actions.</p>}
      </section>

      {inviting && <InviteModal onClose={() => setInviting(false)} onCreated={() => reload()} />}
    </Page>
  );
}

/* ---------- Invite a new hire ---------- */
interface PeopleData { people: (Person & { team?: string | null; duty?: string | null })[]; journeys: { id: number; name: string }[] }
const BLANK = { name: '', email: '', title: '', team: '', startDate: '', journeyId: '', managerId: '', buddyId: '' };

function InviteModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { data } = useApi<PeopleData>('/api/admin/people');
  const navigate = useNavigate();
  const [f, setF] = useState(BLANK);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<{ id: number; invite: InviteResult; first: string; email: string } | null>(null);
  const first = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    first.current?.querySelector('input')?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  useEffect(() => { if (data?.journeys.length === 1) setF((x) => ({ ...x, journeyId: String(data.journeys[0].id) })); }, [data]);

  const set = (k: keyof typeof BLANK) => (e: { target: { value: string } }) => { setF({ ...f, [k]: e.target.value }); setErrors({ ...errors, [k]: '' }); };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true); setFormError(null);
    try {
      const r = await api.post<{ id: number; invite: InviteResult }>('/api/admin/hires', {
        ...f, journeyId: f.journeyId ? Number(f.journeyId) : null, managerId: f.managerId ? Number(f.managerId) : null, buddyId: f.buddyId ? Number(f.buddyId) : null,
      });
      setDone({ ...r, first: f.name.trim().split(/\s+/)[0], email: f.email.trim() });
      onCreated();
    } catch (err) {
      const ae = err as ApiError;
      const errs = (ae.data?.errors as Record<string, string>) || (ae.data?.field ? { [ae.data.field as string]: ae.message } : {});
      setErrors(errs);
      if (!Object.keys(errs).length) setFormError(ae.message);
    } finally {
      setSaving(false);
    }
  };
  const people = data?.people ?? [];

  return (
    <div className="ad-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ad-modal" role="dialog" aria-modal="true" aria-labelledby="invite-title">
        <div className="row between top">
          <div><Caps>People Ops</Caps><h2 id="invite-title" className="t-m" style={{ marginTop: 4 }}>Invite a <em>new hire.</em></h2></div>
          <button className="link-btn" onClick={onClose}>Close</button>
        </div>
        {done ? (
          <>
            <InviteOutcome first={done.first} email={done.email} invite={done.invite} />
            <p className="t-body muted">Their whole journey is set up, and their buddy has a note to record a hello.</p>
            <div className="row gap-12">
              <Button arrow onClick={() => navigate(`/admin/hires/${done.id}`)}>Open {done.first}’s page</Button>
              <Button variant="outline" onClick={() => { setDone(null); setF(BLANK); }}>Invite another</Button>
            </div>
          </>
        ) : (
          <form onSubmit={submit} className="col gap-16" noValidate>
            <p className="t-body muted">We create their account and their whole journey. Then we email them a link to set their own password.</p>
            <div className="grid" ref={first}>
              <div className="full"><TextField id="inv-name" label="Full name" value={f.name} onChange={set('name')} error={errors.name} autoComplete="off" placeholder="Rae Johnson" /></div>
              <div className="full"><TextField id="inv-email" label="Work email" type="email" value={f.email} onChange={set('email')} error={errors.email} autoComplete="off" placeholder="rae@brightside.test" /></div>
              <TextField id="inv-title" label="Job title" value={f.title} onChange={set('title')} error={errors.title} placeholder="Product Designer" />
              <TextField id="inv-team" label="Team" value={f.team} onChange={set('team')} error={errors.team} help="Leave blank to use their manager’s team" />
              <TextField id="inv-start" label="First day" type="date" value={f.startDate} onChange={set('startDate')} error={errors.startDate} />
              <SelectField id="inv-journey" label="Journey" value={f.journeyId} onChange={set('journeyId')} error={errors.journeyId}>
                <option value="">Pick a journey</option>
                {data?.journeys.map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
              </SelectField>
              <SelectField id="inv-manager" label="Manager" value={f.managerId} onChange={set('managerId')} error={errors.managerId}>
                <option value="">Pick their manager</option>
                {people.map((p) => <option key={p.id} value={p.id}>{p.name}{p.title ? ` · ${p.title}` : ''}</option>)}
              </SelectField>
              <SelectField id="inv-buddy" label="Buddy" value={f.buddyId} onChange={set('buddyId')} error={errors.buddyId}>
                <option value="">Pick a buddy</option>
                {people.filter((p) => String(p.id) !== f.managerId).map((p) => <option key={p.id} value={p.id}>{p.name}{p.title ? ` · ${p.title}` : ''}</option>)}
              </SelectField>
            </div>
            {formError && <Alert tone="error" title="We couldn’t send the invite">{formError}</Alert>}
            {Object.values(errors).some(Boolean) && <Alert tone="error" title="A few things to fix">Check the fields marked in red.</Alert>}
            <div className="row gap-12">
              <Button type="submit" arrow loading={saving}>Create account</Button>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
