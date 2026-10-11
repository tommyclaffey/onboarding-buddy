// Journey logic shared by routes and seed. Every function takes orgId and scopes by it.
import { json, now } from './db.mjs';
import { OWNER_LABEL, TYPE_LABEL, appInfo } from './catalog.mjs';
import { publicUser } from './auth.mjs';

export const DAY = 864e5;
export const isoDate = (d) => new Date(d).toISOString().slice(0, 10);
export const addDays = (date, n) => isoDate(new Date(date + 'T12:00:00Z').getTime() + n * DAY);
export const todayIso = () => isoDate(Date.now());
export const daysBetween = (a, b) => Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / DAY);

export function userById(db, orgId, id) {
  if (!id) return null;
  return db.prepare('SELECT * FROM users WHERE id = ? AND org_id = ?').get(id, orgId) || null;
}

export function dutyUser(db, orgId, duty) {
  return db.prepare('SELECT * FROM users WHERE org_id = ? AND duty = ? ORDER BY id LIMIT 1').get(orgId, duty) || null;
}

/** Who owns a task of `role` for this hire. */
export function ownerFor(db, hire, role) {
  if (role === 'hire') return hire;
  if (role === 'manager') return userById(db, hire.org_id, hire.manager_id);
  if (role === 'buddy') return userById(db, hire.org_id, hire.buddy_id);
  if (role === 'people_ops') return dutyUser(db, hire.org_id, 'people_ops');
  if (role === 'it') return dutyUser(db, hire.org_id, 'it');
  return null;
}

export const person = (u) => u && { id: u.id, name: u.name, first: u.name.split(' ')[0], title: u.title, photo: u.photo };

export function stagesFor(db, orgId, journeyId) {
  return db.prepare('SELECT * FROM stages WHERE org_id = ? AND journey_id = ? ORDER BY position').all(orgId, journeyId);
}

export function videoById(db, orgId, id) {
  if (!id) return null;
  return db.prepare('SELECT * FROM videos WHERE id = ? AND org_id = ?').get(id, orgId) || null;
}

export function videoShape(db, orgId, v) {
  if (!v) return null;
  const p = userById(db, orgId, v.presenter_id);
  return {
    id: v.id, kind: v.kind, title: v.title, durationSec: v.duration_sec, status: v.status, still: v.still,
    chapters: json(v.chapters, []), caption: v.caption, appKey: v.app_key, presenter: person(p), flagged: v.flagged, url: v.url || null,
  };
}

/** Make a hire's task list from their journey's templates. Safe to re-run: existing rows are kept. */
export function instantiateTasks(db, hire) {
  const ins = db.prepare('INSERT OR IGNORE INTO hire_tasks(org_id, hire_id, template_id) VALUES (?,?,?)');
  const tpls = db
    .prepare(
      `SELECT t.id FROM task_templates t JOIN stages s ON s.id = t.stage_id
       WHERE t.org_id = ? AND s.journey_id = ?`,
    )
    .all(hire.org_id, hire.journey_id);
  for (const t of tpls) ins.run(hire.org_id, hire.id, t.id);
}

/** Templates can say {buddy}; each hire sees their own buddy's first name. */
export const fillNames = (text, buddy) => (text == null ? text : String(text).replace(/\{buddy\}/g, buddy ? buddy.name.split(' ')[0] : 'your buddy'));

/** Everything about one hire's tasks, with owner, due date and status. */
export function hireTasks(db, hire) {
  const rows = db
    .prepare(
      `SELECT ht.id, ht.status, ht.done_at, ht.done_by, ht.data, t.id AS template_id, t.type, t.title, t.meta, t.emoji,
              t.owner_role, t.due_day, t.ref, t.position, s.id AS stage_id, s.position AS stage_pos, s.name AS stage_name, s.emoji AS stage_emoji
       FROM hire_tasks ht JOIN task_templates t ON t.id = ht.template_id JOIN stages s ON s.id = t.stage_id
       WHERE ht.org_id = ? AND ht.hire_id = ?
       ORDER BY s.position, t.due_day, t.position`,
    )
    .all(hire.org_id, hire.id);
  const owners = {};
  const ownerOf = (role) => (owners[role] ??= ownerFor(db, hire, role));
  const today = todayIso();
  return rows.map((r) => {
    const due = addDays(hire.start_date, r.due_day);
    const owner = ownerOf(r.owner_role);
    return {
      id: r.id, templateId: r.template_id, type: r.type, typeLabel: TYPE_LABEL[r.type], title: fillNames(r.title, ownerOf('buddy')), meta: fillNames(r.meta, ownerOf('buddy')), emoji: r.emoji,
      ownerRole: r.owner_role, ownerLabel: OWNER_LABEL[r.owner_role], owner: person(owner), ownerId: owner?.id ?? null,
      dueDay: r.due_day, dueDate: due, status: r.status, doneAt: r.done_at, ref: r.ref,
      overdue: r.status !== 'done' && due < today, dueToday: r.status !== 'done' && due === today,
      stageId: r.stage_id, stagePos: r.stage_pos, stageName: r.stage_name, stageEmoji: r.stage_emoji,
      data: json(r.data, null), app: r.type === 'app' ? appInfo(r.ref) : null,
    };
  });
}

