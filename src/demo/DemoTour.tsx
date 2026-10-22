// Guided walkthrough for the static portfolio demo: 7 short stops through Hana's first week.
// Shown only in the GitHub Pages build (VITE_STATIC_DEMO=1). State lives in sessionStorage.
//
// Placement (Tommy, Oct 22): a card in the TOP-RIGHT corner of the page that sizes itself so it never
// reaches the card below it. It measures the free space between the top bar and the first content
// below its column, then picks the roomiest layout that fits (full → compact → 2-line → title only),
// re-measuring on every step, page, resize and data load. Closed, it's a small button in the top bar.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui';
import './demo-tour.css';

const STEPS = [
  { path: '/today', title: 'You’re Hana, starting at Brightside', body: 'Today shows only what’s next, so a new hire never faces a wall of tasks. Start with the W‑4: tick a step and watch it save.' },
  { path: '/journey', title: 'Your first 90 days', body: 'Five stages from “Hello!” to graduation. Each opens with a short video from the team, and later stages unlock as you go.' },
  { path: '/paperwork', title: 'Paperwork in minutes', body: 'W‑4, direct deposit and the handbook, with plain-English help and a typed-name signature. Private to Hana and HR.' },
  { path: '/training', title: 'Training on video', body: 'Short lessons, each with a quick check at the end. Wrong answers explain why.' },
  { path: '/tools', title: 'Gear and logins', body: 'The laptop’s shipping status, who’s handling it, and which accounts are ready on Day 1.' },
  { path: '/people', title: 'The people in your corner', body: 'Hana’s manager, her buddy Sam and People Ops, each one message away.' },
  { path: '/today', title: 'Stuck? Ask Buddy', body: 'The bar at the bottom answers questions from the company’s own handbook. Try “What’s a W‑4?”. That’s the tour: keep exploring.' },
];
const KEY = 'ob_demo_tour';

type TourState = { step: number; open: boolean };
const load = (): TourState => {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) || '') as TourState;
  } catch {
    return { step: 0, open: true };
  }
};

const MODES = ['full', 'compact', 'tight', 'min'] as const;
type Mode = (typeof MODES)[number];
const GAP = 20; // clear space kept above the card below
type Box = { top: number; right: number; width: number; maxH: number };

/** Free space in the panel's top-right corner: from under the top bar down to the first content below. */
function measure(panel: HTMLElement, width: number): Box | null {
  const P = panel.getBoundingClientRect();
  const bar = panel.querySelector<HTMLElement>('.topbar');
  const head = panel.querySelector<HTMLElement>('.page-head');
  if (!bar || !head) return null;
  // Line the card's right edge up with the content below it (the page body's padding), not the header's.
  const body = panel.querySelector<HTMLElement>('.page-body') || head;
  const padR = parseFloat(getComputedStyle(body).paddingRight) || 24;
  const padL = parseFloat(getComputedStyle(body).paddingLeft) || 24;
  const top = bar.getBoundingClientRect().bottom - P.top + 4;
  const inner = P.width - padL - padR;
  const w = Math.min(width, inner);
  const left = P.width - padR - w;
  // First content below, in the card's column: anything visible that isn't the bar, the page header,
  // the walkthrough itself, the background glows or the floating Ask Buddy bar.
  let limit = Infinity;
  for (const el of panel.querySelectorAll<HTMLElement>('*')) {
    if (el.closest('.topbar, .page-head, .tour-card, .ask-bar, .ask-panel, .toast-wrap') || el.classList.contains('glow')) continue;
    if (el.children.length > 0 && !el.matches('section, article, .card, [class*="card"], button, a, img, video')) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    const x0 = r.left - P.left, x1 = r.right - P.left, y0 = r.top - P.top;
    if (x1 <= left || x0 >= left + w) continue;
    if (y0 < top) continue;
    limit = Math.min(limit, y0);
  }
  const maxH = (limit === Infinity ? P.height : limit) - GAP - top;
  return { top, right: padR, width: w, maxH };
}

