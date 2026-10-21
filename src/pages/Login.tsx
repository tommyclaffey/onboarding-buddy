import { useEffect, useState } from 'react';
import { api, EMBEDDED } from '../api';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { homeFor, useAuth } from '../auth';
import { Alert, Avatar, Button, Smiley, TextField } from '../components/ui';

// One demo account: Hana, a new hire, using it the way she would on the job.
// Inside the portfolio's embedded preview (and at /demo) she's signed in automatically.
const DEMO = [
  { email: 'hana@brightside.test', name: 'Hana Liu', role: 'New hire at Brightside', photo: '/photos/hana.jpg' },
];
const AUTO_KEY = 'ob_demo_auto';

export default function Login() {
  const { user, ready, login } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [demo, setDemo] = useState<boolean | null>(null);
  const submit = async (e?: React.FormEvent, as?: string) => {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const u = await login(as || email, as ? 'buddy-demo-2026' : password);
      navigate(homeFor(u));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => { api.get<{ demo: boolean }>('/api/config').then((c) => setDemo(c.demo)).catch(() => setDemo(false)); }, []);
  // Auto sign-in: always at /demo; once per tab when embedded (so signing out isn't undone).
  const [wantAuto] = useState(() => pathname === '/demo' || (EMBEDDED && (() => { try { return !sessionStorage.getItem(AUTO_KEY); } catch { return true; } })()));
  const [autoTried, setAutoTried] = useState(false);
  useEffect(() => {
    if (!demo || !ready || user || autoTried || !wantAuto) return;
    setAutoTried(true);
    try { sessionStorage.setItem(AUTO_KEY, '1'); } catch { /* storage blocked */ }
    submit(undefined, DEMO[0].email);
  }, [demo, ready, user, autoTried, wantAuto]); // eslint-disable-line react-hooks/exhaustive-deps
  if (ready && user) return <Navigate to={homeFor(user)} replace />;
  if (wantAuto && !error && (!ready || demo === null || (demo && (busy || !autoTried)))) return <div className="loading">Signing you in as Hana…</div>;
  return (
    <div className="auth">
      <div className="form-side">
        <div className="row gap-10"><Smiley size={36} /><b style={{ fontSize: 17 }}>Onboarding Buddy</b></div>
        <h1 className="t-hero">Welcome <em>aboard.</em></h1>
        <p className="t-body-l muted">Everything you need for your first 90 days, one step at a time.</p>
        <form className="col gap-16" onSubmit={submit} noValidate>
          {error && <Alert tone="error" title={error} />}
          <TextField label="Work email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <TextField label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <div><Button arrow loading={busy} type="submit">Sign in</Button></div>
        </form>
        {demo && <div className="col gap-8 mt-16">
          <p className="t-caps">Demo · try it as a new hire</p>
          <div className="col gap-4">
            {DEMO.map((d) => (
              <button key={d.email} className="task" style={{ width: '100%', margin: 0 }} onClick={() => submit(undefined, d.email)}>
                <Avatar person={d} size={32} />
                <span className="t-text"><span className="t-h-m">{d.name}</span><span className="t-label muted" style={{ display: 'block' }}>{d.role}</span></span>
              </button>
            ))}
          </div>
        </div>}
      </div>
      <div className="art-side" aria-hidden>
        <img src="/photos/video-welcome.jpg" alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(16,14,13,0) 30%, rgba(16,14,13,.62) 62%, rgba(16,14,13,.9) 100%)' }} />
        <div style={{ position: 'relative', color: '#fff', maxWidth: 440 }}>
          <p className="t-m" style={{ color: '#fff' }}>“We’re so glad you said yes. Here’s what the next few weeks look like.”</p>
          <p className="t-label mt-8" style={{ color: '#fff' }}>Lena Ortiz, co-founder</p>
        </div>
      </div>
    </div>
  );
}
