// Guided walkthrough for the static portfolio demo: 7 short stops through Hana's first week.
// Shown only in the GitHub Pages build (VITE_STATIC_DEMO=1). State lives in sessionStorage.
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui';
import './demo-tour.css';

const STEPS = [
  { path: '/today', title: 'You’re Hana, starting at Brightside', body: 'Today shows only what’s next, so a new hire never faces a wall of tasks. Start with the W-4: tick a step and watch it save.' },
  { path: '/journey', title: 'Your first 90 days', body: 'Five stages from “Hello!” to graduation. Each opens with a short video from the team, and later stages unlock as you go.' },
  { path: '/paperwork', title: 'Paperwork in minutes', body: 'W-4, direct deposit and the handbook, with plain-English help and a typed-name signature. Private to Hana and HR.' },
  { path: '/training', title: 'Training on video', body: 'Short lessons, each with a quick check at the end. Wrong answers explain why.' },
  { path: '/tools', title: 'Gear and logins', body: 'The laptop’s shipping status, who’s handling it, and which accounts are ready on Day 1.' },
  { path: '/people', title: 'The people in your corner', body: 'Hana’s manager, her buddy Sam and People Ops, each one message away.' },
  { path: '/today', title: 'Stuck? Ask Buddy', body: 'The bar at the bottom answers questions from the company’s own handbook. Try “What’s a W-4?”. That’s the tour: keep exploring.' },
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

export default function DemoTour() {
  const [s, setS] = useState<TourState>(load);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  useEffect(() => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(s));
    } catch {
      /* storage blocked: the tour still works for this page view */
    }
  }, [s]);

  // The closed-state button lives inside the top bar (Shell's #topbar-slot), so it never sits over content.
  useEffect(() => {
    const find = () => setSlot(document.getElementById('topbar-slot'));
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

  // Sit just below whichever top bar is showing (desktop page top bar or the phone header).
  useEffect(() => {
    const place = () => {
      const bars = [...document.querySelectorAll<HTMLElement>('.mobile-bar, .topbar')];
      const bottom = bars.map((b) => b.getBoundingClientRect()).filter((r) => r.height > 0 && r.top < 140).reduce((m, r) => Math.max(m, r.bottom), 0);
      document.documentElement.style.setProperty('--tour-top', `${Math.round((bottom || 64) + 12)}px`);
    };
    place();
    const t = setTimeout(place, 400);
    window.addEventListener('resize', place);
    return () => { clearTimeout(t); window.removeEventListener('resize', place); };
  }, [pathname]);

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
  const st = STEPS[s.step];
  const last = s.step === STEPS.length - 1;
  return (
    <aside className="tour-card" role="dialog" aria-label="Demo walkthrough">
      <div className="tour-top">
        <span className="t-caps">Demo walkthrough · {s.step + 1} of {STEPS.length}</span>
        <button className="tour-x" aria-label="Close the walkthrough" onClick={() => setS({ ...s, open: false })}>×</button>
      </div>
      <h2 className="tour-title">{st.title}</h2>
      <p className="tour-body">{st.body}</p>
      <div className="tour-dots" aria-hidden>{STEPS.map((_, i) => <span key={i} className={i === s.step ? 'on' : ''} />)}</div>
      <div className="tour-actions">
        {s.step > 0 && <Button variant="outline" size="sm" onClick={() => go(s.step - 1)}>Back</Button>}
        {last ? (
          <Button size="sm" onClick={() => setS({ step: 0, open: false })}>Explore on my own</Button>
        ) : (
          <Button size="sm" arrow onClick={() => go(s.step + 1)}>Next</Button>
        )}
      </div>
    </aside>
  );
}
