// Your account: profile summary and change password (invited hires start with a temporary one).
import { useState } from 'react';
import { api, ApiError } from '../api';
import { useAuth } from '../auth';
import { Page } from '../components/Shell';
import { Alert, Avatar, Button, Caps, TextField, useToast } from '../components/ui';
import { shortDate } from '../lib/format';

export default function Account() {
  const { user } = useAuth();
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [err, setErr] = useState<{ msg: string; field?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  if (!user) return null;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      await api.post('/api/auth/password', { current, next });
      setCurrent(''); setNext('');
      toast('Password changed. You’re signed out everywhere else.');
    } catch (x) {
      const a = x as ApiError;
      setErr({ msg: a.message, field: a.data?.field as string | undefined });
    } finally {
      setBusy(false);
    }
  };
  const aside = (
    <div className="section">
      <Caps>Signed in as</Caps>
      <div className="row gap-10"><Avatar person={user} size={40} /><div><p className="t-h-m">{user.name}</p><p className="t-label muted">{user.email}</p></div></div>
      {user.startDate && <p className="t-label muted">Starts {shortDate(user.startDate)}</p>}
    </div>
  );
  return (
    <Page crumbs={[{ label: 'Account' }]} kicker="Your account" title={<>Keep it <em>yours.</em></>} lede="If People Ops gave you a temporary password, change it here." aside={aside}>
      <form className="col gap-16" style={{ maxWidth: 440 }} onSubmit={submit} noValidate>
        <TextField label="Current password" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} error={err?.field === 'current' ? err.msg : null} />
        <TextField label="New password" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} help="At least 10 characters. A short sentence works well." error={err?.field === 'next' ? err.msg : null} />
        {err && !err.field && <Alert tone="error" title={err.msg} />}
        <div><Button type="submit" loading={busy}>Change password</Button></div>
      </form>
    </Page>
  );
}
