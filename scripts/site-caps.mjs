// Marketing-site captures: 1440 × 930 viewport at 2x (2880 × 1860 PNGs), one per JOBS entry.
// JOBS='name=/path|optional Ask Buddy question;name2=/path2' AS=hana@brightside.test node scripts/site-caps.mjs [baseUrl] [outDir]
// Needs a running server (npm start or npm run dev) and Google Chrome.
//   node scripts/shots.mjs [baseUrl] [outDir]
// Prints, per screen and width: horizontal overflow (px) and contrast failures.
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const BASE = process.argv[2] ?? 'http://127.0.0.1:4600';
const OUT = process.argv[3] ?? '/tmp/ob-shots';
const WIDTHS = (process.env.WIDTHS ?? '1440').split(',').map(Number);
const AS = process.env.AS ?? 'hana@brightside.test';
const JOBS = (process.env.JOBS ?? '').split(';').filter(Boolean).map((j) => { const [name, rest] = j.split('='); const [path, q] = rest.split('|'); return { name, path, q }; });
mkdirSync(OUT, { recursive: true });

const port = 9471 + Math.floor(Math.random() * 100);
const profile = `/tmp/ob-shot-${process.pid}`;
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`, '--window-size=1440,1000', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws;
for (let i = 0; i < 60 && !ws; i++) {
  try {
    const page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page');
    if (page) ws = new WebSocket(page.webSocketDebuggerUrl);
  } catch {}
  await sleep(200);
}
if (ws.readyState !== 1) await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const pending = new Map();
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const evalJs = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;
await send('Page.enable'); await send('Runtime.enable');

// Sign in once (unless AS=none, for the public pages); the cookie carries across navigations.
await send('Page.navigate', { url: BASE + '/login' }); await sleep(1500);
const login = AS === 'none' ? 'skipped' : await evalJs(`fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json','X-OB':'1'},body:JSON.stringify({email:${JSON.stringify(AS)},password:${JSON.stringify(process.env.PW ?? 'buddy-demo-2026')}})}).then(r=>r.status)`);
console.log('login', AS, login);
if (AS !== 'none' && login !== 200) { console.error('Sign-in failed'); process.exit(1); }

await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 930, deviceScaleFactor: 2, mobile: false });
for (const j of JOBS) {
  await send('Page.navigate', { url: BASE + j.path }); await sleep(2200);
  if (j.q) {
    await evalJs(`(()=>{const i=document.getElementById('ask');const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(i,${JSON.stringify(j.q)});i.dispatchEvent(new Event('input',{bubbles:true}));i.form.requestSubmit();})()`);
    for (let k = 0; k < 40; k++) { await sleep(500); const done = await evalJs(`!!document.querySelector('.ask-panel') && !document.querySelector('.ask-panel').textContent.includes('Thinking')`); if (done) break; }
    await sleep(600);
  }
  await evalJs('window.scrollTo(0,0)'); await sleep(300);
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/${j.name}.png`, Buffer.from(shot.result.data, 'base64'));
  console.log('captured', j.name);
}
chrome.kill();
try { rmSync(profile, { recursive: true, force: true }); } catch {}
process.exit(0);
