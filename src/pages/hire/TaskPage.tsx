// Task page: one route, four layouts, picked by task.type.
//   form  → the multi-step W-4 (step strip, one question card, review + typed-name signature)
//   sign  → the handbook reader + one sign card
//   video → lesson video, three things to remember, quick check (one question at a time)
//   todo / meeting / it → a simple detail page with Mark done / Undo
import { useState, type ReactNode } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../../api';
import { Page, type Crumb } from '../../components/Shell';
import { VideoPlayer } from '../../components/Video';
import { Alert, Avatar, Button, Caps, Checkbox, Choice, EmojiTile, EmptyState, Hairline, Smiley, TextField, Tick, useToast } from '../../components/ui';
import { lateLabel, longDate, shortDate } from '../../lib/format';
import type { Person, Task, Video } from '../../lib/types';
import { useApi } from '../../lib/useApi';
import '../../styles/hire-flows.css';

/* ---------- Shapes from GET /api/tasks/:id (server/routes/hire.mjs + catalog.mjs) ---------- */
interface FormOption { value: string; title: string; desc?: string }
interface FormStep { id: number; label: string; question: string; help?: string; why?: string; options?: FormOption[]; sign?: boolean }
interface FormDef { key: string; title: string; kicker: string; lede: string; steps: FormStep[] }
interface DocDef { key: string; title: string; kicker: string; lede: string; sections: [string, string][]; agreement: string }
interface Question { id: number; prompt: string; options: string[] }
interface TaskResp {
  task: Task;
  form?: FormDef; saved?: { step: number; answers: Record<string, string>; submittedAt: string | null };
  doc?: DocDef; signature?: { typed_name: string; signed_at: string } | null;
  video?: Video; questions?: Question[]; series?: { id: number; title: string; status: 'todo' | 'done' }[];
}

/* ---------- Small helpers shared by the hire flow pages ---------- */

/** Serif title with one italic word (the last one by default, or the first word containing `word`). */
export function emTitle(text: string, word?: string): ReactNode {
  const clean = text.trim().replace(/[.!?]$/, '');
  const w = clean.split(' ');
  let i = word ? w.findIndex((x) => x.toLowerCase().includes(word.toLowerCase())) : -1;
  if (i < 0) i = w.length - 1;
  const before = w.slice(0, i).join(' ');
  const after = w.slice(i + 1).join(' ');
  return <>{before && `${before} `}<em>{w[i]}</em>{after && ` ${after}`}.</>;
}

/** Paperwork = the hire's own forms, signatures and the three admin forms. */
export const PAPERWORK_REFS = ['emergency', 'direct_deposit', 'i9-1'];
export const isPaperwork = (t: Task) => t.ownerRole === 'hire' && (t.type === 'form' || t.type === 'sign' || PAPERWORK_REFS.includes(t.ref || ''));

/** The hire's people (buddy, manager, People Ops) and Day 1, from /api/today. */
export interface Crew { startDate: string; daysToGo: number; buddy: (Person & { quote?: string }) | null; manager: Person | null; peopleOps: Person | null }
export const useCrew = () => useApi<Crew>('/api/today').data;

/** Inline compose: POST /api/messages, then a toast. Errors are said in words under the box. */
export function MessageBox({ person, onDone }: { person: Person; onDone: () => void }) {
  const toast = useToast();
  const [text, setText] = useState(`Hi ${person.first}! `);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fid = `msg-${person.id}`;
  const send = async () => {
    setBusy(true); setErr(null);
    try {
      await api.post('/api/messages', { toId: person.id, body: text });
      toast(`Sent to ${person.first}. Replies show up in your Inbox.`);
      onDone();
    } catch (e) { setErr((e as ApiError).message); } finally { setBusy(false); }
  };
  return (
    <div className="col gap-8">
      <div className={`field ${err ? 'error' : ''}`}>
        <label htmlFor={fid}>Message {person.first}</label>
        <textarea id={fid} rows={3} value={text} autoFocus aria-invalid={!!err} aria-describedby={err ? fid + '-h' : undefined}
          onChange={(e) => { setText(e.target.value); setErr(null); }} style={{ minHeight: 80 }} />
        {err && <span className="help" id={fid + '-h'}>{err}</span>}
      </div>
      <div className="row gap-8">
        <Button size="sm" loading={busy} onClick={send}>Send</Button>
        <Button size="sm" variant="outline" onClick={onDone}>Cancel</Button>
      </div>
    </div>
  );
}

