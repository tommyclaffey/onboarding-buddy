// People Ops endpoints. Admin only, org-scoped.
import { APPS, OWNER_LABEL, TYPE_LABEL, appInfo } from '../catalog.mjs';
import { json, now, tx } from '../db.mjs';
import { inviteStatus, sendInvite } from '../invites.mjs';
import { fail, int } from '../http.mjs';
import {
  toEmbed, addMessage, addDays, daysBetween, dutyUser, hireTasks, instantiateTasks, journeyFor, person, stagesFor, todayIso, userById, videoShape,
} from '../queries.mjs';

const needAdmin = (user) => {
  if (!user) fail(401, 'Sign in to continue.');
  if (user.role !== 'admin') fail(403, 'Only People Ops can open this page.');
  return user;
};

const TYPES = Object.keys(TYPE_LABEL);
const ROLES = Object.keys(OWNER_LABEL);

/** Third business day after start (I-9 Section 2). */
function businessDaysAfter(date, n) {
  let d = new Date(date + 'T12:00:00Z');
  let left = n;
  while (left > 0) {
    d = new Date(d.getTime() + 864e5);
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) left--;
  }
  return d.toISOString().slice(0, 10);
}

function hireSummary(db, h) {
  const tasks = hireTasks(db, h);
  const stages = journeyFor(db, h, tasks);
  const cur = stages.find((s) => s.state === 'current') || stages[stages.length - 1];
  const overdue = tasks.filter((t) => t.overdue);
  const today = todayIso();
  let status = { tone: 'success', label: 'On track' };
  if (overdue.length) status = { tone: 'danger', label: `${overdue.length} overdue` };
  else if (h.start_date > today && daysBetween(today, h.start_date) > 14) status = { tone: 'neutral', label: 'Invite sent' };
  const missing = db.prepare("SELECT COUNT(*) n FROM videos v JOIN connected_apps c ON c.app_key = v.app_key AND c.org_id = v.org_id WHERE v.org_id = ? AND v.status = 'missing'").get(h.org_id).n;
  if (!overdue.length && missing && h.title?.toLowerCase().includes('engineer')) status = { tone: 'warning', label: 'Missing video' };
  return {
    ...person(h), title: h.title, startDate: h.start_date, stage: { name: cur?.name, emoji: cur?.emoji },
    done: cur?.done ?? 0, total: cur?.total ?? 0, status,
  };
}

