// Nov 7, Tommy: "have all my demo restart after a refresh." Imported first in main.tsx, static portfolio build only.
// The data is already fresh on every load (it lives in memory); this puts the walkthrough and the page back to the start too.
const nav = performance.getEntriesByType?.('navigation')[0] as PerformanceNavigationTiming | undefined;
// Inside another page's frame (the portfolio's viewer) a refresh of that page reports "navigate", so every load there counts.
if (import.meta.env.VITE_STATIC_DEMO === '1' && (nav?.type === 'reload' || window.self !== window.top)) {
  try {
    sessionStorage.removeItem('ob_demo_tour');
    sessionStorage.removeItem('ob-welcomed');
  } catch { /* storage blocked: nothing was kept */ }
  history.replaceState(null, '', import.meta.env.BASE_URL + 'today');
}
