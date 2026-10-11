// Builds an RFC 5322 email (plain text + HTML) for SMTP and the Gmail API.
import { randomBytes } from 'node:crypto';

const ascii = (s) => /^[\x20-\x7e]*$/.test(s);
const word = (s) => (ascii(s) ? s : `=?UTF-8?B?${Buffer.from(s, 'utf8').toString('base64')}?=`);
const wrap = (b64) => b64.replace(/.{1,76}/g, '$&\r\n');

/** "Name <a@b.com>" with the name safely quoted or encoded. Strips line breaks (header injection). */
export function address({ name, address: addr }) {
  const a = String(addr || '').replace(/[\r\n<>]/g, '');
  const n = String(name || '').replace(/[\r\n"]/g, '').trim();
  if (!n) return a;
  return `${ascii(n) ? `"${n}"` : word(n)} <${a}>`;
}

export function buildMime({ from, to, replyTo, subject, text, html }) {
  const boundary = 'ob_' + randomBytes(12).toString('hex');
  const domain = String(from.address || 'localhost').split('@')[1] || 'localhost';
  const headers = [
    `From: ${address(from)}`,
    `To: ${address({ address: to })}`,
    replyTo ? `Reply-To: ${address(typeof replyTo === 'string' ? { address: replyTo } : replyTo)}` : null,
    `Subject: ${word(String(subject || '').replace(/[\r\n]/g, ' '))}`,
    `Date: ${new Date().toUTCString().replace('GMT', '+0000')}`,
    `Message-ID: <${randomBytes(16).toString('hex')}@${domain}>`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ].filter(Boolean);
  const part = (type, body) => [
    `--${boundary}`, `Content-Type: ${type}; charset=UTF-8`, 'Content-Transfer-Encoding: base64', '',
    wrap(Buffer.from(body, 'utf8').toString('base64')),
  ].join('\r\n');
  return headers.join('\r\n') + '\r\n\r\n' + part('text/plain', text) + '\r\n' + part('text/html', html || text) + `\r\n--${boundary}--\r\n`;
}
