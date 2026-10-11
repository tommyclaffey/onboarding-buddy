// Encryption for stored secrets (SMTP passwords, OAuth tokens). AES-256-GCM.
// Key: OB_SECRET_KEY if set, otherwise a random key created once in DATA_DIR/secret.key (on the volume).
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

let KEY = null;

function key() {
  if (KEY) return KEY;
  if (process.env.OB_SECRET_KEY) return (KEY = createHash('sha256').update(process.env.OB_SECRET_KEY).digest());
  const file = path.resolve(process.env.DATA_DIR || 'data', 'secret.key');
  try {
    const k = Buffer.from(fs.readFileSync(file, 'utf8').trim(), 'base64');
    if (k.length === 32) return (KEY = k);
  } catch { /* first run */ }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const k = randomBytes(32);
  fs.writeFileSync(file, k.toString('base64'), { mode: 0o600 });
  return (KEY = k);
}

/** Encrypt any JSON value. Output: "v1:" + base64(iv | tag | ciphertext). */
export function seal(value) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([c.update(JSON.stringify(value), 'utf8'), c.final()]);
  return 'v1:' + Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64');
}

/** Decrypt what seal() made. Returns null if it's missing or can't be read (for example, the key changed). */
export function open(sealed) {
  if (!sealed || !String(sealed).startsWith('v1:')) return null;
  try {
    const b = Buffer.from(String(sealed).slice(3), 'base64');
    const d = createDecipheriv('aes-256-gcm', key(), b.subarray(0, 12));
    d.setAuthTag(b.subarray(12, 28));
    return JSON.parse(Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8'));
  } catch {
    return null;
  }
}
