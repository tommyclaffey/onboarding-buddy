// Email: SMTP (against a local fake server), Google sign-in (faked), encryption, permissions. Run: npm test
import assert from 'node:assert/strict';
import net from 'node:net';
import { after, before, describe, it } from 'node:test';
process.env.OB_SECRET_KEY = 'test-secret-key';
const { openDb } = await import('../server/db.mjs');
const { startServer } = await import('../server/index.mjs');
const { SEED_PASSWORD, seed, seedOtherOrg } = await import('../server/seed.mjs');
const { deliver } = await import('../server/mail/index.mjs');

// A fake SMTP server: accepts user "people@brightside.test" / "right-password", stores messages.
const inbox = [];
function fakeSmtp() {
  return new Promise((resolve) => {
    const server = net.createServer((sock) => {
      let buf = '', data = false, msg = '';
      sock.write('220 fake ESMTP\r\n');
      sock.on('data', (d) => {
        buf += d.toString();
        let i;
        while ((i = buf.indexOf('\r\n')) >= 0) {
          const line = buf.slice(0, i); buf = buf.slice(i + 2);
          if (data) {
            if (line === '.') { data = false; inbox.push(msg); msg = ''; sock.write('250 queued\r\n'); } else msg += line + '\r\n';
            continue;
          }
          const cmd = line.split(' ')[0].toUpperCase();
          if (cmd === 'EHLO') sock.write('250-fake\r\n250-AUTH PLAIN LOGIN\r\n250 OK\r\n');
          else if (cmd === 'AUTH') {
            const [, user, pass] = Buffer.from(line.split(' ')[2], 'base64').toString().split('\0');
            sock.write(user === 'people@brightside.test' && pass === 'right-password' ? '235 ok\r\n' : '535 5.7.8 bad credentials\r\n');
          } else if (cmd === 'MAIL' || cmd === 'RCPT') sock.write('250 ok\r\n');
          else if (cmd === 'DATA') { data = true; sock.write('354 go\r\n'); }
          else if (cmd === 'QUIT') { sock.write('221 bye\r\n'); sock.end(); }
          else sock.write('502 no\r\n');
        }
      });
      sock.on('error', () => {});
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

let srv, base, ids, smtp, db;
before(async () => {
  db = openDb(':memory:');
  ids = (await seed(db)).users;
  await seedOtherOrg(db);
  srv = await startServer({ port: 0, db });
  base = `http://127.0.0.1:${srv.port}`;
  smtp = await fakeSmtp();
  deliver.smtpTestOptions = { allowPlain: true, connectHost: '127.0.0.1' };
});
after(() => { srv.server.close(); smtp.close(); delete deliver.smtpTestOptions; });

async function session(email) {
  const res = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-OB': '1' }, body: JSON.stringify({ email, password: SEED_PASSWORD }) });
  const cookie = res.headers.get('set-cookie').split(';')[0];
  const call = async (method, path, body) => {
    const r = await fetch(base + path, { method, redirect: 'manual', headers: { cookie, ...(method === 'GET' ? {} : { 'Content-Type': 'application/json', 'X-OB': '1' }) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, headers: r.headers, body: r.status === 302 ? null : await r.json() };
  };
  return { get: (p) => call('GET', p), post: (p, b = {}) => call('POST', p, b), patch: (p, b = {}) => call('PATCH', p, b), del: (p) => call('DELETE', p) };
}

const smtpBody = (over = {}) => ({ host: 'smtp.fake.test', port: smtp.address().port, user: 'people@brightside.test', password: 'right-password', fromAddress: 'people@brightside.test', fromName: 'Brightside People Ops', ...over });

describe('email permissions', () => {
  it('only admins can see or change email settings', async () => {
    const maya = await session('maya@brightside.test');
    assert.equal((await maya.get('/api/admin/email')).status, 403);
    assert.equal((await maya.post('/api/admin/email/smtp', smtpBody())).status, 403);
  });
});

describe('SMTP', () => {
  it('rejects a wrong password before saving anything', async () => {
    const s = await session('priya@brightside.test');
    const r = await s.post('/api/admin/email/smtp', smtpBody({ password: 'wrong' }));
    assert.equal(r.status, 422);
    assert.equal(r.body.field, 'password');
    assert.match(r.body.error, /username or password/);
    assert.equal((await s.get('/api/admin/email')).body.connection, null);
  });
  it('saves a working login, encrypts the password, and never returns it', async () => {
    const s = await session('priya@brightside.test');
    const r = await s.post('/api/admin/email/smtp', smtpBody());
    assert.equal(r.status, 200);
    assert.equal(r.body.connection.provider, 'smtp');
    assert.equal(r.body.connection.smtp.hasPassword, true);
    assert.equal(JSON.stringify(r.body).includes('right-password'), false);
    const row = db.prepare('SELECT secret_enc FROM email_settings').get();
    assert.ok(row.secret_enc.startsWith('v1:'));
    assert.equal(row.secret_enc.includes('right-password'), false);
  });
  it('another company can’t see Brightside’s connection', async () => {
    const n = await session('admin@northwind.test');
    assert.equal((await n.get('/api/admin/email')).body.connection, null);
  });
  it('sends a test email and a real invite through the company’s server', async () => {
    const s = await session('priya@brightside.test');
    const t = await s.post('/api/admin/email/test');
    assert.equal(t.body.ok, true);
    assert.match(inbox.at(-1), /From: "Brightside People Ops" <people@brightside.test>/);
    assert.match(inbox.at(-1), /To: priya@brightside.test/);
    const inv = await s.post('/api/admin/hires', { name: 'Lee Park', email: 'lee@brightside.test', startDate: '2026-11-09', journeyId: 1, managerId: ids.jordan, buddyId: ids.sam });
    assert.equal(inv.status, 200);
    assert.equal(inv.body.invite.sent, true);
    assert.equal(inv.body.invite.via, 'smtp');
    assert.equal(inv.body.invite.link, undefined, 'link is only shown when the email didn’t go out');
    const raw = inbox.at(-1);
    assert.match(raw, /To: lee@brightside.test/);
    assert.match(raw, /Reply-To: "Priya Rao" <priya@brightside.test>/);
    const text = Buffer.from(raw.split('Content-Transfer-Encoding: base64\r\n\r\n')[1].split('\r\n--')[0].replace(/\r\n/g, ''), 'base64').toString();
    assert.match(text, /Day 1/);
    assert.match(text, /\/invite\/[\w-]{40,}/);
    const detail = await s.get(`/api/admin/hires/${inv.body.id}`);
    assert.equal(detail.body.invite.state, 'sent');
    const log = (await s.get('/api/admin/email')).body.recent;
    assert.equal(log[0].status, 'sent');
    assert.equal(log[0].kind, 'invite');
  });
  it('disconnecting falls back to not sending, with a link to share', async () => {
    const s = await session('priya@brightside.test');
    assert.equal((await s.del('/api/admin/email')).body.connection, null);
    const t = await s.post('/api/admin/email/test');
    assert.equal(t.body.ok, false);
  });
});

describe('Google sign-in', () => {
  it('connects via OAuth, checks the state, and sends through Gmail', async () => {
    process.env.GOOGLE_CLIENT_ID = 'cid'; process.env.GOOGLE_CLIENT_SECRET = 'csecret';
    const real = globalThis.fetch;
    const sent = [];
    globalThis.fetch = async (url, opts) => {
      const u = String(url);
      if (u.startsWith('https://oauth2.googleapis.com/token')) return new Response(JSON.stringify({ access_token: 'at-1', refresh_token: 'rt-1', expires_in: 3600 }), { status: 200 });
      if (u.startsWith('https://openidconnect.googleapis.com')) return new Response(JSON.stringify({ email: 'People@Brightside.test', name: 'People' }), { status: 200 });
      if (u.startsWith('https://gmail.googleapis.com')) { sent.push({ auth: opts.headers.authorization, raw: JSON.parse(opts.body).raw }); return new Response('{}', { status: 200 }); }
      return real(url, opts);
    };
    try {
      const s = await session('priya@brightside.test');
      const avail = (await s.get('/api/admin/email')).body.available;
      assert.equal(avail.google, true);
      assert.equal(avail.microsoft, false);
      const start = await s.post('/api/admin/email/connect/google');
      const auth = new URL(start.body.url);
      assert.equal(auth.searchParams.get('scope').includes('gmail.send'), true);
      const state = auth.searchParams.get('state');
      const bad = await s.get('/api/oauth/google/callback?code=x&state=wrong');
      assert.match(decodeURIComponent(bad.headers.get('location')), /expired/);
      const other = await session('admin@northwind.test');
      const stolen = await other.get(`/api/oauth/google/callback?code=x&state=${state}`);
      assert.match(decodeURIComponent(stolen.headers.get('location')).replace(/\+/g, ' '), /same People Ops admin/);
      // The state is single-use, so start again for the real callback.
      const state2 = new URL((await s.post('/api/admin/email/connect/google')).body.url).searchParams.get('state');
      const ok = await s.get(`/api/oauth/google/callback?code=good&state=${state2}`);
      assert.equal(ok.status, 302);
      assert.equal(ok.headers.get('location'), '/admin/settings/email?connected=google');
      const conn = (await s.get('/api/admin/email')).body.connection;
      assert.equal(conn.provider, 'google');
      assert.equal(conn.fromAddress, 'people@brightside.test');
      const t = await s.post('/api/admin/email/test');
      assert.equal(t.body.ok, true);
      assert.equal(sent[0].auth, 'Bearer at-1');
      assert.match(Buffer.from(sent[0].raw, 'base64url').toString(), /To: priya@brightside.test/);
    } finally {
      globalThis.fetch = real;
      delete process.env.GOOGLE_CLIENT_ID; delete process.env.GOOGLE_CLIENT_SECRET;
    }
  });
  it('says plainly when a provider isn’t switched on', async () => {
    const s = await session('priya@brightside.test');
    const r = await s.post('/api/admin/email/connect/microsoft');
    assert.equal(r.status, 409);
    assert.match(r.body.error, /Other email/);
  });
});

describe('Day 1', () => {
  it('the second stage is called Day 1', () => {
    assert.ok(db.prepare("SELECT 1 FROM stages WHERE name = 'Day 1'").get());
    assert.equal(db.prepare("SELECT COUNT(*) n FROM stages WHERE name = 'Day One'").get().n, 0);
  });
});
