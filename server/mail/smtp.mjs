// A small SMTP client (zero dependencies): implicit TLS on 465, STARTTLS elsewhere, AUTH PLAIN or LOGIN.
import net from 'node:net';
import tls from 'node:tls';

export class SmtpError extends Error {
  constructor(message, code) { super(message); this.code = code; }
}

/** People-readable reasons for common SMTP failures. */
export function smtpMessage(e) {
  if (e.code === 535 || e.code === 534) return 'The email server rejected the username or password. Check them, or use an app password if the account has 2-step sign-in.';
  if (e.code === 'ENOTFOUND') return 'That server name doesn’t exist. Check the spelling, for example smtp.yourcompany.com.';
  if (e.code === 'ECONNREFUSED' || e.code === 'ETIMEDOUT' || e.code === 'TIMEOUT') return 'We couldn’t reach that server on that port. Try port 587, or 465 for SSL.';
  if (e.code === 'NO_TLS') return 'That server won’t encrypt the connection, so we won’t send through it. Use port 587 or 465.';
  if (e.code === 550 || e.code === 553 || e.code === 554) return `The server refused the message: ${e.message}`;
  return `The email server said: ${e.message}`;
}

class Conn {
  constructor(socket, timeoutMs) {
    this.timeoutMs = timeoutMs;
    this.buf = '';
    this.lines = [];
    this.waiting = null;
    this.attach(socket);
  }
  attach(socket) {
    if (this.socket) this.socket.removeAllListeners('data');
    this.socket = socket;
    socket.setEncoding('utf8');
    socket.on('data', (d) => { this.buf += d; this.pump(); });
    socket.on('error', (e) => this.waiting?.reject(e));
  }
  pump() {
    let i;
    while ((i = this.buf.indexOf('\n')) >= 0) {
      const line = this.buf.slice(0, i).replace(/\r$/, '');
      this.buf = this.buf.slice(i + 1);
      this.lines.push(line);
      if (/^\d{3} /.test(line) || /^\d{3}$/.test(line)) {
        const lines = this.lines; this.lines = [];
        const w = this.waiting; this.waiting = null;
        w?.resolve({ code: Number(line.slice(0, 3)), lines, text: lines.map((l) => l.slice(4)).join(' ') });
      }
    }
  }
  read() {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(Object.assign(new Error('The email server stopped responding.'), { code: 'TIMEOUT' })), this.timeoutMs);
      this.waiting = { resolve: (v) => { clearTimeout(t); resolve(v); }, reject: (e) => { clearTimeout(t); reject(e); } };
      this.pump();
    });
  }
  async cmd(line, ok) {
    if (line != null) this.socket.write(line + '\r\n');
    const r = await this.read();
    if (!ok.includes(r.code)) throw new SmtpError(r.text || `Unexpected reply ${r.code}`, r.code);
    return r;
  }
}

function connect({ host, port, secure, timeoutMs, rejectUnauthorized }) {
  return new Promise((resolve, reject) => {
    const s = secure ? tls.connect({ host, port, servername: host, rejectUnauthorized }) : net.connect({ host, port });
    const t = setTimeout(() => { s.destroy(); reject(Object.assign(new Error('timeout'), { code: 'TIMEOUT' })); }, timeoutMs);
    s.once(secure ? 'secureConnect' : 'connect', () => { clearTimeout(t); resolve(s); });
    s.once('error', (e) => { clearTimeout(t); reject(e); });
  });
}

const caps = (r) => r.lines.map((l) => l.slice(4).toUpperCase());

/**
 * Send one message, or just check the login (verifyOnly).
 * `allowPlain` and `connectHost` are only for tests against a local fake server. Real servers must offer TLS.
 */
export async function smtpSend({ host, port, secure, user, pass, from, to, data, verifyOnly = false, timeoutMs = 15000, allowPlain = false, rejectUnauthorized = true, connectHost }) {
  const socket = await connect({ host: connectHost || host, port, secure, timeoutMs, rejectUnauthorized });
  const c = new Conn(socket, timeoutMs);
  try {
    await c.cmd(null, [220]);
    let ehlo = await c.cmd('EHLO onboarding-buddy', [250]);
    if (!secure) {
      if (caps(ehlo).includes('STARTTLS')) {
        await c.cmd('STARTTLS', [220]);
        const t = await new Promise((resolve, reject) => {
          const s = tls.connect({ socket, servername: host, rejectUnauthorized }, () => resolve(s));
          s.once('error', reject);
        });
        c.attach(t);
        ehlo = await c.cmd('EHLO onboarding-buddy', [250]);
      } else if (!allowPlain) {
        throw new SmtpError('No TLS', 'NO_TLS');
      }
    }
    if (user) {
      const auth = caps(ehlo).find((l) => l.startsWith('AUTH')) || '';
      if (auth.includes('PLAIN') || !auth.includes('LOGIN')) {
        await c.cmd('AUTH PLAIN ' + Buffer.from(`\0${user}\0${pass}`).toString('base64'), [235]);
      } else {
        await c.cmd('AUTH LOGIN', [334]);
        await c.cmd(Buffer.from(user).toString('base64'), [334]);
        await c.cmd(Buffer.from(pass).toString('base64'), [235]);
      }
    }
    if (!verifyOnly) {
      await c.cmd(`MAIL FROM:<${from}>`, [250]);
      await c.cmd(`RCPT TO:<${to}>`, [250, 251]);
      await c.cmd('DATA', [354]);
      const body = data.replace(/\r?\n/g, '\r\n').replace(/^\./gm, '..');
      await c.cmd(body + (body.endsWith('\r\n') ? '' : '\r\n') + '.', [250]);
    }
    c.socket.write('QUIT\r\n');
  } finally {
    setTimeout(() => c.socket.destroy(), 200).unref?.();
  }
}
