// Journey builder: one template, five stages, open task rows (never boxed). Each task can be edited inline,
// removed (with a confirm), or added. The server validates; its messages show as field errors or an Alert.
import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../../api';
import { Page } from '../../components/Shell';
import { JourneyTask } from '../../components/Rows';
import { Alert, Avatar, Button, Caps, EmojiTile, Hairline, PlayIcon, Smiley, TextField, useToast } from '../../components/ui';
import { mmss, relTime } from '../../lib/format';
import type { AppInfo, OwnerRole, Person, TaskType, Video } from '../../lib/types';
import { useApi } from '../../lib/useApi';
import { ChevronDown, SelectField } from './kit';

interface TplTask { id: number; type: TaskType; typeLabel: string; title: string; meta: string | null; emoji: string | null; ownerRole: OwnerRole; ownerLabel: string; owner: Person | null; dueDay: number; ref: string | null; app: AppInfo | null }
interface StageT { id: number; name: string; emoji: string; tint: string; window: string; intro: Video | null; tasks: TplTask[] }
interface JourneyData {
  journey: { id: number; name: string; editedBy: Person | null; editedAt: string | null; usedBy: number };
  stages: StageT[];
  people: Partial<Record<OwnerRole, Person | null>>;
  types: { key: TaskType; label: string }[];
  roles: { key: OwnerRole; label: string }[];
}

const TYPE_INFO: Record<TaskType, [string, string]> = {
  form: ['📄', 'W-4, direct deposit, emergency contacts'],
  sign: ['✍️', 'Handbook, policies, agreements'],
  video: ['🎬', 'Record or upload, with a quick check'],
  app: ['🔌', 'From a connected app'],
  todo: ['✅', 'A simple checkbox'],
  meeting: ['📅', 'Books a time on both calendars'],
  it: ['💻', 'Accounts, gear, access'],
};
const TINTS = ['sky', 'butter', 'peach', 'sage'];

type Draft = { title: string; type: TaskType; ownerRole: OwnerRole; dueDay: string; meta: string };
type Editing = { mode: 'edit'; id: number } | { mode: 'add'; stageId: number } | null;

