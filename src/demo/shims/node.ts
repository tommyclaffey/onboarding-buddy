// Browser stand-ins for node:fs, node:path and node:url. The static demo keeps everything in memory.
/* eslint-disable @typescript-eslint/no-explicit-any */
export const mkdirSync = () => undefined;
export const existsSync = () => false;
export const rmSync = () => undefined;
export const writeFileSync = () => undefined;
export const readFileSync = (): any => {
  throw new Error('No file system in the demo.');
};
export const resolve = (...a: string[]) => a.join('/');
export const join = (...a: string[]) => a.join('/');
export const dirname = (p: string) => p.split('/').slice(0, -1).join('/') || '.';
export const basename = (p: string) => p.split('/').pop() || '';
export const extname = (p: string) => (/\.[^./]*$/.exec(p) || [''])[0];
export const fileURLToPath = (u: any) => String(u);
export const pathToFileURL = (p: string) => ({ href: 'file://' + p });
const all = { mkdirSync, existsSync, rmSync, writeFileSync, readFileSync, resolve, join, dirname, basename, extname, fileURLToPath, pathToFileURL };
export default all;
