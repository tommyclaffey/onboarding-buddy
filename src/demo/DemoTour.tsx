// Guided walkthrough for the static portfolio demo: 7 short stops through Hana's first week.
// Shown only in the GitHub Pages build (VITE_STATIC_DEMO=1). State lives in sessionStorage.
//
// One card, built once (portal to <body>), that stays put while it walks you through the pages:
// Next/Back only swap its words (a soft fade) and change the page. It sits in the TOP-RIGHT corner of
// the page and sizes itself so it never reaches the card below (Tommy, Oct 22). The size is worked out
// off screen first, so it never visibly jumps; position changes glide. Closed: a button in the top bar.
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
type Place = { top: number; left: number; width: number; maxH: number };

/** The free top-right corner of the current page, in document coordinates. */
function corner(): Place | null {
  const panel = document.querySelector<HTMLElement>('main.panel');
  const bar = panel?.querySelector<HTMLElement>('.topbar');
  if (!panel || !bar) return null;
  const P = panel.getBoundingClientRect();
  const body = panel.querySelector<HTMLElement>('.page-body') || panel.querySelector<HTMLElement>('.page-head') || panel;
  const cs = getComputedStyle(body);
  const padR = parseFloat(cs.paddingRight) || 20;
  const padL = parseFloat(cs.paddingLeft) || 20;
  const phone = window.innerWidth < 700;
  const width = Math.min(phone ? 9999 : 380, P.width - padL - padR);
  const left = P.right - padR - width;
  const top = bar.getBoundingClientRect().bottom + 4;
  // First content below, in the card's column (not the bar, the page header, the glows or Ask Buddy).
  let limit = P.bottom;
  for (const el of panel.querySelectorAll<HTMLElement>('.page-body *')) {
    if (el.closest('.ask-bar, .ask-panel, .toast-wrap')) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2 || r.top < top) continue;
    if (r.right <= left || r.left >= left + width) continue;
    if (r.top < limit) limit = r.top;
  }
  return { top: top + window.scrollY, left: left + window.scrollX, width, maxH: limit - GAP - top };
}

export default function DemoTour() {
  const [s, setS] = useState<TourState>(load);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [place, setPlace] = useState<Place | null>(null);
  const [mode, setMode] = useState<Mode>('full');
  const measurer = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(s));
    } catch {
      /* storage blocked: the tour still works for this page view */
    }
  }, [s]);

  // The DEMO pill beside the company name restarts the walkthrough.
  useEffect(() => {
    const restart = () => {
      setS({ step: 0, open: true });
      navigate(STEPS[0].path);
    };
    window.addEventListener('ob:tour', restart);
    return () => window.removeEventListener('ob:tour', restart);
  }, [navigate]);

  // Work out where the card goes and which layout fits, off screen, then apply both at once.
  const fit = useCallback(() => {
    const c = corner();
    if (!c) return; // page still loading: keep the card where it is
    const m = measurer.current;
    let chosen: Mode = 'min';
    if (m) {
      m.style.width = `${c.width}px`;
      for (const md of MODES) {
        m.className = `tour-card tour-measure tour-${md}`;
        if (m.offsetHeight <= c.maxH) { chosen = md; break; }
      }
    }
    setMode((o) => (o === chosen ? o : chosen));
    setPlace((o) => (o && Math.abs(o.top - c.top) < 1 && Math.abs(o.left - c.left) < 1 && Math.abs(o.width - c.width) < 1 && Math.abs(o.maxH - c.maxH) < 1 ? o : c));
  }, []);

  // Re-fit on every step, page change, resize and content load. The card itself is never torn down.
  useLayoutEffect(() => {
    if (!s.open) return;
    fit();
    let raf = 0;
    const later = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(fit); };
    const mo = new MutationObserver((recs) => { if (recs.some((r) => !(r.target as Element).closest?.('.tour-card, .tour-measure'))) later(); });
    mo.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', later);
    const timers = [100, 300, 700].map((ms) => setTimeout(later, ms));
    return () => { mo.disconnect(); window.removeEventListener('resize', later); timers.forEach(clearTimeout); cancelAnimationFrame(raf); };
  }, [s.open, s.step, pathname, fit]);

  useEffect(() => {
    const t = setTimeout(() => setSlot(document.getElementById('topbar-slot')), 50);
    return () => clearTimeout(t);
  }, [pathname, s.open]);

  const go = (step: number) => {
    setS({ step, open: true });
    if (pathname !== STEPS[step].path) navigate(STEPS[step].path);
  };

  const st = STEPS[s.step];
  const last = s.step === STEPS.length - 1;
  const inner = (live: boolean) => (
    <>
      <div className="tour-top">
        <span className="t-caps">Demo walkthrough · {s.step + 1} of {STEPS.length}</span>
        {live && <button className="tour-x" aria-label="Close the walkthrough" onClick={() => setS({ ...s, open: false })}>×</button>}
        {!live && <span className="tour-x" />}
      </div>
      <div className="tour-words" key={live ? s.step : undefined}>
        <h2 className="tour-title">{st.title}</h2>
        <p className="tour-body">{st.body}</p>
      </div>
      <div className="tour-foot">
        <div className="tour-dots" aria-hidden>{STEPS.map((_, i) => <span key={i} className={i === s.step ? 'on' : ''} />)}</div>
        <div className="tour-actions">
          {s.step > 0 && <Button variant="outline" size="sm" onClick={() => go(s.step - 1)} tabIndex={live ? 0 : -1}>Back</Button>}
          {last ? (
            <Button size="sm" onClick={() => setS({ step: 0, open: false })} tabIndex={live ? 0 : -1}>Explore on my own</Button>
          ) : (
            <Button size="sm" arrow onClick={() => go(s.step + 1)} tabIndex={live ? 0 : -1}>Next</Button>
          )}
        </div>
      </div>
    </>
  );

  if (!s.open) {
    const pill = (
      <button className="tour-pill" onClick={() => go(0)}>
        Demo walkthrough
      </button>
    );
    return slot ? createPortal(pill, slot) : null;
  }
  return createPortal(
    <>
      {/* Off-screen copy used only to measure which layout fits. */}
      <div ref={measurer} className="tour-card tour-measure" aria-hidden>{inner(false)}</div>
      {place && (
        <aside
          className={`tour-card tour-${mode}`}
          role="dialog"
          aria-label="Demo walkthrough"
          style={{ top: place.top, left: place.left, width: place.width }}
        >
          {inner(true)}
        </aside>
      )}
    </>,
    document.body,
  );
}
