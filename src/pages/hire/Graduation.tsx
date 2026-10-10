// Graduation: a pale celebration hero with a tilted certificate, the ninety days in real numbers,
// a feedback scale (sent with the survey task) and the invitation to become someone's buddy.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../../api';
import { useAuth } from '../../auth';
import { Page } from '../../components/Shell';
import { Alert, Button, Caps, Checkbox, EmojiTile, Hairline, Smiley, useToast } from '../../components/ui';
import { longDate } from '../../lib/format';
import type { Stage, Task } from '../../lib/types';
import { useApi } from '../../lib/useApi';
import { useCrew } from './TaskPage';
import '../../styles/hire-flows.css';

const SCALE = ['Rough', 'Okay', 'Good', 'Great', 'Loved it'];
const plusDays = (iso: string, n: number) => new Date(new Date(iso + 'T12:00:00').getTime() + n * 864e5).toISOString().slice(0, 10);
const CONFETTI: [number, number, string, number][] = [[52, 8, '#1D4F91', 0], [58, 22, '#F4B9A0', 30], [93, 12, '#BFD9C0', 0], [95, 50, '#7FB5F5', 45], [64, 86, '#7FB5F5', 20], [88, 88, '#1D4F91', 60], [56, 60, '#F4B9A0', 0]];