/** "Need a hand?" block: one person and a way to reach them. */
export function HelpBlock({ person, role, caps = 'Stuck on a question?' }: { person: Person | null | undefined; role: string; caps?: string }) {
  const [open, setOpen] = useState(false);
  if (!person) return null;
  return (
    <div className="section">
      <Caps>{caps}</Caps>
      <div className="row gap-10">
        <Avatar person={person} size={40} />
        <div className="grow"><p className="t-h-m">{person.name}</p><p className="t-label muted">{role}</p></div>
      </div>
      {open ? <MessageBox person={person} onDone={() => setOpen(false)} />
        : <button className="link-btn" style={{ alignSelf: 'flex-start' }} onClick={() => setOpen(true)}>Message {person.first}</button>}
    </div>
  );
}

const minutes = (meta?: string | null) => meta?.match(/\d+ min/)?.[0] || '';
const stamp = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export default function TaskPage() {
  const { id } = useParams();
  const { data, error, reload } = useApi<TaskResp>(`/api/tasks/${id}`);
  const navigate = useNavigate();
  if (error) {
    return (
      <Page crumbs={[{ label: 'Onboarding', to: '/today' }, { label: 'Task' }]} title="We couldn’t find that task.">
        <EmptyState emoji="🧭" title="That task isn’t on your journey" action={<Button arrow onClick={() => navigate('/today')}>Back to Today</Button>}>
          {error.message} It may have been removed, or the link is out of date.
        </EmptyState>
      </Page>
    );
  }
  if (!data || String(data.task.id) !== String(id)) return <main className="panel"><div className="loading">Loading your task…</div></main>;
  const t = data.task;
  if (t.type === 'app' && t.ref) return <Navigate to={`/apps/${t.ref}`} replace />;
  if (t.type === 'form' && data.form && data.saved) return <FormTask key={t.id} data={data} />;
  if (t.type === 'sign' && data.doc) return <SignTask key={t.id} data={data} reload={reload} />;
  if (t.type === 'video' && data.video) return <LessonTask key={t.id} data={data} reload={reload} />;
  return <SimpleTask key={t.id} data={data} reload={reload} />;
}

/* =====================================================================================
   FORM: the W-4
   ===================================================================================== */
const NEARBY: [string, string][] = [['🧾', 'Last year’s tax return'], ['💼', 'Your spouse’s latest pay stub, if they work'], ['👶', 'Dependants’ names and birthdays']];