export default function JourneyBuilder() {
  const { id } = useParams();
  const { data, error, reload } = useApi<JourneyData>(`/api/admin/journeys/${id}`);
  const navigate = useNavigate();
  const toast = useToast();
  const [editing, setEditing] = useState<Editing>(null);
  const [confirming, setConfirming] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState<Set<number> | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);

  if (error) return <Page admin crumbs={[{ label: 'Admin', to: '/admin' }, { label: 'Journeys' }]} title="We couldn’t open that journey."><Alert tone="error" title="Not found">{error.message}</Alert></Page>;
  if (!data) return <main className="panel"><div className="loading">Loading the journey…</div></main>;
  const previewHireId = (data.journey as { sampleHireId?: number | null }).sampleHireId ?? null;
  const { journey, stages, people } = data;
  // The later stages start folded, so the first weeks are what you see first.
  const folded = collapsed ?? new Set(stages.slice(3).map((s) => s.id));
  const taskCount = stages.reduce((a, s) => a + s.tasks.length, 0);
  const videoCount = stages.filter((s) => s.intro && s.intro.status !== 'missing').length;

  const remove = async (t: TplTask) => {
    setPageError(null);
    try {
      await api.del(`/api/admin/task-templates/${t.id}`);
      setConfirming(null);
      await reload();
      toast(`Removed “${t.title}”.`);
    } catch (e) {
      setPageError((e as ApiError).message);
    }
  };
  const toggleStage = (sid: number) => {
    const next = new Set(folded);
    if (next.has(sid)) next.delete(sid); else next.add(sid);
    setCollapsed(next);
  };
  const hasFigma = stages.some((s) => s.tasks.some((t) => t.ref === 'figma'));
  const ownerRoles = data.roles.filter((r) => stages.some((s) => s.tasks.some((t) => t.ownerRole === r.key)));

  const aside = (
    <>
      <div className="section ad-types">
        <Caps>Task types</Caps>
        <div className="ad-rows">
          {data.types.map((t, i) => (
            <div key={t.key} className="ad-row">
              <EmojiTile emoji={TYPE_INFO[t.key]?.[0] ?? '📝'} tint={TINTS[i % 4]} size={32} />
              <div className="col"><span className="t-h-m">{t.label}</span><span className="t-label muted">{TYPE_INFO[t.key]?.[1]}</span></div>
            </div>
          ))}
        </div>
        <p className="t-label muted">Add one with “+ Add a task” in any stage.</p>
      </div>
      <Hairline />
      <div className="section">
        <Caps>How due days work</Caps>
        <p className="t-body">Due days count from Day One. “Day −7” means a week before they start. “Day +3” means their third day. Dates fill in automatically for each new hire.</p>
      </div>
      <Hairline />
      <div className="section">
        <Caps>Owners in this journey</Caps>
        <div className="col gap-10">
          {ownerRoles.map((r) => {
            const p = r.key === 'hire' ? null : people[r.key] ?? null;
            return (
              <div key={r.key} className="row gap-10">
                <Avatar person={p} size={28} />
                <span className="t-body">{r.key === 'hire' ? 'The new hire' : p ? `${p.first} · ${r.label}` : `${r.label} · not assigned yet`}</span>
              </div>
            );
          })}
        </div>
      </div>
      {!hasFigma && (
        <>
          <Hairline />
          <div className="row top gap-12">
            <Smiley size={28} />
            <div className="col gap-6">
              <Caps>Suggestion</Caps>
              <p className="t-body">Figma isn’t in this journey yet, and {journey.name}s usually open it in their first week.</p>
              <a href="/admin/apps" onClick={(e) => { e.preventDefault(); navigate('/admin/apps'); }}>Connect Figma and add a walkthrough →</a>
            </div>
          </div>
        </>
      )}
    </>
  );

  return (
    <Page admin crumbs={[{ label: 'Admin', to: '/admin' }, { label: 'Journeys' }, { label: journey.name }]}
      kicker={`Admin · Journeys · ${journey.name}`} title={<>Build a journey <em>once.</em></>}
      lede={`Every new ${journey.name} gets this journey. Each task has one owner, a due day, and a video if you want one.`} aside={aside}>
      <div className="hero-card">
        <Caps className="gold">Template{journey.editedAt ? ` · edited ${relTime(journey.editedAt)}${journey.editedBy ? ` by ${journey.editedBy.first}` : ''}` : ''}</Caps>
        <h2 className="t-h-l mt-8">{journey.name}</h2>
        <p className="t-label muted" style={{ marginTop: 4 }}>{stages.length} stages · {taskCount} tasks · {videoCount} stage videos · used for {journey.usedBy} {journey.usedBy === 1 ? 'hire' : 'hires'}</p>
        <div className="row gap-12 mt-16 wrap">
          <Button variant="outline" onClick={() => navigate('/admin/hires/' + (previewHireId ?? ''))} disabled={!previewHireId}>See it on a new hire</Button>
          <Button onClick={() => toast(`Published. ${journey.usedBy} new ${journey.usedBy === 1 ? 'hire sees' : 'hires see'} the changes now.`)}>Publish changes</Button>
        </div>
      </div>
      {pageError && <Alert tone="error" title="That didn’t work">{pageError}</Alert>}

      {stages.map((s) => {
        const open = !folded.has(s.id);
        return (
          <section key={s.id} className="ad-stage" aria-labelledby={`stage-${s.id}`}>
            <div className="ad-stage-head">
              <button className="toggle" aria-expanded={open} aria-controls={`stage-body-${s.id}`} onClick={() => toggleStage(s.id)} aria-label={`${open ? 'Collapse' : 'Expand'} ${s.name}`}><ChevronDown /></button>
              <EmojiTile emoji={s.emoji} tint={s.tint} size={44} />
              <div className="grow col gap-2">
                <h2 id={`stage-${s.id}`} className="t-m">{s.name}</h2>
                <span className="t-label muted">{s.window} · {s.tasks.length} {s.tasks.length === 1 ? 'task' : 'tasks'}</span>
              </div>
              <StageIntro intro={s.intro} onRecord={() => navigate('/admin/videos')} />
            </div>
            {open && (
              <div id={`stage-body-${s.id}`} className="col">
                {s.tasks.map((t, i) => {
                  if (editing?.mode === 'edit' && editing.id === t.id) {
                    return <TaskEditor key={t.id} data={data} initial={{ title: t.title, type: t.type, ownerRole: t.ownerRole, dueDay: String(t.dueDay), meta: t.meta || '' }}
                      onCancel={() => setEditing(null)}
                      onSave={async (d) => { await api.patch(`/api/admin/task-templates/${t.id}`, payload(d)); setEditing(null); await reload(); toast(`Saved “${d.title.trim()}”.`); }} />;
                  }
                  if (confirming === t.id) {
                    return (
                      <div key={t.id} className="ad-confirm" role="alertdialog" aria-labelledby={`rm-${t.id}`}>
                        <p id={`rm-${t.id}`} className="t-body"><b>Remove “{t.title}”?</b> It also comes off every new hire’s list in this journey.</p>
                        <Button size="sm" variant="outline" onClick={() => setConfirming(null)} autoFocus>Keep it</Button>
                        <Button size="sm" onClick={() => remove(t)}>Remove</Button>
                      </div>
                    );
                  }
                  return (
                    <JourneyTask key={t.id} index={i} title={t.title} meta={t.meta || t.typeLabel} emoji={t.emoji} owner={t.ownerRole === 'hire' ? null : t.owner}
                      ownerLabel={t.ownerLabel} dueDay={t.dueDay} app={t.app}
                      onEdit={() => { setConfirming(null); setEditing({ mode: 'edit', id: t.id }); }}
                      onDelete={() => { setEditing(null); setConfirming(t.id); }} />
                  );
                })}
                {!s.tasks.length && <p className="t-body muted" style={{ padding: '14px 6px' }}>No tasks in this stage yet.</p>}
                {editing?.mode === 'add' && editing.stageId === s.id ? (
                  <TaskEditor data={data} adding initial={{ title: '', type: 'todo', ownerRole: 'hire', dueDay: '', meta: '' }}
                    onCancel={() => setEditing(null)}
                    onSave={async (d) => {
                      await api.post('/api/admin/task-templates', { stageId: s.id, ...payload(d), emoji: TYPE_INFO[d.type]?.[0] ?? '📝' });
                      setEditing(null); await reload(); toast(`Added “${d.title.trim()}” to ${s.name}.`);
                    }} />
                ) : (
                  <button className="link-btn ad-add" onClick={() => { setConfirming(null); setEditing({ mode: 'add', stageId: s.id }); }}><span aria-hidden>+</span> Add a task</button>
                )}
              </div>
            )}
          </section>
        );
      })}
    </Page>
  );
}