export default function Graduation() {
  const { data, reload } = useApi<{ startDate: string; stages: Stage[] }>('/api/journey');
  const crew = useCrew();
  const { user, org } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [rating, setRating] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [anon, setAnon] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!data) return <main className="panel"><div className="loading">Loading…</div></main>;

  const first = user?.name.split(' ')[0] || 'friend';
  const all = data.stages.flatMap((s) => s.tasks);
  const mine = all.filter((t) => t.ownerRole === 'hire');
  const tasksDone = mine.filter((t) => t.status === 'done').length;
  const videosDone = mine.filter((t) => t.type === 'video' && t.status === 'done').length;
  const appsDone = mine.filter((t) => t.type === 'app' && t.status === 'done').length;
  const stagesDone = data.stages.filter((s) => s.state === 'done').length;
  const last = data.stages[data.stages.length - 1];
  const graduated = data.stages.slice(0, -1).every((s) => s.state === 'done');
  const gradDate = plusDays(data.startDate, 90);
  const find = (re: RegExp) => mine.find((t) => re.test(t.title));
  const survey = find(/graduation survey/i) || find(/onboarding went/i);
  const buddyTask = find(/become/i);
  const certTask = find(/certificate/i);
  const peopleOps = crew?.peopleOps;

  const complete = async (t: Task | undefined, payload?: unknown) => {
    if (!t) return;
    await api.post(`/api/tasks/${t.id}/complete`, payload === undefined ? {} : { data: payload });
    await reload();
  };

  const sendFeedback = async () => {
    setErr(null);
    if (rating == null) { setErr('Pick how onboarding went first, from Rough to Loved it.'); return; }
    setBusy(true);
    try {
      await complete(survey, { rating: rating + 1, label: SCALE[rating], note: note.trim(), anonymous: anon });
      setSent(true);
      toast(anon ? 'Feedback sent anonymously. Thank you.' : `Feedback sent to ${peopleOps?.first || 'People Ops'}. Thank you.`);
    } catch (e) { setErr((e as ApiError).message); } finally { setBusy(false); }
  };

  const becomeBuddy = async () => {
    try { await complete(buddyTask); toast(`Thanks, ${first}. ${peopleOps?.first || 'People Ops'} will pair you with the next new hire.`); }
    catch (e) { toast((e as ApiError).message); }
  };
  const collect = async () => {
    try { await complete(certTask); toast('Certificate collected. It’s saved to your documents.'); }
    catch (e) { toast((e as ApiError).message); }
  };

  const aside = (
    <>
      <div className="section">
        <div className="section-head"><Caps>Stages finished</Caps><span className="t-mono muted">{stagesDone} / {data.stages.length}</span></div>
        {data.stages.map((s) => (
          <div key={s.id} className="row gap-12">
            <EmojiTile emoji={s.emoji} tint={s.state === 'done' ? 'sage' : 'neutral'} size={34} />
            <div className="grow"><p className="t-h-m">{s.name}</p><p className={`t-label ${s.state === 'done' ? 'success' : 'muted'}`}>{s.state === 'done' ? `✓ All ${s.total} done` : `${s.done} of ${s.total} done`}</p></div>
          </div>
        ))}
      </div>
      <Hairline />
      <div className="section">
        <Caps>Pay it forward</Caps>
        <p className="t-body">New people join soon. Want to be someone’s buddy, the way {crew?.buddy?.first || 'yours'} was{crew?.buddy ? ' yours' : ''}?</p>
        {buddyTask?.status === 'done'
          ? <p className="t-label success strong">✓ You’re on the buddy list</p>
          : <Button variant="outline" style={{ alignSelf: 'flex-start' }} onClick={becomeBuddy}>Become a buddy</Button>}
      </div>
      <Hairline />
      <div className="section">
        <Caps>What happens now</Caps>
        <p className="t-body">Onboarding Buddy steps back. The video library stays open, and Ask Buddy still answers questions any time.</p>
        <button className="link-btn" style={{ alignSelf: 'flex-start' }} onClick={() => navigate('/training')}>Browse your training</button>
      </div>
    </>
  );

  return (
    <Page crumbs={[{ label: 'Onboarding', to: '/today' }, { label: 'My journey', to: '/journey' }, { label: last?.name || 'Graduation' }]}
      kicker={`Stage ${last?.position ?? ''} · ${last?.name ?? 'Graduation'} · ${longDate(gradDate)}`}
      title={<>90 days. <em>You did it.</em></>}
      lede={graduated ? 'From your first form to your first project. Take a minute to look back, then tell us how it went.'
        : `This is where your journey ends, on ${longDate(gradDate)}. Here’s how far you’ve come so far.`}
      aside={aside} glow={['#FFF1B8', '#E3F0E0']}>
      <div className="hero-card grad-hero">
        {CONFETTI.map(([x, y, c, r], i) => <span key={i} className="confetti" aria-hidden style={{ left: `${x}%`, top: `${y}%`, width: 8, height: i % 2 ? 8 : 12, background: c, transform: `rotate(${r}deg)`, borderRadius: i % 2 ? '50%' : 2 }} />)}
        <div className="gh-text col gap-12">
          <Caps className="gold">{graduated ? 'Onboarding complete' : 'Your finish line'}</Caps>
          <h2 className="t-l">Congratulations, {first}.</h2>
          <p className="t-body">{graduated ? `You’re officially part of the ${org?.name || ''} team, not new to it. Your certificate is ready.` : 'Finish your last stages and this certificate is yours.'}</p>
          <div className="row gap-10 wrap mt-8">
            {certTask?.status === 'done'
              ? <span className="t-label success strong">✓ Certificate collected</span>
              : graduated && certTask ? <Button onClick={collect}>Collect certificate</Button>
              : <span className="t-label muted">Ready to collect on {longDate(gradDate)}</span>}
            <Button variant="outline" onClick={() => window.print()}>Print</Button>
          </div>
        </div>
        <div className="cert" aria-label={`Certificate of onboarding for ${user?.name}`}>
          <Smiley size={30} />
          <p className="t-caps">Certificate of onboarding</p>
          <p className="name">{user?.name}</p>
          <span className="rule" aria-hidden />
          <p className="t-label muted">{org?.name} · {new Date(gradDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
        </div>
      </div>

      <section className="section">
        <Caps>Your 90 days in numbers</Caps>
        <div className="num-grid">
          <div className="num-tile tint-sky"><span className="n">{tasksDone}</span><span className="t-label">tasks done</span></div>
          <div className="num-tile tint-butter"><span className="n">{videosDone}</span><span className="t-label">{videosDone === 1 ? 'video' : 'videos'} watched</span></div>
          <div className="num-tile tint-peach"><span className="n">{appsDone}</span><span className="t-label">{appsDone === 1 ? 'tool' : 'tools'} learned</span></div>
          <div className="num-tile tint-sage"><span className="n">{stagesDone}</span><span className="t-label">of {data.stages.length} stages finished</span></div>
        </div>
      </section>

      <Hairline />

      <section className="section">
        <div className="section-head"><Caps>How did onboarding go?</Caps><span className="t-mono muted">2 min · goes to {anon ? 'People Ops, without your name' : peopleOps?.first || 'People Ops'}</span></div>
        {sent || survey?.status === 'done' ? (
          <Alert tone="success" title="Thanks for the feedback">{anon ? 'It went in without your name.' : `${peopleOps?.first || 'People Ops'} reads every one.`} It helps the next person have an even better start.</Alert>
        ) : (
          <>
            {err && <Alert tone="error" title={err} />}
            <div className={`scale ${err && rating == null ? 'error' : ''}`} role="radiogroup" aria-label="How did onboarding go?">
              {SCALE.map((s, i) => <button key={s} role="radio" aria-checked={rating === i} onClick={() => { setRating(i); setErr(null); }}>{s}</button>)}
            </div>
            <div className="field">
              <label htmlFor="fb-note">What should we keep, and what should we change for the next person?</label>
              <textarea id="fb-note" rows={4} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
            </div>
            <div className="row between wrap gap-12">
              <div className="agree-row" onClick={() => setAnon(!anon)}>
                <Checkbox checked={anon} label="Send anonymously" onChange={setAnon} />
                <span className="t-body">Send anonymously</span>
              </div>
              <Button arrow loading={busy} onClick={sendFeedback}>Send feedback</Button>
            </div>
          </>
        )}
      </section>
    </Page>
  );
}