function FormTask({ data }: { data: TaskResp }) {
  const form = data.form!;
  const saved = data.saved!;
  const total = form.steps.length;
  const navigate = useNavigate();
  const toast = useToast();
  const crew = useCrew();
  const [submitted, setSubmitted] = useState(!!saved.submittedAt || data.task.status === 'done');
  const [step, setStep] = useState(Math.min(Math.max(1, saved.step || 1), total));
  const [reached, setReached] = useState(Math.min(Math.max(1, saved.step || 1), total));
  const [answers, setAnswers] = useState<Record<string, string>>(saved.answers || {});
  const [err, setErr] = useState<string | null>(null);
  const [errStep, setErrStep] = useState<number | null>(null);
  const [choiceErr, setChoiceErr] = useState(false);
  const [name, setName] = useState('');
  const [nameErr, setNameErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const s = form.steps[step - 1];
  const answered = (st: FormStep) => (st.options ? !!answers[st.id] : submitted);
  const stepState = (st: FormStep) => (submitted || (st.id < step && answered(st)) || (st.id !== step && st.options && answered(st) && st.id < reached) ? 'done' : st.id === step ? 'current' : 'todo');
  const doneCount = form.steps.filter((st) => stepState(st) === 'done').length;
  const optionTitle = (st: FormStep) => st.options?.find((o) => o.value === answers[st.id])?.title;

  const clearErrors = () => { setErr(null); setErrStep(null); setChoiceErr(false); setNameErr(null); };
  const go = (n: number) => { clearErrors(); setStep(n); };
  const pick = (value: string) => { setAnswers({ ...answers, [s.id]: value }); setChoiceErr(false); setErr(null); };

  const fail = (e: unknown) => {
    const ae = e as ApiError;
    if (ae.data?.field === 'typedName') { setNameErr(ae.message); return; }
    setErr(ae.message);
    if (typeof ae.data?.step === 'number') setErrStep(ae.data.step as number);
    if (ae.status === 422 && s.options) setChoiceErr(true);
  };

  const cont = async () => {
    clearErrors();
    setBusy(true);
    try {
      const r = await api.post<{ step: number }>(`/api/forms/${form.key}`, { step: s.id, answer: answers[s.id] });
      setStep(r.step);
      setReached((m) => Math.max(m, r.step));
    } catch (e) { fail(e); } finally { setBusy(false); }
  };

  const submit = async () => {
    clearErrors();
    setBusy(true);
    try {
      await api.post(`/api/forms/${form.key}`, { step: s.id, typedName: name });
      setSubmitted(true);
      toast('W-4 submitted. People Ops will send it to payroll.');
    } catch (e) { fail(e); } finally { setBusy(false); }
  };

  const later = async () => {
    if (s.options && answers[s.id]) { try { await api.post(`/api/forms/${form.key}`, { step: s.id, answer: answers[s.id] }); } catch { /* keep what's saved */ } }
    toast('Saved. Pick it up from Today whenever you’re ready.');
    navigate('/today');
  };

  const aside = (
    <>
      <div className="section">
        <div className="section-head"><Caps>Your progress</Caps><span className="t-mono muted">{doneCount} / {total}</span></div>
        <div className="aside-list">
          {form.steps.map((st) => {
            const state = stepState(st);
            return (
              <div key={st.id} className="al">
                {state === 'current' ? <span className="now-dot" aria-hidden /> : <Checkbox checked={state === 'done'} disabled label={`${st.label}: ${state === 'done' ? 'done' : 'not done yet'}`} />}
                <span className={`t-body grow ${state === 'done' ? 'muted' : state === 'current' ? 'strong' : ''}`}>{st.label}</span>
                {state === 'done' && <span className="t-mono muted">done</span>}
                {state === 'current' && <span className="t-mono gold">now</span>}
              </div>
            );
          })}
        </div>
      </div>
      <Hairline />
      <div className="section">
        <Caps>Good to have nearby</Caps>
        {NEARBY.map(([e, txt]) => <p key={txt} className="t-body row gap-10"><span aria-hidden>{e}</span>{txt}</p>)}
      </div>
      <Hairline />
      <HelpBlock person={crew?.peopleOps} role="People Ops · replies within the hour" caps="Need a hand?" />
      {crew?.peopleOps && <Hairline />}
      <p className="t-label muted row top gap-8"><span aria-hidden>🔒</span><span>Only you and People Ops can see your answers. Your manager and buddy never do.</span></p>
    </>
  );

  const strip = (
    <div className="step-strip" role="list" aria-label="W-4 steps">
      {form.steps.map((st) => {
        const state = stepState(st);
        const can = !submitted && st.id <= reached && st.id !== step;
        return (
          <button key={st.id} type="button" role="listitem" className={`st ${state} ${can ? 'can' : ''}`} onClick={() => can && go(st.id)} aria-current={state === 'current' ? 'step' : undefined}
            aria-label={`Step ${st.id}, ${st.label}${state === 'done' ? ', done' : state === 'current' ? ', current step' : ''}`}>
            <span className="bar" aria-hidden />
            <span className="lbl"><span className="t-mono">0{st.id}</span>{st.label}</span>
          </button>
        );
      })}
    </div>
  );

  return (
    <Page crumbs={[{ label: 'Onboarding', to: '/today' }, { label: 'Paperwork', to: '/paperwork' }, { label: 'W-4' }]} kicker={form.kicker} title={emTitle(form.title)} lede={submitted ? 'All 4 steps are done. People Ops has your W-4.' : form.lede} aside={aside}>
      <div className="col gap-20">
        {strip}
        {submitted ? (
          <div className="hero-card">
            <Alert tone="success" title="W-4 submitted">People Ops has it and will send it to payroll. There’s nothing else to do here.</Alert>
            <div className="review-list mt-16">
              {form.steps.filter((st) => st.options).map((st) => (
                <div key={st.id}><span className="t-label muted rl-label">{st.label}</span><span className="t-body grow">{optionTitle(st) || 'Answered'}</span></div>
              ))}
            </div>
            <div className="hero-foot"><span className="grow" /><Button arrow onClick={() => navigate('/today')}>Back to Today</Button></div>
          </div>
        ) : (
          <div className="hero-card">
            <div className="row between"><Caps className="gold">Step {s.id} of {total} · {s.label}</Caps><span className="t-mono muted">~1 min</span></div>
            <h2 className="t-m mt-16">{s.question}</h2>
            {s.help && <p className="t-body muted mt-8">{s.help}</p>}

            {err && <div className="mt-16"><Alert tone="error" title={err}>{errStep ? <button className="link-btn" onClick={() => go(errStep)}>Go to step {errStep}</button> : s.options ? 'Choose one of the options below, then press Continue.' : null}</Alert></div>}

            {s.options && (
              <div className="choices mt-16" role="radiogroup" aria-label={s.question}>
                {s.options.map((o) => <Choice key={o.value} title={o.title} desc={o.desc || undefined} checked={answers[s.id] === o.value} error={choiceErr} onSelect={() => pick(o.value)} />)}
              </div>
            )}

            {s.sign && (
              <div className="col gap-16 mt-16">
                <div className="card" style={{ padding: '4px 18px' }}>
                  <div className="review-list">
                    {form.steps.filter((st) => st.options).map((st) => (
                      <div key={st.id}>
                        <span className="t-label muted rl-label">{st.label}</span>
                        <span className={`t-body grow ${optionTitle(st) ? '' : 'danger'}`}>{optionTitle(st) || 'Not answered yet'}</span>
                        <button className="link-btn" onClick={() => go(st.id)} aria-label={`Change ${st.label}`}>Change</button>
                      </div>
                    ))}
                  </div>
                </div>
                <TextField label="Type your full name" placeholder="Your full name" autoComplete="name" value={name} error={nameErr}
                  help="Typing your full name counts as your signature." onChange={(e) => { setName(e.target.value); setNameErr(null); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />
              </div>
            )}

            {s.why && (
              <div className="why-box mt-16">
                <Smiley size={26} />
                <div className="col gap-2"><p className="t-h-m">Why we ask</p><p className="t-body">{s.why}</p></div>
              </div>
            )}

            <div className="hero-foot">
              <Button variant="outline" onClick={() => go(step - 1)} disabled={step === 1 || busy}>Back</Button>
              <span className="grow" />
              <button className="link-btn" onClick={later}>Save and finish later</button>
              {s.sign ? <Button arrow loading={busy} onClick={submit}>Sign and submit</Button> : <Button arrow loading={busy} onClick={cont}>Continue</Button>}
            </div>
          </div>
        )}
        <p className="t-label muted row gap-8"><span aria-hidden>ⓘ</span>This is the 2026 Form W-4. Brightside files it with payroll; you don’t send anything to the IRS.</p>
      </div>
    </Page>
  );
}

/* =====================================================================================
   SIGN: the handbook
   ===================================================================================== */
function SignTask({ data, reload }: { data: TaskResp; reload: () => void }) {
  const doc = data.doc!;
  const navigate = useNavigate();
  const toast = useToast();
  const crew = useCrew();
  const n = doc.sections.length;
  const [page, setPage] = useState(0);
  const [seen, setSeen] = useState<Set<number>>(() => new Set(data.signature ? doc.sections.map((_, i) => i) : [0]));
  const [agree, setAgree] = useState(false);
  const [name, setName] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [agreeErr, setAgreeErr] = useState(false);
  const [nameErr, setNameErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sig, setSig] = useState(data.signature || null);

  const open = (i: number) => { setPage(i); setSeen((s) => new Set(s).add(i)); };
  const left = n - seen.size;
  const [title, body] = doc.sections[page];

  const submit = async () => {
    setErr(null); setAgreeErr(false); setNameErr(null); setBusy(true);
    try {
      await api.post(`/api/sign/${doc.key}`, { agree, typedName: name });
      setSig({ typed_name: name.trim(), signed_at: new Date().toISOString() });
      toast('Handbook signed. A copy is with People Ops.');
      reload();
    } catch (e) {
      const ae = e as ApiError;
      if (ae.data?.field === 'typedName') setNameErr(ae.message);
      else { setErr(ae.message); if (ae.data?.field === 'agree') setAgreeErr(true); }
    } finally { setBusy(false); }
  };

  const aside = (
    <>
      <div className="section">
        <div className="section-head"><Caps>In this handbook</Caps><span className="t-mono muted">{page + 1} / {n}</span></div>
        <div className="aside-list">
          {doc.sections.map(([t], i) => (
            <button key={t} className="al" onClick={() => open(i)} aria-current={i === page ? 'true' : undefined}>
              <span className={`t-mono ${i === page ? 'gold' : 'muted'}`}>0{i + 1}</span>
              <span className={`t-body grow ${i === page ? 'strong' : ''}`}>{t}</span>
              {seen.has(i) && i !== page && <span className="success" aria-label="read"><Tick size={13} color="var(--text-success)" /></span>}
            </button>
          ))}
        </div>
      </div>
      <Hairline />
      <HelpBlock person={crew?.peopleOps} role="People Ops · your HR contact" caps="Questions about a policy?" />
      {crew?.peopleOps && <Hairline />}
      <p className="t-label muted row top gap-8"><span aria-hidden>🔒</span><span>A signed copy goes to People Ops. You can come back and read the handbook any time.</span></p>
    </>
  );

  return (
    <Page crumbs={[{ label: 'Onboarding', to: '/today' }, { label: 'Paperwork', to: '/paperwork' }, { label: 'Employee handbook' }]} kicker={doc.kicker}
      title={doc.key === 'handbook' ? <>The employee <em>handbook.</em></> : emTitle(doc.title)} lede={doc.lede} aside={aside}>
      <div className="reader">
        <div className="r-head">
          <span aria-hidden style={{ fontSize: 18 }}>📘</span>
          <div className="grow"><p className="t-h-m">Brightside employee handbook</p><p className="t-label muted">{n} sections · about 15 minutes</p></div>
          <span className="t-mono muted">Section {page + 1} of {n}</span>
        </div>
        <div className="r-progress" aria-hidden><i style={{ width: `${((page + 1) / n) * 100}%` }} /></div>
        <article className="r-body" aria-live="polite">
          <Caps>Section {page + 1}</Caps>
          <h2 className="t-m">{title}</h2>
          <p className="t-body-l">{body}</p>
        </article>
        <div className="r-foot">
          <Button variant="outline" onClick={() => open(page - 1)} disabled={page === 0}>Previous</Button>
          <span className="grow t-label muted center">{left > 0 ? `${left} ${left === 1 ? 'section' : 'sections'} still to read` : 'You’ve read every section'}</span>
          {page < n - 1 ? <Button arrow onClick={() => open(page + 1)}>Next section</Button> : <Button variant="outline" onClick={() => document.getElementById('sign-card')?.scrollIntoView({ behavior: 'smooth' })}>Go to signature</Button>}
        </div>
      </div>

      <div className="hero-card" id="sign-card">
        {sig ? (
          <div className="col gap-16">
            <Alert tone="success" title="Signed">You signed the handbook as {sig.typed_name} on {stamp(sig.signed_at)}. People Ops has a copy.</Alert>
            <p className="sig-preview">{sig.typed_name}</p>
            <div className="hero-foot" style={{ marginTop: 0 }}><span className="grow" /><Button variant="outline" onClick={() => navigate('/paperwork')}>Back to Paperwork</Button><Button arrow onClick={() => navigate('/today')}>Back to Today</Button></div>
          </div>
        ) : (
          <div className="col gap-16">
            <div className="row between"><Caps className="gold">When you’ve finished reading</Caps><span className="t-mono muted">{left > 0 ? `${left} left to read` : 'all read'}</span></div>
            <h2 className="t-m">Sign to confirm you’ve read it.</h2>
            {err && <Alert tone="error" title={err}>{agreeErr ? 'Tick the box below, then press Sign and finish again.' : null}</Alert>}
            <TextField label="Your full name" placeholder="Type your full name" autoComplete="name" value={name} error={nameErr}
              help="Typing your full name counts as your signature." onChange={(e) => { setName(e.target.value); setNameErr(null); }} />
            <div className={`agree-row ${agreeErr ? 'error' : ''}`} onClick={() => { setAgree(!agree); setAgreeErr(false); }}>
              <Checkbox checked={agree} label={doc.agreement} onChange={(v) => { setAgree(v); setAgreeErr(false); }} />
              <span className={`t-body ${agreeErr ? 'danger' : ''}`}>{doc.agreement}</span>
            </div>
            <div className="hero-foot" style={{ marginTop: 0 }}>
              <span className="t-label muted grow">The date and time are saved with your signature.</span>
              <Button arrow loading={busy} onClick={submit}>Sign and finish</Button>
            </div>
          </div>
        )}
      </div>
    </Page>
  );
}

/* =====================================================================================
   VIDEO: a lesson with a quick check
   ===================================================================================== */
const REMEMBER: { match: RegExp; items: string[] }[] = [
  { match: /phish/i, items: [
    'Check the sender’s real address, not the display name. “Brightside IT” from a gmail.com address is not Brightside IT.',
    'Urgency is the tell. “Do this today” or “your account closes in 2 hours” is designed to stop you thinking.',
    'Never type your password after clicking a link in an email. Go to the site yourself, and forward anything odd to IT.',
  ] },
];

function LessonTask({ data, reload }: { data: TaskResp; reload: () => void }) {
  const v = data.video!;
  const qs = data.questions || [];
  const series = data.series || [];
  const navigate = useNavigate();
  const toast = useToast();
  const [qi, setQi] = useState(0);
  const [pick, setPick] = useState<number | null>(null);
  const [result, setResult] = useState<{ correct: boolean; explanation: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [finished, setFinished] = useState(data.task.status === 'done');
  const q = qs[qi];
  const remember = REMEMBER.find((r) => r.match.test(v.title))?.items
    || (v.chapters.length ? v.chapters.slice(0, 3).map(([, c]) => c) : [v.caption || 'Watch the whole video before the quick check.']);
  const lessonNo = Math.max(1, series.findIndex((s) => s.id === data.task.id) + 1);
  const mins = v.durationSec ? Math.max(1, Math.round(v.durationSec / 60)) : null;

  const choose = (i: number) => { if (result?.correct) return; setPick(i); setResult(null); setErr(null); };
  const check = async () => {
    if (pick == null || !q) return;
    setBusy(true); setErr(null);
    try {
      const r = await api.post<{ correct: boolean; explanation: string }>(`/api/videos/${v.id}/quiz`, { questionId: q.id, answerIndex: pick });
      setResult(r);
      if (r.correct && data.task.status !== 'done') reload(); // the first right answer marks the lesson done
    } catch (e) { setErr((e as ApiError).message); } finally { setBusy(false); }
  };
  const next = () => {
    if (qi < qs.length - 1) { setQi(qi + 1); setPick(null); setResult(null); return; }
    setFinished(true);
    toast(`${data.task.title}: done. Nice work.`);
    reload();
  };
  const restart = () => { setFinished(false); setQi(0); setPick(null); setResult(null); };

  const aside = (
    <>
      {series.length > 0 && (
        <div className="section">
          <div className="section-head"><Caps>Your lessons</Caps><span className="t-mono muted">{series.filter((s) => s.status === 'done').length} / {series.length}</span></div>
          <div className="track"><i style={{ width: `${(series.filter((s) => s.status === 'done').length / series.length) * 100}%` }} /></div>
          <div className="aside-list">
            {series.map((s) => {
              const current = s.id === data.task.id;
              return (
                <button key={s.id} className="al" onClick={() => !current && navigate(`/tasks/${s.id}`)} aria-current={current ? 'true' : undefined}>
                  {current && s.status !== 'done' ? <span className="now-dot" aria-hidden /> : <Checkbox checked={s.status === 'done'} disabled label={`${s.title}: ${s.status === 'done' ? 'done' : 'not done yet'}`} />}
                  <span className={`t-body grow ${current ? 'strong' : s.status === 'done' ? 'muted' : ''}`}>{s.title}</span>
                  {current && <span className="t-mono gold">now</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {v.presenter && (
        <>
          <Hairline />
          <div className="section">
            <Caps>Led by</Caps>
            <div className="row gap-10"><Avatar person={v.presenter} size={40} /><div><p className="t-h-m">{v.presenter.name}</p><p className="t-label muted">{v.presenter.title || 'Presenter'} · happy to answer anything</p></div></div>
          </div>
        </>
      )}
      <Hairline />
      <div className="section">
        <Caps>Why this one is required</Caps>
        <p className="t-body">Every new hire does {data.task.title} in their first week. It takes about {mins ? `${mins + 2} minutes` : '10 minutes'} with the quick check, and it’s the one lesson Brightside asks everyone to repeat each year.</p>
      </div>
    </>
  );

  return (
    <Page crumbs={[{ label: 'Onboarding', to: '/today' }, { label: 'Training', to: '/training' }, { label: data.task.title }]}
      kicker={`Training · ${data.task.title} · Lesson ${lessonNo} of ${Math.max(series.length, 1)}`}
      title={emTitle(v.title, /phish/i.test(v.title) ? 'phishing' : undefined)}
      lede={`A ${mins ? `${mins}-minute` : 'short'} video, then ${qs.length} quick ${qs.length === 1 ? 'question' : 'questions'}. Get them right and the lesson is marked done.`} aside={aside}>
      <VideoPlayer video={v} kicker={`Lesson ${lessonNo}`} />

      <section className="section">
        <Caps>Three things to remember</Caps>
        <ol className="remember">
          {remember.map((r, i) => <li key={i}><span className="t-mono">0{i + 1}</span><span className="t-body">{r}</span></li>)}
        </ol>
      </section>

      {qs.length > 0 && (
        <div className="hero-card">
          {finished ? (
            <div className="col gap-16">
              <div className="row between"><Caps className="gold">Quick check</Caps><span className="t-mono muted">{qs.length} of {qs.length}</span></div>
              <Alert tone="success" title="Lesson done">You got every question right. {data.task.title} is marked done on your journey.</Alert>
              <div className="hero-foot" style={{ marginTop: 0 }}>
                <Button variant="outline" onClick={restart}>Take it again</Button>
                <span className="grow" />
                <Button arrow onClick={() => navigate('/today')}>Back to Today</Button>
              </div>
            </div>
          ) : q && (
            <>
              <div className="row between"><Caps className="gold">Quick check · {qi + 1} of {qs.length}</Caps><span className="t-mono muted">no time limit</span></div>
              <h2 className="t-m mt-16">{q.prompt}</h2>
              <div className="choices mt-16" role="radiogroup" aria-label={q.prompt}>
                {q.options.map((o, i) => (
                  <Choice key={i} title={o} checked={pick === i} error={pick === i && result?.correct === false} onSelect={() => choose(i)} disabled={result?.correct === true && pick !== i} />
                ))}
              </div>
              {result && (
                <div className="mt-16">
                  {result.correct
                    ? <Alert tone="success" title="That’s right.">{result.explanation}</Alert>
                    : <Alert tone="error" title="Not quite. Try another answer">{result.explanation}</Alert>}
                </div>
              )}
              {err && <div className="mt-16"><Alert tone="error" title={err} /></div>}
              <div className="hero-foot">
                <span className="t-label muted grow">Get one wrong and you’ll see why, then try again. Nothing is recorded against you.</span>
                {result?.correct
                  ? <Button arrow onClick={next}>{qi < qs.length - 1 ? 'Next question' : 'Finish lesson'}</Button>
                  : <Button arrow loading={busy} disabled={pick == null || result?.correct === false} onClick={check}>Check answer</Button>}
              </div>
            </>
          )}
        </div>
      )}
    </Page>
  );
}

/* =====================================================================================
   SIMPLE: to-do, meeting, IT request
   ===================================================================================== */
const GUIDE: Record<string, string> = {
  emergency: 'Add 1 or 2 people we should call if something happens while you’re working. Only People Ops can see them.',
  direct_deposit: 'Add the bank account your pay goes into. Have your routing and account numbers ready. Brightside’s payroll provider stores them; Onboarding Buddy never does.',
  'i9-1': 'Section 1 of the I-9 confirms you can work in the US. Fill it in by the end of Day 1. People Ops checks your documents within 3 business days.',
  meeting: 'Pick a time that works for both of you. Once it’s booked, tick it off here.',
  it: 'IT handles this one. It ticks off here as soon as it’s done, and you’ll get a note in your Inbox.',
  todo: 'Tick it off when it’s done. You can undo it if you change your mind.',
};

function SimpleTask({ data, reload }: { data: TaskResp; reload: () => void }) {
  const t = data.task;
  const navigate = useNavigate();
  const toast = useToast();
  const crew = useCrew();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const mine = t.ownerRole === 'hire';
  const done = t.status === 'done';
  const paper = isPaperwork(t);
  const crumbs: Crumb[] = [{ label: 'Onboarding', to: '/today' }, paper ? { label: 'Paperwork', to: '/paperwork' } : { label: 'My journey', to: '/journey' }, { label: t.title }];

  const set = async (d: boolean) => {
    setBusy(true); setErr(null);
    try {
      await api.post(`/api/tasks/${t.id}/${d ? 'complete' : 'undo'}`);
      await reload();
      if (d) toast(`${t.title}: done.`, { label: 'Undo', run: async () => { await api.post(`/api/tasks/${t.id}/undo`); reload(); } });
    } catch (e) { setErr((e as ApiError).message); } finally { setBusy(false); }
  };

  const status = done ? <span className="t-label success strong">✓ Done{t.doneAt ? ` on ${shortDate(t.doneAt.slice(0, 10))}` : ''}</span>
    : t.overdue ? <span className="t-label danger strong">Overdue · {lateLabel(t.dueDate)}</span>
    : t.dueToday ? <span className="t-label strong">Due today</span>
    : <span className="t-label muted">Due {longDate(t.dueDate)}</span>;

  const aside = (
    <>
      <HelpBlock person={t.ownerRole === 'hire' ? crew?.buddy : t.owner} role={t.ownerRole === 'hire' ? 'Your buddy · ask anything' : `${t.ownerLabel} · owns this task`} caps={t.ownerRole === 'hire' ? 'Need a hand?' : 'Who’s on it'} />
      <Hairline />
      <div className="section">
        <Caps>Where this sits</Caps>
        <p className="t-body"><span aria-hidden>{t.stageEmoji}</span> Stage {t.stagePos} · {t.stageName}</p>
        <button className="link-btn" style={{ alignSelf: 'flex-start' }} onClick={() => navigate('/journey')}>See your journey</button>
      </div>
    </>
  );

  return (
    <Page crumbs={crumbs} kicker={`${t.typeLabel} · ${t.stageName}`} title={emTitle(t.title)} lede={t.meta} aside={aside}>
      <div className="hero-card">
        <div className="row between"><Caps className="gold">{done ? 'Done' : mine ? 'Your task' : `Waiting on ${t.owner?.first || t.ownerLabel}`}</Caps><span className="t-mono muted">{minutes(t.meta) && `~${minutes(t.meta)}`}</span></div>
        <div className="row top gap-14 mt-16"><EmojiTile emoji={t.emoji || '📝'} tint="butter" size={44} /><p className="t-body-l grow">{GUIDE[t.ref || ''] || GUIDE[t.type] || GUIDE.todo}</p></div>
        {err && <div className="mt-16"><Alert tone="error" title={err} /></div>}
        <div className="hero-foot">
          {status}
          <span className="grow" />
          {mine
            ? done
              ? <Button variant="outline" loading={busy} onClick={() => set(false)}>Undo</Button>
              : <Button arrow loading={busy} onClick={() => set(true)}>Mark done</Button>
            : <span className="t-label muted">{t.owner?.first || t.ownerLabel} will tick this off.</span>}
        </div>
      </div>

      <section className="section">
        <Caps>Details</Caps>
        <div className="row-list">
          <div className="row gap-12" style={{ padding: '12px 0' }}>
            <span className="t-label muted" style={{ width: 110 }}>Owner</span>
            <Avatar person={t.owner} size={28} />
            <span className="t-body grow">{t.owner ? `${t.owner.name}${mine ? ' (you)' : ''}` : t.ownerLabel}</span>
          </div>
          <div className="row gap-12" style={{ padding: '12px 0' }}><span className="t-label muted" style={{ width: 110 }}>Due</span><span className={`t-body grow ${t.overdue ? 'danger' : ''}`}>{longDate(t.dueDate)}{t.overdue ? ` · ${lateLabel(t.dueDate)}` : ''}</span></div>
          <div className="row gap-12" style={{ padding: '12px 0' }}><span className="t-label muted" style={{ width: 110 }}>Type</span><span className="t-body grow">{t.typeLabel}</span></div>
          <div className="row gap-12" style={{ padding: '12px 0' }}><span className="t-label muted" style={{ width: 110 }}>Stage</span><span className="t-body grow">{t.stageName}</span></div>
        </div>
      </section>
    </Page>
  );
}
