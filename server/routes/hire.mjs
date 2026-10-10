// New-hire endpoints. Every query is scoped to user.org_id; hires only ever see their own tasks.
import { DOCS, FORMS, appInfo } from '../catalog.mjs';
import { json, now, tx } from '../db.mjs';
import { fail, int } from '../http.mjs';
import {
  addMessage, daysBetween, dutyUser, hireTasks, journeyFor, person, setTaskStatus, todayIso, userById, videoById, videoShape,
} from '../queries.mjs';

const needHire = (user) => {
  if (!user) fail(401, 'Sign in to continue.');
  if (user.role !== 'hire') fail(403, 'This page is for new hires.');
  return user;
};
const sameName = (a, b) => String(a || '').trim().replace(/\s+/g, ' ').toLowerCase() === String(b || '').trim().toLowerCase();

function taskByRef(db, hire, type, ref) {
  return hireTasks(db, hire).find((t) => t.type === type && String(t.ref) === String(ref) && t.ownerRole === 'hire') || null;
}

export default function registerHire(router) {
  router.get('/api/today', ({ db, user }) => {
    const hire = needHire(user);
    const tasks = hireTasks(db, hire);
    const stages = journeyFor(db, hire, tasks);
    const current = stages.find((s) => s.state === 'current') || stages[stages.length - 1];
    const mine = tasks.filter((t) => t.ownerRole === 'hire');
    const open = mine.filter((t) => t.status !== 'done').sort((a, b) => a.stagePos - b.stagePos || a.dueDay - b.dueDay);
    const today = todayIso();
    const doneToday = mine.filter((t) => t.status === 'done' && t.doneAt?.slice(0, 10) === today);
    const buddy = userById(db, hire.org_id, hire.buddy_id);
    const manager = userById(db, hire.org_id, hire.manager_id);
    const peopleOps = dutyUser(db, hire.org_id, 'people_ops');
    const feeling = db.prepare('SELECT value FROM feelings WHERE hire_id = ? AND org_id = ? ORDER BY id DESC LIMIT 1').get(hire.id, hire.org_id);
    const w4 = db.prepare('SELECT step FROM form_answers WHERE hire_id = ? AND form_key = ?').get(hire.id, 'w4');
    return {
      me: { id: hire.id, name: hire.name, first: hire.name.split(' ')[0], photo: hire.photo },
      startDate: hire.start_date, daysToGo: Math.max(0, daysBetween(today, hire.start_date)),
      stage: { id: current.id, name: current.name, emoji: current.emoji, done: current.done, total: current.total, position: current.position },
      stages: stages.map((s) => ({ id: s.id, name: s.name, emoji: s.emoji, state: s.state, done: s.done, total: s.total })),
      now: open[0] ? { ...open[0], step: open[0].ref === 'w4' ? (w4?.step || 1) : null, steps: open[0].ref === 'w4' ? FORMS.w4.steps.map((s) => s.label) : null } : null,
      next: open.slice(1, 4),
      doneToday: doneToday.length,
      buddy: buddy && { ...person(buddy), quote: buddy.quote },
      manager: person(manager), peopleOps: person(peopleOps),
      feeling: feeling?.value ?? null,
    };
  });

  router.get('/api/journey', ({ db, user }) => {
    const hire = needHire(user);
    return { startDate: hire.start_date, stages: journeyFor(db, hire) };
  });

  router.get('/api/tasks/:id', ({ db, user, params }) => {
    const hire = needHire(user);
    const id = int(params.id, 'task');
    const task = hireTasks(db, hire).find((t) => t.id === id);
    if (!task) fail(404, 'That task doesn’t exist.');
    const out = { task };
    if (task.type === 'form' && FORMS[task.ref]) {
      const saved = db.prepare('SELECT step, answers, submitted_at FROM form_answers WHERE hire_id = ? AND form_key = ? AND org_id = ?').get(hire.id, task.ref, hire.org_id);
      out.form = FORMS[task.ref];
      out.saved = { step: saved?.step || 1, answers: json(saved?.answers, {}), submittedAt: saved?.submitted_at || null };
    }
    if (task.type === 'sign' && DOCS[task.ref]) {
      out.doc = DOCS[task.ref];
      out.signature = db.prepare('SELECT typed_name, signed_at FROM signatures WHERE hire_id = ? AND doc_key = ? AND org_id = ?').get(hire.id, task.ref, hire.org_id) || null;
    }
    if (task.type === 'video') {
      const v = videoById(db, hire.org_id, int(task.ref, 'video'));
      out.video = videoShape(db, hire.org_id, v);
      out.questions = db.prepare('SELECT id, prompt, options FROM quiz_questions WHERE video_id = ? AND org_id = ? ORDER BY position').all(v.id, hire.org_id)
        .map((q) => ({ id: q.id, prompt: q.prompt, options: json(q.options, []) }));
      out.series = db.prepare("SELECT t.title, ht.status, ht.id FROM hire_tasks ht JOIN task_templates t ON t.id = ht.template_id WHERE ht.hire_id = ? AND ht.org_id = ? AND t.type = 'video' ORDER BY t.due_day, t.position").all(hire.id, hire.org_id);
    }
    return out;
  });

  router.post('/api/tasks/:id/complete', ({ db, user, params, body }) => {
    if (!user) fail(401, 'Sign in to continue.');
    const r = setTaskStatus(db, user, int(params.id, 'task'), 'done', body?.data);
    if (r.error) fail(...r.error);
    return { ok: true };
  });

  // Save partial progress on a task (e.g. which "Try it now" items are ticked) without completing it.
  router.post('/api/tasks/:id/data', ({ db, user, params, body }) => {
    if (!user) fail(401, 'Sign in to continue.');
    const id = int(params.id, 'task');
    const row = db.prepare('SELECT ht.*, t.owner_role FROM hire_tasks ht JOIN task_templates t ON t.id = ht.template_id WHERE ht.id = ? AND ht.org_id = ?').get(id, user.org_id);
    if (!row || (row.hire_id !== user.id && user.role !== 'admin')) fail(404, 'That task doesn’t exist.');
    db.prepare('UPDATE hire_tasks SET data = ? WHERE id = ?').run(JSON.stringify(body?.data ?? null), id);
    return { ok: true };
  });

  router.post('/api/tasks/:id/undo', ({ db, user, params }) => {
    if (!user) fail(401, 'Sign in to continue.');
    const r = setTaskStatus(db, user, int(params.id, 'task'), 'todo');
    if (r.error) fail(...r.error);
    return { ok: true };
  });

  // Forms: save a step; the last step needs the hire's typed name as a signature.
  router.post('/api/forms/:key', ({ db, user, params, body }) => {
    const hire = needHire(user);
    const form = FORMS[params.key];
    if (!form) fail(404, 'That form doesn’t exist.');
    const step = form.steps.find((s) => s.id === Number(body.step));
    if (!step) fail(400, 'That step doesn’t exist.');
    const saved = db.prepare('SELECT answers FROM form_answers WHERE hire_id = ? AND form_key = ? AND org_id = ?').get(hire.id, form.key, hire.org_id);
    const answers = json(saved?.answers, {});
    if (step.options) {
      const value = body.answer;
      if (!value) fail(422, 'Pick one answer to continue.', { field: 'answer' });
      if (!step.options.some((o) => o.value === value)) fail(422, 'That answer isn’t one of the choices. Pick one of the options.');
      answers[step.id] = value;
    }
    let submitted = null;
    if (step.sign) {
      for (const s of form.steps.filter((s) => s.options)) if (!answers[s.id]) fail(422, `Step ${s.id} (${s.label}) still needs an answer.`, { step: s.id });
      if (!sameName(body.typedName, hire.name)) fail(422, `Type your full name exactly as it appears on your profile: ${hire.name}.`, { field: 'typedName' });
      submitted = now();
    }
    const nextStep = Math.min(form.steps.length, step.id + 1);
    tx(db, () => {
      db.prepare(
        `INSERT INTO form_answers(hire_id, org_id, form_key, step, answers, submitted_at, updated_at) VALUES (?,?,?,?,?,?,?)
         ON CONFLICT(hire_id, form_key) DO UPDATE SET step = excluded.step, answers = excluded.answers,
           submitted_at = COALESCE(excluded.submitted_at, form_answers.submitted_at), updated_at = excluded.updated_at`,
      ).run(hire.id, hire.org_id, form.key, submitted ? step.id : nextStep, JSON.stringify(answers), submitted, now());
      if (submitted) {
        const t = taskByRef(db, hire, 'form', form.key);
        if (t) setTaskStatus(db, hire, t.id, 'done');
        const po = dutyUser(db, hire.org_id, 'people_ops');
        if (po) addMessage(db, hire.org_id, po.id, { from: hire.id, kind: 'form', title: `${hire.name} submitted the W-4`, body: 'Ready to send to payroll.' });
      }
    });
    return { ok: true, step: submitted ? step.id : nextStep, submitted: !!submitted };
  });

  router.post('/api/sign/:doc', ({ db, user, params, body }) => {
    const hire = needHire(user);
    const doc = DOCS[params.doc];
    if (!doc) fail(404, 'That document doesn’t exist.');
    if (!body.agree) fail(422, 'Tick the box to say you’ve read it.', { field: 'agree' });
    if (!sameName(body.typedName, hire.name)) fail(422, `Type your full name exactly as it appears on your profile: ${hire.name}.`, { field: 'typedName' });
    tx(db, () => {
      db.prepare('INSERT OR REPLACE INTO signatures(hire_id, org_id, doc_key, typed_name, signed_at) VALUES (?,?,?,?,?)').run(hire.id, hire.org_id, doc.key, String(body.typedName).trim(), now());
      const t = taskByRef(db, hire, 'sign', doc.key);
      if (t) setTaskStatus(db, hire, t.id, 'done');
    });
    return { ok: true };
  });

  // Quick check: one question at a time. The right answer marks the lesson done.
  router.post('/api/videos/:id/quiz', ({ db, user, params, body }) => {
    const hire = needHire(user);
    const vid = int(params.id, 'video');
    const q = db.prepare('SELECT * FROM quiz_questions WHERE id = ? AND video_id = ? AND org_id = ?').get(int(body.questionId, 'question'), vid, hire.org_id);
    if (!q) fail(404, 'That question doesn’t exist.');
    const options = json(q.options, []);
    const pick = Number(body.answerIndex);
    if (!Number.isInteger(pick) || pick < 0 || pick >= options.length) fail(422, 'Pick an answer, then check it.');
    const correct = pick === q.correct_index;
    if (correct) {
      const t = taskByRef(db, hire, 'video', vid);
      if (t && t.status !== 'done') setTaskStatus(db, hire, t.id, 'done');
    }
    return { correct, explanation: correct ? q.explanation : q.wrong_hint };
  });

  // The standard App page: catalogue info + this company's version of it.
  router.get('/api/apps/:key', ({ db, user, params }) => {
    if (!user) fail(401, 'Sign in to continue.');
    const info = appInfo(params.key);
    const ca = info && db.prepare('SELECT * FROM connected_apps WHERE org_id = ? AND app_key = ?').get(user.org_id, info.key);
    if (!ca) fail(404, 'Your company hasn’t connected that app.');
    const stage = db.prepare('SELECT name, position FROM stages WHERE id = ? AND org_id = ?').get(ca.stage_id, user.org_id);
    const videos = db.prepare("SELECT * FROM videos WHERE org_id = ? AND app_key = ? AND status != 'missing' ORDER BY position").all(user.org_id, info.key).map((v) => videoShape(db, user.org_id, v));
    const owner = userById(db, user.org_id, ca.owner_id);
    let task = null;
    if (user.role === 'hire') task = taskByRef(db, user, 'app', info.key);
    return {
      app: info, stage: stage && { name: stage.name, position: stage.position }, roles: ca.roles,
      tryItems: json(ca.try_items, []), houseRules: json(ca.house_rules, []), owner: owner && { ...person(owner), duty: owner.duty, title: owner.title },
      videos, task: task && { id: task.id, status: task.status }, data: task?.data || null,
    };
  });

  router.get('/api/people', ({ db, user }) => {
    const hire = needHire(user);
    const buddy = userById(db, hire.org_id, hire.buddy_id);
    const manager = userById(db, hire.org_id, hire.manager_id);
    const crew = [manager, dutyUser(db, hire.org_id, 'people_ops'), dutyUser(db, hire.org_id, 'it')].filter(Boolean);
    const hello = (u) => {
      const v = db.prepare("SELECT * FROM videos WHERE org_id = ? AND kind = 'hello' AND presenter_id = ?").get(hire.org_id, u.id);
      return v ? videoShape(db, hire.org_id, v) : null;
    };
    const team = db.prepare("SELECT * FROM users WHERE org_id = ? AND team = ? AND id != ? ORDER BY name").all(hire.org_id, hire.team, hire.id);
    const meetings = hireTasks(db, hire).filter((t) => t.type === 'meeting');
    return {
      buddy: buddy && { ...person(buddy), quote: buddy.quote, askAbout: json(buddy.ask_about, []), hello: hello(buddy) },
      crew: crew.map((u) => ({ ...person(u), duty: u.duty, hello: hello(u) })),
      team: team.map((u) => ({ ...person(u), isBuddy: u.id === hire.buddy_id, isYou: false })),
      meetings,
    };
  });

  router.get('/api/inbox', ({ db, user }) => {
    if (!user) fail(401, 'Sign in to continue.');
    const rows = db.prepare('SELECT * FROM messages WHERE org_id = ? AND user_id = ? ORDER BY created_at DESC').all(user.org_id, user.id);
    return { messages: rows.map((m) => ({ id: m.id, kind: m.kind, title: m.title, body: m.body, link: m.link, action: !!m.needs_action, createdAt: m.created_at, read: !!m.read_at, from: person(userById(db, user.org_id, m.from_id)) })) };
  });

  router.post('/api/inbox/:id/read', ({ db, user, params }) => {
    if (!user) fail(401, 'Sign in to continue.');
    db.prepare('UPDATE messages SET read_at = COALESCE(read_at, ?) WHERE id = ? AND org_id = ? AND user_id = ?').run(now(), int(params.id), user.org_id, user.id);
    return { ok: true };
  });

  // Send a short message to someone at your company (Say hi, Message Priya). Lands in their Inbox.
  router.post('/api/messages', ({ db, user, body }) => {
    if (!user) fail(401, 'Sign in to continue.');
    const to = userById(db, user.org_id, int(body.toId, 'person'));
    if (!to) fail(404, 'That person isn’t at your company.');
    if (to.id === user.id) fail(422, 'That’s you. Pick someone else to message.');
    const text = String(body.body || '').trim();
    if (!text) fail(422, 'Write a message first.', { field: 'body' });
    if (text.length > 1000) fail(422, 'Keep it under 1,000 characters.', { field: 'body' });
    addMessage(db, user.org_id, to.id, { from: user.id, kind: 'note', title: `Message from ${user.name.split(' ')[0]}`, body: text, link: '/inbox' });
    return { ok: true, to: to.name.split(' ')[0] };
  });

  router.post('/api/feeling', ({ db, user, body }) => {
    const hire = needHire(user);
    const v = Number(body.value);
    if (!Number.isInteger(v) || v < 1 || v > 5) fail(422, 'Pick one of the five faces.');
    db.prepare('INSERT INTO feelings(org_id, hire_id, value, created_at) VALUES (?,?,?,?)').run(hire.org_id, hire.id, v, now());
    return { ok: true };
  });

  router.get('/api/tools', ({ db, user }) => {
    const hire = needHire(user);
    const tasks = hireTasks(db, hire);
    const it = tasks.filter((t) => t.ownerRole === 'it' || t.type === 'it');
    const apps = db.prepare('SELECT app_key FROM connected_apps WHERE org_id = ? ORDER BY id').all(hire.org_id).map((r) => appInfo(r.app_key)).filter(Boolean);
    const appTasks = tasks.filter((t) => t.type === 'app');
    return { it, apps: apps.map((a) => ({ ...a, task: appTasks.find((t) => t.ref === a.key) || null })), itPerson: person(dutyUser(db, hire.org_id, 'it')) };
  });
}