/** Stages with progress, intro video and the apps they unlock. Current = first stage with work left for anyone. */
export function journeyFor(db, hire, tasks = hireTasks(db, hire)) {
  const stages = stagesFor(db, hire.org_id, hire.journey_id);
  let currentFound = false;
  const buddy = ownerFor(db, hire, 'buddy');
  return stages.map((s) => {
    const mine = tasks.filter((t) => t.stageId === s.id);
    const done = mine.filter((t) => t.status === 'done').length;
    const complete = mine.length > 0 && done === mine.length;
    let state = complete ? 'done' : 'upcoming';
    if (!complete && !currentFound) { state = 'current'; currentFound = true; }
    const apps = mine.filter((t) => t.type === 'app').map((t) => appInfo(t.ref)).filter(Boolean);
    return {
      id: s.id, position: s.position, name: s.name, emoji: s.emoji, tint: s.tint, window: s.window, summary: fillNames(s.summary, buddy),
      opens: addDays(hire.start_date, s.start_day ?? 0), state, total: mine.length, done,
      intro: videoShape(db, hire.org_id, videoById(db, hire.org_id, s.intro_video_id)),
      apps: [...new Map(apps.map((a) => [a.key, a])).values()],
      tasks: mine,
    };
  });
}

export function addMessage(db, orgId, userId, { from = null, kind = 'note', title, body = '', link = null, action = 0 }) {
  db.prepare(
    'INSERT INTO messages(org_id,user_id,from_id,kind,title,body,link,needs_action,created_at) VALUES (?,?,?,?,?,?,?,?,?)',
  ).run(orgId, userId, from, kind, title, body, link, action ? 1 : 0, now());
}

/** Mark a task done or not. Only its owner (or an admin) may change it. Returns the updated task. */
export function setTaskStatus(db, user, taskId, status, data = undefined) {
  const row = db.prepare('SELECT * FROM hire_tasks WHERE id = ? AND org_id = ?').get(taskId, user.org_id);
  if (!row) return { error: [404, 'That task doesn’t exist.'] };
  const hire = userById(db, user.org_id, row.hire_id);
  const tpl = db.prepare('SELECT * FROM task_templates WHERE id = ? AND org_id = ?').get(row.template_id, user.org_id);
  const owner = ownerFor(db, hire, tpl.owner_role);
  if (user.role !== 'admin' && owner?.id !== user.id) return { error: [403, 'Only the person who owns this task can change it.'] };
  db.prepare('UPDATE hire_tasks SET status = ?, done_at = ?, done_by = ?, data = COALESCE(?, data) WHERE id = ?').run(
    status, status === 'done' ? now() : null, status === 'done' ? user.id : null, data === undefined ? null : JSON.stringify(data), taskId,
  );
  return { hire, tpl };
}

export const me = (u) => publicUser(u);

/** Turn a pasted YouTube, Loom or Vimeo link into its embeddable URL. Returns null for anything else. */
export function toEmbed(raw) {
  let u;
  try { u = new URL(String(raw || '').trim()); } catch { return null; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  const host = u.hostname.replace(/^www\./, '').replace(/^m\./, '');
  const id = (s) => (/^[A-Za-z0-9_-]{6,64}$/.test(s || '') ? s : null);
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const v = id(u.searchParams.get('v')) || id(u.pathname.match(/^\/(?:shorts|embed|live)\/([^/?]+)/)?.[1]);
    return v ? `https://www.youtube-nocookie.com/embed/${v}` : null;
  }
  if (host === 'youtu.be') { const v = id(u.pathname.slice(1)); return v ? `https://www.youtube-nocookie.com/embed/${v}` : null; }
  if (host === 'loom.com') { const v = id(u.pathname.match(/^\/(?:share|embed)\/([^/?]+)/)?.[1]); return v ? `https://www.loom.com/embed/${v}` : null; }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') { const v = u.pathname.match(/(\d{6,12})/)?.[1]; return v ? `https://player.vimeo.com/video/${v}` : null; }
  return null;
}