export default function registerAdmin(router) {
  router.get('/api/admin/overview', ({ db, user }) => {
    const admin = needAdmin(user);
    const hires = db.prepare("SELECT * FROM users WHERE org_id = ? AND role = 'hire' ORDER BY start_date").all(admin.org_id);
    const summaries = hires.map((h) => hireSummary(db, h));
    const needs = [];
    for (const h of hires) {
      const tasks = hireTasks(db, h);
      const i9 = tasks.find((t) => t.ref === 'i9' && t.status !== 'done');
      if (i9) needs.push({ kind: 'i9', title: `${h.name.split(' ')[0]}’s I-9 document check is due ${i9.dueDate}`, body: 'Section 2, within 3 business days of starting.', hireId: h.id, action: 'Schedule check', due: i9.dueDate });
      const w4 = tasks.find((t) => t.ref === 'w4' && t.status !== 'done' && t.dueDate <= todayIso());
      if (w4) needs.push({ kind: 'nudge', title: `${h.name.split(' ')[0]}’s W-4 is due ${w4.dueDate === todayIso() ? 'today' : w4.dueDate}`, body: 'A friendly nudge usually does it.', hireId: h.id, action: 'Nudge', due: w4.dueDate });
    }
    for (const v of db.prepare("SELECT * FROM videos WHERE org_id = ? AND status = 'missing'").all(admin.org_id)) {
      needs.push({ kind: 'video', title: `${v.title} hasn’t been recorded yet`, body: 'New hires would see an empty section.', appKey: v.app_key, action: 'Record walkthrough' });
    }
    needs.sort((a, b) => String(a.due || '9').localeCompare(String(b.due || '9')));
    const upcoming = hires.map((h) => ({ date: h.start_date, label: `${h.name.split(' ')[0]}’s Day 1` })).filter((x) => x.date >= todayIso()).slice(0, 4);
    const feelings = db.prepare('SELECT value FROM feelings f WHERE org_id = ? AND id IN (SELECT MAX(id) FROM feelings WHERE org_id = ? GROUP BY hire_id)').all(admin.org_id, admin.org_id);
    const mood = feelings.length ? Math.round(feelings.reduce((a, b) => a + b.value, 0) / feelings.length) : null;
    return { hires: summaries, needs: needs.slice(0, 5), upcoming, health: { ready: summaries.filter((s) => s.status.tone === 'success').length, total: summaries.length, mood } };
  });

  router.get('/api/admin/hires/:id', ({ db, user, params }) => {
    const admin = needAdmin(user);
    const h = userById(db, admin.org_id, int(params.id, 'person'));
    if (!h || h.role !== 'hire') fail(404, 'That person isn’t a new hire here.');
    const tasks = hireTasks(db, h);
    const stages = journeyFor(db, h, tasks);
    const cur = stages.find((s) => s.state === 'current') || stages[0];
    const byOwner = [];
    for (const role of ROLES) {
      const list = cur.tasks.filter((t) => t.ownerRole === role);
      if (!list.length) continue;
      byOwner.push({ role, label: OWNER_LABEL[role], person: list[0].owner, done: list.filter((t) => t.status === 'done').length, tasks: list });
    }
    const find = (ref) => tasks.find((t) => t.ref === ref);
    const paperwork = [
      { label: 'I-9 · Section 1', detail: 'Filled in by the new hire', due: h.start_date, status: find('i9-1')?.status === 'done' ? 'Done' : 'Due Day 1' },
      { label: 'I-9 · Section 2', detail: 'Document check, within 3 business days of starting', due: businessDaysAfter(h.start_date, 3), status: find('i9')?.status === 'done' ? 'Done' : 'Scheduled' },
      { label: 'Form W-4', detail: 'Federal tax withholding', due: find('w4')?.dueDate, status: find('w4')?.status === 'done' ? 'Done' : 'In progress' },
      { label: 'Direct deposit', detail: 'Bank details for payroll', due: find('direct_deposit')?.dueDate, status: find('direct_deposit')?.status === 'done' ? 'Done' : 'Not started' },
      { label: 'State new-hire report', detail: 'Usually within 20 days of the start date; some states are stricter', due: addDays(h.start_date, 20), status: 'Automatic' },
    ];
    const feeling = db.prepare('SELECT value, created_at FROM feelings WHERE hire_id = ? AND org_id = ? ORDER BY id DESC LIMIT 1').get(h.id, admin.org_id);
    const activity = tasks.filter((t) => t.doneAt).sort((a, b) => b.doneAt.localeCompare(a.doneAt)).slice(0, 5).map((t) => ({ at: t.doneAt, text: t.title }));
    const vids = tasks.filter((t) => t.type === 'video' || t.type === 'app');
    return {
      hire: { ...person(h), email: h.email, title: h.title, team: h.team, startDate: h.start_date, manager: person(userById(db, admin.org_id, h.manager_id)), buddy: person(userById(db, admin.org_id, h.buddy_id)) },
      summary: hireSummary(db, h), now: tasks.find((t) => t.ownerRole === 'hire' && t.status !== 'done') || null,
      stage: { name: cur.name, done: cur.done, total: cur.total }, byOwner, paperwork, feeling, activity,
      videos: { done: vids.filter((t) => t.status === 'done').length, total: vids.length },
      invite: inviteStatus(db, admin.org_id, h),
      checkins: tasks.filter((t) => t.data && t.data.rating).map((t) => ({ title: t.title, at: t.doneAt, rating: t.data.rating, notes: t.data.notes || '', by: t.owner })),
    };
  });

  router.get('/api/admin/journeys/:id', ({ db, user, params }) => {
    const admin = needAdmin(user);
    const j = db.prepare('SELECT * FROM journeys WHERE id = ? AND org_id = ?').get(int(params.id, 'journey'), admin.org_id);
    if (!j) fail(404, 'That journey doesn’t exist.');
    const people = { people_ops: person(dutyUser(db, admin.org_id, 'people_ops')), it: person(dutyUser(db, admin.org_id, 'it')) };
    const anyHire = db.prepare("SELECT * FROM users WHERE org_id = ? AND journey_id = ? AND role = 'hire' LIMIT 1").get(admin.org_id, j.id);
    if (anyHire) { people.manager = person(userById(db, admin.org_id, anyHire.manager_id)); people.buddy = person(userById(db, admin.org_id, anyHire.buddy_id)); }
    const used = db.prepare("SELECT COUNT(*) n FROM users WHERE org_id = ? AND journey_id = ? AND role = 'hire'").get(admin.org_id, j.id).n;
    const stages = stagesFor(db, admin.org_id, j.id).map((s) => ({
      id: s.id, name: s.name, emoji: s.emoji, tint: s.tint, window: s.window,
      intro: videoShape(db, admin.org_id, db.prepare('SELECT * FROM videos WHERE id = ? AND org_id = ?').get(s.intro_video_id, admin.org_id)),
      tasks: db.prepare('SELECT * FROM task_templates WHERE stage_id = ? AND org_id = ? ORDER BY due_day, position').all(s.id, admin.org_id).map((t) => ({
        id: t.id, type: t.type, typeLabel: TYPE_LABEL[t.type], title: t.title, meta: t.meta, emoji: t.emoji, ownerRole: t.owner_role,
        ownerLabel: OWNER_LABEL[t.owner_role], owner: people[t.owner_role] || null, dueDay: t.due_day, ref: t.ref, app: t.type === 'app' ? appInfo(t.ref) : null,
      })),
    }));
    const editor = userById(db, admin.org_id, j.edited_by);
    return { journey: { id: j.id, name: j.name, editedBy: person(editor), editedAt: j.edited_at, usedBy: used, sampleHireId: anyHire?.id ?? null }, stages, people, types: TYPES.map((k) => ({ key: k, label: TYPE_LABEL[k] })), roles: ROLES.map((k) => ({ key: k, label: OWNER_LABEL[k] })) };
  });

  const validTemplate = (db, admin, b, partial = false) => {
    const out = {};
    if (!partial || b.title !== undefined) { const t = String(b.title || '').trim(); if (!t) fail(422, 'Give the task a name.', { field: 'title' }); if (t.length > 120) fail(422, 'Keep the task name under 120 characters.'); out.title = t; }
    if (!partial || b.type !== undefined) { if (!TYPES.includes(b.type)) fail(422, 'Pick a task type.', { field: 'type' }); out.type = b.type; }
    if (!partial || b.ownerRole !== undefined) { if (!ROLES.includes(b.ownerRole)) fail(422, 'Pick who owns this task.', { field: 'ownerRole' }); out.owner_role = b.ownerRole; }
    if (!partial || b.dueDay !== undefined) { const d = Number(b.dueDay); if (!Number.isInteger(d) || d < -60 || d > 180) fail(422, 'Due day must be a whole number between −60 and 180.', { field: 'dueDay' }); out.due_day = d; }
    if (b.meta !== undefined) out.meta = String(b.meta || '').slice(0, 160);
    if (b.emoji !== undefined) out.emoji = String(b.emoji || '').slice(0, 8);
    if (b.ref !== undefined) out.ref = b.ref == null ? null : String(b.ref).slice(0, 40);
    return out;
  };

  router.post('/api/admin/task-templates', ({ db, user, body }) => {
    const admin = needAdmin(user);
    const stage = db.prepare('SELECT * FROM stages WHERE id = ? AND org_id = ?').get(int(body.stageId, 'stage'), admin.org_id);
    if (!stage) fail(404, 'That stage doesn’t exist.');
    const v = validTemplate(db, admin, body);
    const id = tx(db, () => {
      const pos = db.prepare('SELECT COALESCE(MAX(position),0)+1 p FROM task_templates WHERE stage_id = ?').get(stage.id).p;
      const r = db.prepare('INSERT INTO task_templates(org_id, stage_id, position, type, title, meta, emoji, owner_role, due_day, ref) VALUES (?,?,?,?,?,?,?,?,?,?)')
        .run(admin.org_id, stage.id, pos, v.type, v.title, v.meta ?? '', v.emoji ?? '📝', v.owner_role, v.due_day, v.ref ?? null);
      for (const h of db.prepare("SELECT * FROM users WHERE org_id = ? AND journey_id = ? AND role = 'hire'").all(admin.org_id, stage.journey_id)) instantiateTasks(db, h);
      db.prepare('UPDATE journeys SET edited_by = ?, edited_at = ? WHERE id = ?').run(admin.id, now(), stage.journey_id);
      return Number(r.lastInsertRowid);
    });
    return { id };
  });

  router.patch('/api/admin/task-templates/:id', ({ db, user, params, body }) => {
    const admin = needAdmin(user);
    const t = db.prepare('SELECT * FROM task_templates WHERE id = ? AND org_id = ?').get(int(params.id, 'task'), admin.org_id);
    if (!t) fail(404, 'That task doesn’t exist.');
    const v = validTemplate(db, admin, body, true);
    const keys = Object.keys(v);
    if (keys.length) db.prepare(`UPDATE task_templates SET ${keys.map((k) => k + ' = ?').join(', ')} WHERE id = ?`).run(...keys.map((k) => v[k]), t.id);
    return { ok: true };
  });

  router.delete('/api/admin/task-templates/:id', ({ db, user, params }) => {
    const admin = needAdmin(user);
    const t = db.prepare('SELECT * FROM task_templates WHERE id = ? AND org_id = ?').get(int(params.id, 'task'), admin.org_id);
    if (!t) fail(404, 'That task doesn’t exist.');
    tx(db, () => {
      db.prepare('DELETE FROM hire_tasks WHERE template_id = ? AND org_id = ?').run(t.id, admin.org_id);
      db.prepare('DELETE FROM task_templates WHERE id = ?').run(t.id);
    });
    return { ok: true };
  });

  const appDetail = (db, orgId, key) => {
    const info = appInfo(key);
    const ca = info && db.prepare('SELECT * FROM connected_apps WHERE org_id = ? AND app_key = ?').get(orgId, info.key);
    if (!ca) return null;
    const videos = db.prepare('SELECT * FROM videos WHERE org_id = ? AND app_key = ? ORDER BY position').all(orgId, info.key).map((v) => videoShape(db, orgId, v));
    const missing = videos.filter((v) => v.status === 'missing');
    const flagged = videos.filter((v) => v.status === 'needs_update');
    let status = { tone: 'success', label: 'Up to date', line: `All ${videos.length} videos are current. Nothing needs you.`, action: 'Record another video' };
    if (flagged.length) status = { tone: 'warning', label: `${flagged[0].flagged} people flagged it`, line: `New hires said “${flagged[0].title}” looks out of date.`, action: 'Re-record it' };
    if (missing.length) status = { tone: 'warning', label: `${missing[0].title} missing`, line: `${missing[0].title} isn’t recorded yet.`, action: 'Record it' };
    const stage = db.prepare('SELECT id, name FROM stages WHERE id = ? AND org_id = ?').get(ca.stage_id, orgId);
    const watchers = db.prepare("SELECT COUNT(*) n, SUM(ht.status = 'done') d FROM hire_tasks ht JOIN task_templates t ON t.id = ht.template_id WHERE ht.org_id = ? AND t.type = 'app' AND t.ref = ?").get(orgId, info.key);
    return {
      app: info, stage, roles: ca.roles, tryItems: json(ca.try_items, []), houseRules: json(ca.house_rules, []),
      owner: person(userById(db, orgId, ca.owner_id)), connectedBy: person(userById(db, orgId, ca.connected_by)), connectedAt: ca.connected_at,
      videos, status, finished: { done: watchers.d || 0, total: watchers.n || 0 },
    };
  };

  router.get('/api/admin/apps', ({ db, user }) => {
    const admin = needAdmin(user);
    const connected = db.prepare('SELECT app_key FROM connected_apps WHERE org_id = ? ORDER BY id').all(admin.org_id).map((r) => appDetail(db, admin.org_id, r.app_key));
    const keys = new Set(connected.map((c) => c.app.key));
    return { connected, available: Object.values(APPS).filter((a) => !keys.has(a.key)) };
  });

  router.get('/api/admin/apps/:key', ({ db, user, params }) => {
    const admin = needAdmin(user);
    const d = appDetail(db, admin.org_id, params.key);
    if (!d) fail(404, 'That app isn’t connected.');
    return { ...d, stages: stagesFor(db, admin.org_id, db.prepare('SELECT journey_id FROM stages WHERE id = ?').get(d.stage?.id)?.journey_id ?? 0).map((s) => ({ id: s.id, name: s.name })) };
  });

  router.patch('/api/admin/apps/:key', ({ db, user, params, body }) => {
    const admin = needAdmin(user);
    const ca = db.prepare('SELECT * FROM connected_apps WHERE org_id = ? AND app_key = ?').get(admin.org_id, params.key);
    if (!ca) fail(404, 'That app isn’t connected.');
    const sets = {};
    if (body.tryItems !== undefined) {
      if (!Array.isArray(body.tryItems)) fail(422, 'Try it now needs a list.');
      const items = body.tryItems.map((s) => String(s || '').trim()).filter(Boolean);
      if (!items.length) fail(422, 'Keep at least one Try it now item, so new hires have something to do.', { field: 'tryItems' });
      if (items.length > 5) fail(422, 'Keep Try it now to 5 items or fewer.');
      if (items.some((s) => s.length > 90)) fail(422, 'Keep each Try it now item under 90 characters.');
      sets.try_items = JSON.stringify(items);
    }
    if (body.houseRules !== undefined) {
      if (!Array.isArray(body.houseRules)) fail(422, 'House rules need a list.');
      const rules = body.houseRules.map((r) => ({ emoji: String(r?.emoji || '💡').slice(0, 8), title: String(r?.title || '').trim(), body: String(r?.body || '').trim() })).filter((r) => r.title);
      if (rules.some((r) => r.title.length > 60 || r.body.length > 160)) fail(422, 'Keep titles under 60 characters and descriptions under 160.');
      sets.house_rules = JSON.stringify(rules);
    }
    if (body.stageId !== undefined) {
      const s = db.prepare('SELECT id FROM stages WHERE id = ? AND org_id = ?').get(int(body.stageId, 'stage'), admin.org_id);
      if (!s) fail(422, 'That stage doesn’t exist.');
      sets.stage_id = s.id;
    }
    const keys = Object.keys(sets);
    if (keys.length) db.prepare(`UPDATE connected_apps SET ${keys.map((k) => k + ' = ?').join(', ')} WHERE id = ?`).run(...keys.map((k) => sets[k]), ca.id);
    return appDetail(db, admin.org_id, params.key);
  });

  router.post('/api/admin/apps/:key/connect', ({ db, user, params }) => {
    const admin = needAdmin(user);
    const info = appInfo(params.key);
    if (!info) fail(404, 'We don’t support that app yet.');
    const firstStage = db.prepare('SELECT s.id FROM stages s WHERE s.org_id = ? ORDER BY s.journey_id, s.position LIMIT 1 OFFSET 2').get(admin.org_id);
    db.prepare('INSERT OR IGNORE INTO connected_apps(org_id, app_key, stage_id, roles, try_items, house_rules, owner_id, connected_by, connected_at) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(admin.org_id, info.key, firstStage?.id ?? null, 'All roles', JSON.stringify([`Open ${info.name} and sign in`]), '[]', admin.id, admin.id, now());
    return appDetail(db, admin.org_id, info.key);
  });

  // Send a friendly nudge to a new hire about their next task. Lands in their Inbox.
  router.post('/api/admin/hires/:id/nudge', ({ db, user, params }) => {
    const admin = needAdmin(user);
    const h = userById(db, admin.org_id, int(params.id, 'person'));
    if (!h || h.role !== 'hire') fail(404, 'That person isn’t a new hire here.');
    const next = hireTasks(db, h).find((t) => t.ownerRole === 'hire' && t.status !== 'done');
    if (!next) fail(422, `${h.name.split(' ')[0]} has nothing left to do right now, so there’s nothing to nudge.`);
    const recent = db.prepare("SELECT created_at FROM messages WHERE org_id = ? AND user_id = ? AND kind = 'nudge' ORDER BY id DESC LIMIT 1").get(admin.org_id, h.id);
    if (recent && Date.now() - new Date(recent.created_at).getTime() < 6 * 3600_000) fail(429, `You nudged ${h.name.split(' ')[0]} in the last 6 hours. Give it a little time.`);
    addMessage(db, admin.org_id, h.id, { from: admin.id, kind: 'nudge', title: `A friendly nudge: ${next.title}`, body: `${next.dueToday ? 'It’s due today.' : next.overdue ? 'It’s a little overdue, no stress.' : 'Whenever you have a few minutes.'} ${next.meta || ''}`.trim(), link: next.type === 'app' ? `/apps/${next.ref}` : `/tasks/${next.id}`, action: 1 });
    return { ok: true, task: next.title, first: h.name.split(' ')[0] };
  });

  // Everyone at the company, for choosing a manager and buddy.
  router.get('/api/admin/people', ({ db, user }) => {
    const admin = needAdmin(user);
    const people = db.prepare("SELECT * FROM users WHERE org_id = ? AND role != 'hire' ORDER BY name").all(admin.org_id).map((u) => ({ ...person(u), team: u.team, duty: u.duty }));
    const journeys = db.prepare('SELECT id, name FROM journeys WHERE org_id = ? ORDER BY name').all(admin.org_id);
    return { people, journeys };
  });

  // Invite a new hire: creates their account and their whole journey. Returns a one-time temporary password.
  router.post('/api/admin/hires', async ({ db, user, body }) => {
    const admin = needAdmin(user);
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const errors = {};
    if (name.split(/\s+/).length < 2) errors.name = 'Enter their first and last name.';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.email = 'Enter a work email like name@company.com.';
    else if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) errors.email = 'Someone already uses that email.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.startDate || ''))) errors.startDate = 'Pick their first day.';
    const journey = db.prepare('SELECT * FROM journeys WHERE id = ? AND org_id = ?').get(Number(body.journeyId), admin.org_id);
    if (!journey) errors.journeyId = 'Pick a journey.';
    const mgr = body.managerId ? userById(db, admin.org_id, Number(body.managerId)) : null;
    const bud = body.buddyId ? userById(db, admin.org_id, Number(body.buddyId)) : null;
    if (!mgr) errors.managerId = 'Pick their manager.';
    if (!bud) errors.buddyId = 'Pick a buddy. A real person makes the first weeks much easier.';
    const first = Object.keys(errors)[0];
    if (first) fail(422, errors[first], { field: first, errors });
    // No password yet: the hire picks their own from the emailed invite link.
    const id = tx(db, () => {
      const r = db.prepare("INSERT INTO users(org_id,email,name,title,team,role,start_date,manager_id,buddy_id,journey_id,password_hash,created_at) VALUES (?,?,?,?,?,'hire',?,?,?,?,NULL,?)")
        .run(admin.org_id, email, name, String(body.title || '').trim() || null, String(body.team || '').trim() || mgr.team, body.startDate, mgr.id, bud.id, journey.id, now());
      const hid = Number(r.lastInsertRowid);
      instantiateTasks(db, userById(db, admin.org_id, hid));
      addMessage(db, admin.org_id, hid, { from: admin.id, kind: 'system', title: `Welcome to ${db.prepare('SELECT name FROM orgs WHERE id = ?').get(admin.org_id).name}`, body: 'Everything you need before Day 1, one step at a time.', link: '/welcome' });
      addMessage(db, admin.org_id, bud.id, { from: admin.id, kind: 'note', title: `You’re ${name.split(' ')[0]}’s buddy`, body: `${name} starts ${body.startDate}. Record a short hello and book a coffee chat.`, link: '/tasks', action: 1 });
      return hid;
    });
    const invite = await sendInvite(db, admin, userById(db, admin.org_id, id));
    return { id, invite };
  });

  // Send a fresh invite link (the old one stops working).
  router.post('/api/admin/hires/:id/invite', async ({ db, user, params }) => {
    const admin = needAdmin(user);
    const h = userById(db, admin.org_id, int(params.id, 'person'));
    if (!h || h.role !== 'hire') fail(404, 'That person isn’t a new hire here.');
    if (h.password_hash) fail(409, `${h.name.split(' ')[0]} already set up their account. They can sign in with their email.`);
    return { invite: await sendInvite(db, admin, h) };
  });

  // Attach a real video (YouTube, Loom or Vimeo link) to an existing video slot. Publishes it.
  router.post('/api/admin/videos/:id/link', ({ db, user, params, body }) => {
    const admin = needAdmin(user);
    const v = db.prepare('SELECT * FROM videos WHERE id = ? AND org_id = ?').get(int(params.id, 'video'), admin.org_id);
    if (!v) fail(404, 'That video doesn’t exist.');
    const url = toEmbed(body.url);
    if (!url) fail(422, 'Paste a YouTube, Loom or Vimeo link, like https://www.loom.com/share/… or https://youtu.be/…', { field: 'url' });
    db.prepare("UPDATE videos SET url = ?, status = 'published', flagged = 0 WHERE id = ?").run(url, v.id);
    return videoShape(db, admin.org_id, db.prepare('SELECT * FROM videos WHERE id = ?').get(v.id));
  });

  // Add a new walkthrough video to a connected app from a link.
  router.post('/api/admin/apps/:key/videos', ({ db, user, params, body }) => {
    const admin = needAdmin(user);
    const ca = db.prepare('SELECT * FROM connected_apps WHERE org_id = ? AND app_key = ?').get(admin.org_id, params.key);
    if (!ca) fail(404, 'That app isn’t connected.');
    const title = String(body.title || '').trim();
    if (!title) fail(422, 'Give the video a title, like “Getting around Slack”.', { field: 'title' });
    if (title.length > 80) fail(422, 'Keep the title under 80 characters.', { field: 'title' });
    const url = toEmbed(body.url);
    if (!url) fail(422, 'Paste a YouTube, Loom or Vimeo link, like https://www.loom.com/share/… or https://youtu.be/…', { field: 'url' });
    const pos = db.prepare('SELECT COALESCE(MAX(position),0)+1 p FROM videos WHERE org_id = ? AND app_key = ?').get(admin.org_id, ca.app_key).p;
    const r = db.prepare("INSERT INTO videos(org_id,kind,title,presenter_id,status,app_key,position,url,created_at) VALUES (?,'app',?,?,'published',?,?,?,?)")
      .run(admin.org_id, title, ca.owner_id || admin.id, ca.app_key, pos, url, now());
    return videoShape(db, admin.org_id, db.prepare('SELECT * FROM videos WHERE id = ?').get(Number(r.lastInsertRowid)));
  });

  router.get('/api/admin/videos', ({ db, user }) => {
    const admin = needAdmin(user);
    const vids = db.prepare('SELECT * FROM videos WHERE org_id = ? ORDER BY CASE status WHEN \'missing\' THEN 0 WHEN \'needs_update\' THEN 1 ELSE 2 END, kind, position').all(admin.org_id).map((v) => videoShape(db, admin.org_id, v));
    const total = vids.filter((v) => v.status !== 'missing').reduce((a, v) => a + (v.durationSec || 0), 0);
    return { videos: vids, stats: { count: vids.filter((v) => v.status !== 'missing').length, totalSec: total } };
  });
}