const payload = (d: Draft) => ({ title: d.title, type: d.type, ownerRole: d.ownerRole, dueDay: d.dueDay.trim() === '' ? null : Number(d.dueDay.replace('−', '-')), meta: d.meta });

function StageIntro({ intro, onRecord }: { intro: Video | null; onRecord: () => void }) {
  if (!intro || intro.status === 'missing') {
    return (
      <div className="ad-intro">
        <span className="thumb empty" aria-hidden><i /></span>
        <div className="col meta"><span className="t-label muted">Stage intro · not recorded</span><button className="link-btn" style={{ alignSelf: 'flex-start' }} onClick={onRecord}>Record it →</button></div>
      </div>
    );
  }
  return (
    <div className="ad-intro">
      <span className="thumb">
        {intro.still ? <img src={intro.still} alt="" /> : intro.presenter?.photo ? <img src={intro.presenter.photo} alt="" /> : null}
        <span className="pd" aria-hidden><PlayIcon size={9} color="#1A1816" /></span>
      </span>
      <div className="col meta"><span className="t-label muted">Stage intro · {mmss(intro.durationSec)}</span><span className="t-h-m">{intro.presenter?.name ?? 'Your team'}</span></div>
    </div>
  );
}

/** Inline editor for adding or editing a task template. Client checks only the empty due day; the server checks the rest. */
function TaskEditor({ data, initial, adding, onSave, onCancel }: { data: JourneyData; initial: Draft; adding?: boolean; onSave: (d: Draft) => Promise<void>; onCancel: () => void }) {
  const [d, setD] = useState<Draft>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const uid = adding ? 'new' : 'edit';
  const set = (k: keyof Draft) => (e: { target: { value: string } }) => { setD({ ...d, [k]: e.target.value }); setErrors({ ...errors, [k]: '' }); setFormError(null); };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (d.dueDay.trim() === '') { setErrors({ dueDay: 'Add a due day, like −7 or 3.' }); return; }
    setSaving(true); setFormError(null);
    try {
      await onSave(d);
    } catch (err) {
      const ae = err as ApiError;
      const field = ae.data?.field as string | undefined;
      if (field) setErrors({ [field]: ae.message }); else setFormError(ae.message);
      setSaving(false);
    }
  };
  return (
    <form className="ad-editor" onSubmit={submit} noValidate aria-label={adding ? 'Add a task' : 'Edit task'}>
      <p className="t-h-m">{adding ? 'Add a task' : 'Edit task'}</p>
      <TextField id={`${uid}-title`} label="Task name" value={d.title} onChange={set('title')} error={errors.title} autoFocus placeholder="Book a coffee chat" />
      <div className="grid">
        <SelectField id={`${uid}-type`} label="Type" value={d.type} onChange={set('type')} error={errors.type}>
          {data.types.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
        </SelectField>
        <SelectField id={`${uid}-owner`} label="Owner" value={d.ownerRole} onChange={set('ownerRole')} error={errors.ownerRole}>
          {data.roles.map((r) => {
            const p = data.people[r.key];
            return <option key={r.key} value={r.key}>{r.key === 'hire' ? 'The new hire' : p ? `${p.first} · ${r.label}` : r.label}</option>;
          })}
        </SelectField>
        <TextField id={`${uid}-due`} label="Due day" inputMode="numeric" value={d.dueDay} onChange={set('dueDay')} error={errors.dueDay} placeholder="0" />
      </div>
      <TextField id={`${uid}-meta`} label="Details (optional)" value={d.meta} onChange={set('meta')} help="Shown under the title, like “Meeting · 30 min”." />
      {formError && <Alert tone="error" title="That didn’t save">{formError}</Alert>}
      <div className="row gap-12">
        <Button type="submit" size="sm" loading={saving}>{adding ? 'Add task' : 'Save task'}</Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}
