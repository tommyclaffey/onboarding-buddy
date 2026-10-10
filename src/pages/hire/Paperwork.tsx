// Paperwork: the hire's own forms and signatures. One hero card for the next one, then open rows.
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { Page } from '../../components/Shell';
import { TaskRow } from '../../components/Rows';
import { Button, Caps, EmojiTile, EmptyState, Hairline, useToast } from '../../components/ui';
import { lateLabel, longDate } from '../../lib/format';
import type { Stage, Task } from '../../lib/types';
import { useApi } from '../../lib/useApi';
import { openTask } from './Today';
import { HelpBlock, isPaperwork, useCrew } from './TaskPage';
import '../../styles/hire-flows.css';

const NEEDS: [string, string][] = [
  ['🪪', 'A passport, or a driver’s licence plus a Social Security card, for the I-9'],
  ['🏦', 'Your bank’s routing and account numbers'],
  ['🧾', 'Last year’s tax return, for the W-4'],
  ['📇', 'A phone number for 1 or 2 emergency contacts'],
];

export default function Paperwork() {
  const { data, reload } = useApi<{ startDate: string; stages: Stage[] }>('/api/journey');
  const crew = useCrew();
  const navigate = useNavigate();
  const toast = useToast();
  if (!data) return <main className="panel"><div className="loading">Loading your paperwork…</div></main>;

  const all = data.stages.flatMap((s) => s.tasks).filter(isPaperwork).sort((a, b) => a.dueDay - b.dueDay);
  const open = all.filter((t) => t.status !== 'done');
  const done = all.filter((t) => t.status === 'done');
  const next = open[0];
  const rest = open.slice(1);
  const pct = all.length ? (done.length / all.length) * 100 : 0;

  // Forms and signatures finish on their own page; the simple forms can be ticked off here.
  const toggle = async (t: Task, v: boolean) => {
    if (t.type === 'form' || t.type === 'sign') { openTask(navigate, t); return; }
    await api.post(`/api/tasks/${t.id}/${v ? 'complete' : 'undo'}`);
    await reload();
    if (v) toast(`${t.title}: done. ${done.length + 1} of ${all.length} paperwork tasks finished.`, { label: 'Undo', run: async () => { await api.post(`/api/tasks/${t.id}/undo`); reload(); } });
  };

  const aside = (
    <>
      <div className="section">
        <div className="section-head"><Caps>Your paperwork</Caps><span className="t-mono muted">{done.length} / {all.length}</span></div>
        <div className="track"><i style={{ width: `${pct}%` }} /></div>
        <p className="t-body">{open.length === 0 ? 'All done. Nothing left to fill in.' : `${open.length} left. Most people finish in 2 short sittings.`}</p>
      </div>
      <Hairline />
      <div className="section">
        <Caps>Good to have nearby</Caps>
        {NEEDS.map(([e, txt]) => <p key={txt} className="t-body row top gap-10"><span aria-hidden>{e}</span><span>{txt}</span></p>)}
      </div>
      <Hairline />
      <HelpBlock person={crew?.peopleOps} role="People Ops · your HR contact" caps="Questions about a form?" />
      {crew?.peopleOps && <Hairline />}
      <p className="t-label muted row top gap-8"><span aria-hidden>🔒</span><span>Only you and People Ops can see what you enter here. Your manager and buddy never do.</span></p>
    </>
  );

  return (
    <Page crumbs={[{ label: 'Onboarding', to: '/today' }, { label: 'Paperwork' }]} kicker="Paperwork · private to you and People Ops"
      title={open.length ? <>A little <em>paperwork.</em></> : <>Paperwork, <em>done.</em></>}
      lede={open.length ? `${open.length} of ${all.length} still to do. Each one takes a few minutes, and you can stop and come back any time.` : 'Every form is in. People Ops has everything they need.'}
      aside={aside}>
      {next ? (
        <div className="hero-card">
          <div className="row between">
            <Caps className="gold">Up next</Caps>
            <span className="t-mono muted">{next.meta?.match(/\d+ min/)?.[0] ? `~${next.meta.match(/\d+ min/)![0]}` : ''}</span>
          </div>
          <div className="row gap-12 mt-8"><EmojiTile emoji={next.emoji} tint="butter" size={40} /><h2 className="t-l">{next.title}</h2></div>
          <p className="t-label muted mt-8">{next.meta}</p>
          <div className="hero-foot">
            <span className={`t-label ${next.overdue ? 'danger strong' : next.dueToday ? 'strong' : 'muted'}`}>
              {next.overdue ? `Overdue · ${lateLabel(next.dueDate)}` : next.dueToday ? 'Due today' : `Due ${longDate(next.dueDate)}`}
            </span>
            <span className="grow" />
            <Button arrow onClick={() => openTask(navigate, next)}>Start</Button>
          </div>
        </div>
      ) : (
        <div className="hero-card sky"><EmptyState emoji="🎉" title="All your paperwork is in">People Ops will let you know if anything else comes up.</EmptyState></div>
      )}

      {rest.length > 0 && (
        <section className="section">
          <div className="section-head"><Caps>Still to do</Caps><span className="t-label muted">{rest.length} more</span></div>
          <div className="col">{rest.map((t, i) => <TaskRow key={t.id} task={t} index={i + 1} onOpen={() => openTask(navigate, t)} onToggle={(v) => toggle(t, v)} />)}</div>
        </section>
      )}

      {done.length > 0 && (
        <section className="section">
          <div className="section-head"><Caps>Done</Caps><span className="t-label muted">{done.length} finished</span></div>
          <div className="col">{done.map((t, i) => <TaskRow key={t.id} task={t} index={i} onOpen={() => openTask(navigate, t)} onToggle={(v) => toggle(t, v)} />)}</div>
        </section>
      )}
    </Page>
  );
}