export default function DemoTour() {
  const [s, setS] = useState<TourState>(load);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [panel, setPanel] = useState<HTMLElement | null>(null);
  const [mode, setMode] = useState<Mode>('full');
  const [box, setBox] = useState<Box | null>(null);
  const cardRef = useRef<HTMLElement | null>(null);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(s));
    } catch {
      /* storage blocked: the tour still works for this page view */
    }
  }, [s]);

  useEffect(() => {
    const find = () => {
      setSlot(document.getElementById('topbar-slot'));
      setPanel(document.querySelector<HTMLElement>('main.panel'));
    };
    find();
    const t = setTimeout(find, 300);
    return () => clearTimeout(t);
  }, [pathname]);

  // The DEMO pill beside the company name restarts the walkthrough.
  useEffect(() => {
    const restart = () => {
      setS({ step: 0, open: true });
      navigate(STEPS[0].path);
    };
    window.addEventListener('ob:tour', restart);
    return () => window.removeEventListener('ob:tour', restart);
  }, [navigate]);

  // Re-measure the free corner whenever the page changes size or content (data loads after render).
  const remeasure = useCallback(() => {
    if (!panel) return;
    const want = window.innerWidth < 700 ? 9999 : 380;
    const b = measure(panel, want);
    setBox((old) => (old && b && old.top === b.top && old.right === b.right && old.width === b.width && Math.abs(old.maxH - b.maxH) < 1 ? old : b));
    setMode('full');
  }, [panel]);
  useEffect(() => {
    if (!panel || !s.open) return;
    remeasure();
    let raf = 0;
    const later = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(remeasure); };
    const ro = new ResizeObserver(later);
    ro.observe(panel);
    const mo = new MutationObserver((recs) => { if (recs.some((r) => !(r.target as Element).closest?.('.tour-card'))) later(); });
    mo.observe(panel, { childList: true, subtree: true });
    window.addEventListener('resize', later);
    const t = setTimeout(later, 600);
    return () => { ro.disconnect(); mo.disconnect(); window.removeEventListener('resize', later); clearTimeout(t); cancelAnimationFrame(raf); };
  }, [panel, s.open, s.step, pathname, remeasure]);

  // Pick the roomiest layout that fits above the card below.
  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el || !box) return;
    if (el.offsetHeight > box.maxH) {
      const i = MODES.indexOf(mode);
      if (i < MODES.length - 1) setMode(MODES[i + 1]);
    }
  }, [mode, box, s.step]);

  const go = (step: number) => {
    setS({ step, open: true });
    if (pathname !== STEPS[step].path) navigate(STEPS[step].path);
  };

  if (!s.open) {
    const pill = (
      <button className="tour-pill" onClick={() => go(0)}>
        Demo walkthrough
      </button>
    );
    return slot ? createPortal(pill, slot) : null;
  }
  if (!panel || !box) return null;
  const st = STEPS[s.step];
  const last = s.step === STEPS.length - 1;
  const card = (
    <aside
      ref={cardRef}
      className={`tour-card tour-${mode}`}
      role="dialog"
      aria-label="Demo walkthrough"
      style={{ top: box.top, right: box.right, width: box.width, visibility: box.maxH < 40 ? 'hidden' : undefined }}
    >
      <div className="tour-top">
        <span className="t-caps">Demo walkthrough · {s.step + 1} of {STEPS.length}</span>
        <button className="tour-x" aria-label="Close the walkthrough" onClick={() => setS({ ...s, open: false })}>×</button>
      </div>
      <h2 className="tour-title">{st.title}</h2>
      {mode !== 'min' && <p className="tour-body">{st.body}</p>}
      <div className="tour-foot">
        <div className="tour-dots" aria-hidden>{STEPS.map((_, i) => <span key={i} className={i === s.step ? 'on' : ''} />)}</div>
        <div className="tour-actions">
          {s.step > 0 && <Button variant="outline" size="sm" onClick={() => go(s.step - 1)}>Back</Button>}
          {last ? (
            <Button size="sm" onClick={() => setS({ step: 0, open: false })}>Explore on my own</Button>
          ) : (
            <Button size="sm" arrow onClick={() => go(s.step + 1)}>Next</Button>
          )}
        </div>
      </div>
    </aside>
  );
  return createPortal(card, panel);
}
