// API tests: auth, org isolation, permissions, validation. Run: npm test
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { openDb } from '../server/db.mjs';
import { startServer } from '../server/index.mjs';
import { SEED_PASSWORD, seed, seedOtherOrg } from '../server/seed.mjs';

let srv, base, ids;
before(async () => {
  const db = openDb(':memory:');
  const r = await seed(db);
  ids = r.users;
  await seedOtherOrg(db);
  srv = await startServer({ port: 0, db });
  base = `http://127.0.0.1:${srv.port}`;
});
after(() => srv.server.close());

async function session(email) {
  const res = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-OB': '1' }, body: JSON.stringify({ email, password: SEED_PASSWORD }) });
  assert.equal(res.status, 200, 'login ' + email);
  const cookie = res.headers.get('set-cookie').split(';')[0];
  const call = async (method, path, body) => {
    const r = await fetch(base + path, { method, headers: { cookie, ...(method === 'GET' ? {} : { 'Content-Type': 'application/json', 'X-OB': '1' }) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, body: await r.json() };
  };
  return { get: (p) => call('GET', p), post: (p, b = {}) => call('POST', p, b), patch: (p, b = {}) => call('PATCH', p, b), del: (p) => call('DELETE', p) };
}

describe('auth', () => {
  it('rejects a wrong password with a plain-words message', async () => {
    const r = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-OB': '1' }, body: JSON.stringify({ email: 'hana@brightside.test', password: 'nope-nope-nope' }) });
    assert.equal(r.status, 401);
    assert.match((await r.json()).error, /don’t match/);
  });
  it('requires the X-OB header on writes', async () => {
    const r = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(r.status, 403);
  });
  it('never returns password hashes', async () => {
    const s = await session('hana@brightside.test');
    const me = await s.get('/api/me');
    assert.equal(JSON.stringify(me.body).includes('scrypt'), false);
  });
});

describe('org isolation', () => {
  it('an admin from another company sees none of Brightside', async () => {
    const s = await session('admin@northwind.test');
    const o = await s.get('/api/admin/overview');
    assert.equal(o.status, 200);
    assert.equal(o.body.hires.length, 0);
    assert.equal((await s.get(`/api/admin/hires/${ids.hana}`)).status, 404);
    assert.equal((await s.get('/api/admin/journeys/1')).status, 404);
    assert.equal((await s.get('/api/admin/apps/slack')).status, 404);
  });
  it('cannot change another company’s task', async () => {
    const hana = await session('hana@brightside.test');
    const task = (await hana.get('/api/today')).body.next[0];
    const other = await session('admin@northwind.test');
    assert.equal((await other.post(`/api/tasks/${task.id}/complete`)).status, 404);
  });
});

describe('permissions', () => {
  it('a new hire cannot open admin pages', async () => {
    const s = await session('hana@brightside.test');
    assert.equal((await s.get('/api/admin/overview')).status, 403);
  });
  it('only a task’s owner can complete it', async () => {
    const hana = await session('hana@brightside.test');
    const journey = (await hana.get('/api/journey')).body;
    const itTask = journey.stages[0].tasks.find((t) => t.ownerRole === 'it' && t.status !== 'done');
    assert.equal((await hana.post(`/api/tasks/${itTask.id}/complete`)).status, 403);
    const dev = await session('dev@brightside.test');
    assert.equal((await dev.post(`/api/tasks/${itTask.id}/complete`)).status, 200);
  });
});

describe('W-4 form', () => {
  it('asks for an answer, then saves, then needs the right name to submit', async () => {
    const s = await session('hana@brightside.test');
    const empty = await s.post('/api/forms/w4', { step: 2 });
    assert.equal(empty.status, 422);
    assert.equal(empty.body.error, 'Pick one answer to continue.');
    assert.equal((await s.post('/api/forms/w4', { step: 2, answer: 'one' })).body.step, 3);
    assert.equal((await s.post('/api/forms/w4', { step: 3, answer: 'none' })).body.step, 4);
    const wrong = await s.post('/api/forms/w4', { step: 4, typedName: 'Someone Else' });
    assert.equal(wrong.status, 422);
    assert.equal(wrong.body.field, 'typedName');
    const ok = await s.post('/api/forms/w4', { step: 4, typedName: 'hana liu' });
    assert.equal(ok.body.submitted, true);
    const today = (await s.get('/api/today')).body;
    assert.notEqual(today.now?.ref, 'w4');
  });
});

describe('quiz', () => {
  it('a wrong answer gives a hint, the right one marks the lesson done', async () => {
    const s = await session('hana@brightside.test');
    const lesson = (await s.get('/api/journey')).body.stages.flatMap((x) => x.tasks).find((t) => t.type === 'video' && t.title === 'Security basics');
    const detail = (await s.get(`/api/tasks/${lesson.id}`)).body;
    const q = detail.questions[0];
    const wrong = await s.post(`/api/videos/${detail.video.id}/quiz`, { questionId: q.id, answerIndex: 0 });
    assert.equal(wrong.body.correct, false);
    assert.ok(wrong.body.explanation);
    const right = await s.post(`/api/videos/${detail.video.id}/quiz`, { questionId: q.id, answerIndex: 1 });
    assert.equal(right.body.correct, true);
    assert.equal((await s.get(`/api/tasks/${lesson.id}`)).body.task.status, 'done');
  });
});

describe('admin', () => {
  it('validates and saves an app’s company version', async () => {
    const s = await session('priya@brightside.test');
    const bad = await s.patch('/api/admin/apps/slack', { tryItems: [] });
    assert.equal(bad.status, 422);
    const ok = await s.patch('/api/admin/apps/slack', { tryItems: ['Join #design', 'Set your status'] });
    assert.equal(ok.status, 200);
    assert.deepEqual(ok.body.tryItems, ['Join #design', 'Set your status']);
  });
  it('adds a task to a journey and gives it to existing hires', async () => {
    const s = await session('priya@brightside.test');
    const j = (await s.get('/api/admin/journeys/1')).body;
    const bad = await s.post('/api/admin/task-templates', { stageId: j.stages[2].id, type: 'todo', title: '', ownerRole: 'hire', dueDay: 2 });
    assert.equal(bad.body.field, 'title');
    const r = await s.post('/api/admin/task-templates', { stageId: j.stages[2].id, type: 'todo', title: 'Read the design principles', ownerRole: 'hire', dueDay: 2 });
    assert.equal(r.status, 200);
    const hana = await session('hana@brightside.test');
    const found = (await hana.get('/api/journey')).body.stages[2].tasks.some((t) => t.title === 'Read the design principles');
    assert.ok(found);
  });
});

describe('actions', () => {
  it('nudges a hire once, then asks to wait', async () => {
    const s = await session('priya@brightside.test');
    const r = await s.post(`/api/admin/hires/${ids.ana}/nudge`);
    assert.equal(r.status, 200);
    assert.equal((await s.post(`/api/admin/hires/${ids.ana}/nudge`)).status, 429);
    const ana = await session('ana@brightside.test');
    assert.ok((await ana.get('/api/inbox')).body.messages.some((m) => m.title.startsWith('A friendly nudge')));
  });
  it('sends a message to a colleague, not to yourself or another company', async () => {
    const hana = await session('hana@brightside.test');
    assert.equal((await hana.post('/api/messages', { toId: ids.sam, body: 'Hi Sam!' })).status, 200);
    assert.equal((await hana.post('/api/messages', { toId: ids.hana, body: 'me' })).status, 422);
    assert.equal((await hana.post('/api/messages', { toId: 999, body: 'x' })).status, 404);
  });
  it('invites a new hire with a full journey and validates fields', async () => {
    const s = await session('priya@brightside.test');
    const bad = await s.post('/api/admin/hires', { name: 'Solo', email: 'bad', startDate: '', journeyId: 1 });
    assert.equal(bad.status, 422);
    assert.equal(bad.body.field, 'name');
    const ok = await s.post('/api/admin/hires', { name: 'Rae Kim', email: 'rae@brightside.test', title: 'Designer', startDate: '2026-11-02', journeyId: 1, managerId: ids.jordan, buddyId: ids.sam });
    assert.equal(ok.status, 200);
    // No email connected in tests: nothing is sent, and the admin gets the link to share by hand.
    assert.equal(ok.body.invite.sent, false);
    assert.match(ok.body.invite.link, /\/invite\/[\w-]{40,}$/);
    const token = ok.body.invite.link.split('/invite/')[1];
    const noPw = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-OB': '1' }, body: JSON.stringify({ email: 'rae@brightside.test', password: '' }) });
    assert.equal(noPw.status, 400);
    const info = await (await fetch(base + '/api/invite/' + token)).json();
    assert.equal(info.first, 'Rae');
    const accept = (pw) => fetch(base + '/api/invite/' + token, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-OB': '1' }, body: JSON.stringify({ password: pw }) });
    assert.equal((await accept('short')).status, 422);
    const ok2 = await accept('rae-picks-a-long-one');
    assert.equal(ok2.status, 200);
    assert.ok(ok2.headers.get('set-cookie').includes('ob_session='));
    assert.equal((await accept('rae-picks-a-long-one')).status, 404, 'links work once');
    const login = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-OB': '1' }, body: JSON.stringify({ email: 'rae@brightside.test', password: 'rae-picks-a-long-one' }) });
    assert.equal(login.status, 200);
    const detail = await s.get(`/api/admin/hires/${ok.body.id}`);
    assert.equal(detail.body.invite.state, 'accepted');
    assert.equal((await s.post(`/api/admin/hires/${ok.body.id}/invite`)).status, 409);
  });
});

describe('video links', () => {
  it('turns pasted links into embeds and rejects anything else', async () => {
    const { toEmbed } = await import('../server/queries.mjs');
    assert.equal(toEmbed('https://youtu.be/dQw4w9WgXcQ'), 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    assert.equal(toEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3'), 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    assert.equal(toEmbed('https://www.loom.com/share/0281766fa2d04bb788eaf19e65135184'), 'https://www.loom.com/embed/0281766fa2d04bb788eaf19e65135184');
    assert.equal(toEmbed('https://vimeo.com/76979871'), 'https://player.vimeo.com/video/76979871');
    assert.equal(toEmbed('https://evil.example/watch?v=dQw4w9WgXcQ'), null);
    assert.equal(toEmbed('javascript:alert(1)'), null);
  });
  it('publishes a missing video from a link and adds new app videos', async () => {
    const s = await session('priya@brightside.test');
    const app = (await s.get('/api/admin/apps/linear')).body;
    const missing = app.videos.find((v) => v.status === 'missing');
    assert.equal((await s.post(`/api/admin/videos/${missing.id}/link`, { url: 'not a link' })).body.field, 'url');
    const ok = await s.post(`/api/admin/videos/${missing.id}/link`, { url: 'https://youtu.be/dQw4w9WgXcQ' });
    assert.equal(ok.body.status, 'published');
    const added = await s.post('/api/admin/apps/slack/videos', { title: 'Huddles', url: 'https://vimeo.com/76979871' });
    assert.equal(added.status, 200);
    const hana = await session('hana@brightside.test');
    assert.ok((await hana.get('/api/apps/slack')).body.videos.some((v) => v.title === 'Huddles' && v.url));
  });
});

describe('password', () => {
  it('checks the current password and length, then changes it', async () => {
    const s = await session('lina@brightside.test');
    assert.equal((await s.post('/api/auth/password', { current: 'wrong', next: 'a-much-longer-password' })).body.field, 'current');
    assert.equal((await s.post('/api/auth/password', { current: SEED_PASSWORD, next: 'short' })).body.field, 'next');
    assert.equal((await s.post('/api/auth/password', { current: SEED_PASSWORD, next: 'lina-new-password-2026' })).status, 200);
    const r = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-OB': '1' }, body: JSON.stringify({ email: 'lina@brightside.test', password: 'lina-new-password-2026' }) });
    assert.equal(r.status, 200);
  });
});

describe('Ask Buddy', () => {
  it('falls back to the FAQ when no API key is set', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const s = await session('hana@brightside.test');
    const r = await s.post('/api/buddy/ask', { question: 'What is a W-4?' });
    assert.equal(r.body.source, 'faq');
    assert.match(r.body.answer, /W-4/);
    assert.equal((await s.post('/api/buddy/ask', { question: '' })).status, 422);
  });
  it('asks Claude with only this company’s context, and enforces the daily limit', async () => {
    const real = globalThis.fetch;
    let sent;
    globalThis.fetch = async (url, opts) => {
      if (String(url).startsWith('https://api.anthropic.com')) { sent = JSON.parse(opts.body); return new Response(JSON.stringify({ content: [{ type: 'text', text: 'Your laptop ships before Day One.' }] }), { status: 200 }); }
      return real(url, opts);
    };
    process.env.ANTHROPIC_API_KEY = 'test-key';
    process.env.BUDDY_PER_USER = '2';
    try {
      const s = await session('sam@brightside.test');
      const r = await s.post('/api/buddy/ask', { question: 'When does the laptop arrive?' });
      assert.equal(r.body.source, 'ai');
      assert.equal(r.body.answer, 'Your laptop ships before Day One.');
      assert.equal(sent.model, 'claude-haiku-4-5');
      assert.match(sent.system, /Brightside/);
      assert.match(sent.system, /Employee handbook/);
      assert.doesNotMatch(sent.system, /Northwind|Nora/);
      assert.equal((await s.post('/api/buddy/ask', { question: 'Second?' })).status, 200);
      const third = await s.post('/api/buddy/ask', { question: 'Third?' });
      assert.equal(third.status, 429);
      assert.match(third.body.error, /daily limit/);
    } finally {
      globalThis.fetch = real;
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.BUDDY_PER_USER;
    }
  });
});
