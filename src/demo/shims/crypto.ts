// Browser stand-in for the parts of node:crypto the server uses. Demo only: passwords aren't
// checked in the static demo, so scrypt is a cheap stand-in, and sealing secrets is unsupported.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Buffer } from 'buffer';
import { sha256 } from '@noble/hashes/sha2.js';

export function randomBytes(n: number) {
  return Buffer.from(globalThis.crypto.getRandomValues(new Uint8Array(n)));
}
export function createHash(_alg: string) {
  const parts: Uint8Array[] = [];
  const api = {
    update(v: any) {
      parts.push(typeof v === 'string' ? Buffer.from(v, 'utf8') : Buffer.from(v));
      return api;
    },
    digest(enc?: string) {
      const out = Buffer.from(sha256(Buffer.concat(parts)));
      return enc ? out.toString(enc as any) : out;
    },
  };
  return api;
}
export function scrypt(pw: any, salt: any, keylen: number, _opts: any, cb: (e: any, k?: any) => void) {
  let block = Buffer.from(sha256(Buffer.concat([Buffer.from(String(pw)), Buffer.from(salt)])));
  while (block.length < keylen) block = Buffer.concat([block, Buffer.from(sha256(block))]);
  queueMicrotask(() => cb(null, block.subarray(0, keylen)));
}
export function timingSafeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}
const unsupported = () => {
  throw new Error('Not available in the demo.');
};
export const createCipheriv = unsupported;
export const createDecipheriv = unsupported;
export default { randomBytes, createHash, scrypt, timingSafeEqual, createCipheriv, createDecipheriv };
