// The invite link a new hire gets by email: shows who it's for, they pick a password, and they're in.
import { useEffect, useState, type FormEvent } from 'react';
import { asset } from '../lib/asset';
import { Link, useParams } from 'react-router-dom';
import { api, ApiError } from '../api';
import { Alert, Button, Smiley, TextField } from '../components/ui';

interface InviteInfo { first: string; name: string; email: string; org: string }

export default function Invite() {
  const { token = '' } = useParams();
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [bad, setBad] = useState<string | null>(null);
  const [pw, setPw] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get<InviteInfo>(`/api/invite/${encodeURIComponent(token)}`).then(setInfo).catch((e) => setBad((e as ApiError).message)); }, [token]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await api.post(`/api/invite/${encodeURIComponent(token)}`, { password: pw });
      window.location.assign('/welcome');
    } catch (err) {
      setError((err as ApiError).message);
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <div className="form-side">
        <div className="row gap-10"><Smiley size={36} /><b style={{ fontSize: 17 }}>Onboarding Buddy</b></div>
        {bad ? (
          <>
            <h1 className="t-hero">This link has <em>run out.</em></h1>
            <Alert tone="error" title="We couldn’t open your invite">{bad}</Alert>
            <p className="t-body muted">Already set a password? <Link to="/login">Sign in here.</Link></p>
          </>
        ) : !info ? (
          <div className="loading">Opening your invite…</div>
        ) : (
          <>
            <h1 className="t-hero">Welcome to {info.org}, <em>{info.first}.</em></h1>
            <p className="t-body-l muted">Pick a password to set up your account. You’ll sign in with <b>{info.email}</b>.</p>
            <form className="col gap-16" onSubmit={submit} noValidate>
              {error && <Alert tone="error" title={error} />}
              <input type="email" name="username" autoComplete="username" value={info.email} readOnly hidden />
              <TextField id="invite-pw" label="Choose a password" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} help="At least 10 characters. A short sentence works well." />
              <div><Button arrow loading={busy} type="submit">Set up my account</Button></div>
            </form>
          </>
        )}
      </div>
      <div className="art-side" aria-hidden>
        <img src={asset('/photos/video-welcome.jpg')} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(16,14,13,0) 30%, rgba(16,14,13,.62) 62%, rgba(16,14,13,.9) 100%)' }} />
        <div style={{ position: 'relative', color: '#fff', maxWidth: 440 }}>
          <p className="t-m" style={{ color: '#fff' }}>“We’re so glad you said yes. Here’s what the next few weeks look like.”</p>
        </div>
      </div>
    </div>
  );
}
