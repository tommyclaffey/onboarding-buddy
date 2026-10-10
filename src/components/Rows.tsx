// Row components: Task (Today), TaskRowCompact (admin / owners), JourneyTask (builder), StageCard (My journey).
import type { ReactNode } from 'react';
import type { AppInfo, Person, Stage, Task } from '../lib/types';
import { dayLabel, dueLabel, lateLabel, shortDate, tintAt } from '../lib/format';
import { Avatar, Checkbox, EmojiTile, Logo, PlayIcon } from './ui';

/** Today's task row. Overdue and locked say it in words, colour is only a second signal. */
export function TaskRow({ task, index = 0, onOpen, onToggle, locked }: { task: Task; index?: number; onOpen?: () => void; onToggle?: (done: boolean) => void; locked?: boolean }) {
  const done = task.status === 'done';
  const late = task.overdue ? ` · ${lateLabel(task.dueDate)}` : '';
  return (
    <div className={`task ${done ? 'done' : ''}`} role="button" tabIndex={0} onClick={onOpen} onKeyDown={(e) => e.key === 'Enter' && onOpen?.()}>
      <EmojiTile emoji={task.emoji || '📝'} tint={locked ? 'neutral' : tintAt(index)} />
      <div className="t-text">
        <p className="t-h-m t-title">{task.title}</p>
        <p className={`t-label ${task.overdue ? 'danger' : 'muted'}`}>{locked ? 'Unlocks later in your journey' : (task.meta?.split(' · ')[0] || task.typeLabel) + late}</p>
      </div>
      <span className="dur">{task.meta?.match(/\d+ min/)?.[0] || ''}</span>
      {task.ownerRole === 'hire' && <Checkbox checked={done} disabled={locked} label={`Mark “${task.title}” ${done ? 'not done' : 'done'}`} onChange={(v) => onToggle?.(v)} />}
    </div>
  );
}

/** Compact checklist row (admin New hire detail, My tasks). */
export function TaskRowCompact({ task, onToggle, canToggle = true, extra }: { task: Task; onToggle?: (done: boolean) => void; canToggle?: boolean; extra?: ReactNode }) {
  const done = task.status === 'done';
  const due = task.overdue ? lateLabel(task.dueDate) : task.dueToday ? 'Today' : shortDate(task.dueDate);
  return (
    <div className="row gap-10" style={{ padding: '8px 0' }}>
      <Checkbox checked={done} disabled={!canToggle} label={`Mark “${task.title}” ${done ? 'not done' : 'done'}`} onChange={(v) => onToggle?.(v)} />
      <span className={`t-body grow ${done ? 'muted' : ''}`}>{task.title}</span>
      {extra}
      <span className={`t-mono ${task.overdue ? 'danger' : task.dueToday ? 'gold' : 'muted'}`}>{done ? shortDate(task.doneAt || task.dueDate) : due}</span>
    </div>
  );
}

/** Journey builder row: open row with hairline, owner photo, Day pill. Grip and menu show on hover. */
export function JourneyTask({ title, meta, emoji, index, owner, ownerLabel, dueDay, app, onEdit, onDelete }: {
  title: string; meta?: string | null; emoji?: string | null; index: number; owner: Person | null; ownerLabel: string; dueDay: number; app?: AppInfo | null; onEdit?: () => void; onDelete?: () => void;
}) {
  return (
    <div className="jtask">
      <span className="grip muted" aria-hidden>⋮⋮</span>
      <EmojiTile emoji={emoji || '📝'} tint={tintAt(index)} />
      <div className="grow col gap-2">
        <span className="t-h-m">{title}</span>
        <span className="row gap-6 t-label muted">{app && <Logo app={app} size={14} />}{meta}</span>
      </div>
      <span className="owner">{owner ? <Avatar person={owner} size={24} /> : <Avatar person={null} size={24} />}{owner ? owner.first : ownerLabel === 'New hire' ? 'New hire' : ownerLabel}</span>
      <span className="day-pill">{dayLabel(dueDay)}</span>
      <span className="more row gap-8">
        {onEdit && <button className="link-btn" onClick={onEdit}>Edit</button>}
        {onDelete && <button className="link-btn danger" onClick={onDelete} aria-label={`Remove ${title}`}>Remove</button>}
      </span>
    </div>
  );
}

/** A stage on My journey that isn't the current one. */
export function StageCard({ stage, onPlay, onApp }: { stage: Stage; onPlay?: () => void; onApp?: (key: string) => void }) {
  const done = stage.state === 'done';
  return (
    <div className="col gap-8">
      <div className="row gap-14">
        <EmojiTile emoji={stage.emoji} tint={done ? 'sage' : stage.tint} size={40} />
        <div className="grow">
          <p className="t-caps">Stage {stage.position}</p>
          <h3 className="t-m">{stage.name}</h3>
        </div>
        <span className={`t-label ${done ? 'success strong' : 'muted'}`}>{done ? '✓ Done' : `🔒 Opens ${dueLabel(stage.opens)}`}</span>
      </div>
      <p className="t-body">{stage.summary}</p>
      <p className="t-label muted">{stage.tasks.filter((t) => t.ownerRole === 'hire').slice(0, 3).map((t) => t.title).join('  ·  ')}</p>
      <div className="row gap-8 wrap">
        {stage.intro && <button className={`chip tint-${stage.tint}`} onClick={onPlay}><span className="play-dot" style={{ position: 'static', width: 22, height: 22 }}><PlayIcon size={9} color="#fff" /></span>Stage intro · {Math.max(1, Math.round((stage.intro.durationSec || 60) / 60))} min</button>}
        {stage.apps.map((a) => <button key={a.key} className="chip" style={{ background: '#fff', border: '1px solid var(--border-default)' }} onClick={() => onApp?.(a.key)}><Logo app={a} size={14} />{a.name} walkthrough</button>)}
      </div>
    </div>
  );
}
