// DEMO pill beside the company name, like Growth and Queue. Only in the static portfolio demo
// (VITE_STATIC_DEMO=1): tells a visitor Brightside is a sample company, and clicking it restarts
// the walkthrough (DemoTour listens for 'ob:tour').
export function DemoTag() {
  if (import.meta.env.VITE_STATIC_DEMO !== '1') return null;
  return (
    <button
      type="button"
      className="demo-tag"
      title="Sample company and data. Click to restart the walkthrough."
      aria-label="Demo account: restart the walkthrough"
      onClick={(e) => {
        e.stopPropagation();
        window.dispatchEvent(new Event('ob:tour'));
      }}
    >
      Demo
    </button>
  );
}
