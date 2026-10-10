// Line icons for navigation and system controls (emoji are only for content, per the design rules).
const P = { width: 17, height: 17, viewBox: '0 0 18 18', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };

export const Icon = {
  today: () => <svg {...P}><circle cx="9" cy="9" r="3.2" /><path d="M9 1.8v1.6M9 14.6v1.6M1.8 9h1.6M14.6 9h1.6M3.9 3.9l1.1 1.1M13 13l1.1 1.1M3.9 14.1 5 13M13 5l1.1-1.1" /></svg>,
  journey: () => <svg {...P}><path d="M2.5 4.5 7 3l4 1.5 4.5-1.5v10.5L11 15l-4-1.5-4.5 1.5z" /><path d="M7 3v10.5M11 4.5V15" /></svg>,
  inbox: () => <svg {...P}><rect x="2.2" y="3.5" width="13.6" height="11" rx="2" /><path d="m2.8 5 6.2 4.6L15.2 5" /></svg>,
  paperwork: () => <svg {...P}><path d="M4.5 2.2h6.3l2.7 2.7v10.9H4.5z" /><path d="M10.6 2.2v2.9h2.9M6.8 9h4.4M6.8 11.8h4.4" /></svg>,
  training: () => <svg {...P}><path d="m1.8 6.8 7.2-3.6 7.2 3.6L9 10.4z" /><path d="M4.6 8.3v3.6c1.2 1.3 2.8 1.9 4.4 1.9s3.2-.6 4.4-1.9V8.3M16.2 6.8v4" /></svg>,
  tools: () => <svg {...P}><rect x="2.4" y="3.4" width="13.2" height="8.6" rx="1.4" /><path d="M1.5 14.6h15" /></svg>,
  people: () => <svg {...P}><circle cx="6.8" cy="6.3" r="2.6" /><path d="M2.2 15c.5-2.6 2.3-4 4.6-4s4.1 1.4 4.6 4" /><circle cx="12.6" cy="6.8" r="2" /><path d="M12.6 10.6c1.8 0 3 1.1 3.4 3.4" /></svg>,
  home: () => <svg {...P}><path d="M2.6 8.2 9 2.8l6.4 5.4V15.2H2.6z" /><path d="M7 15.2v-4.2h4v4.2" /></svg>,
  video: () => <svg {...P}><rect x="1.8" y="4" width="10.4" height="10" rx="2" /><path d="m12.2 7.8 4-2.3v7l-4-2.3" /></svg>,
  plug: () => <svg {...P}><path d="M6.2 2v3.4M11.8 2v3.4M4.4 5.4h9.2v2.9a4.6 4.6 0 0 1-9.2 0zM9 12.9V16" /></svg>,
  check: () => <svg {...P}><rect x="2.4" y="2.4" width="13.2" height="13.2" rx="3" /><path d="m5.8 9.2 2.2 2.1 4.3-4.6" /></svg>,
  search: () => <svg {...P}><circle cx="8" cy="8" r="5" /><path d="m11.8 11.8 3.6 3.6" /></svg>,
};
