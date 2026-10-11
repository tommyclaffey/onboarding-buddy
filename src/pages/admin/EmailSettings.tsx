// Settings → Email: connect the company's own email (Google, Microsoft or any SMTP server) so invites
// come from the company's address. One hero (the connection), then the options, details and a send log.
import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../../api';
import { Page } from '../../components/Shell';
import { Alert, Button, Caps, EmojiTile, Hairline, LogoTile, Pill, TextField, useToast } from '../../components/ui';
import { relTime, shortDate } from '../../lib/format';
import { useApi } from '../../lib/useApi';

type Provider = 'google' | 'microsoft' | 'smtp';
interface EmailData {
  connection: null | {
    provider: Provider; fromName: string | null; fromAddress: string; replyTo: string | null;
    smtp: { host: string; port: number; secure: boolean; user: string; hasPassword: boolean } | null;
    connectedBy: string | null; connectedAt: string; lastTest: { at: string; ok: boolean; error: string | null } | null;
  };
  available: { google: boolean; microsoft: boolean; app: boolean };
  recent: { to: string; subject: string; kind: string; provider: string | null; status: 'sent' | 'failed' | 'not_sent'; error: string | null; at: string }[];
}

const NAMES: Record<Provider, string> = { google: 'Google Workspace', microsoft: 'Microsoft 365', smtp: 'Other email (SMTP)' };
const VIA: Record<string, string> = { google: 'Google', microsoft: 'Microsoft', smtp: 'SMTP', app: 'Onboarding Buddy' };
const KIND: Record<string, string> = { invite: 'Invite', test: 'Test', other: 'Email' };

function ProviderTile({ p, size = 44 }: { p: Provider; size?: number }) {
  return p === 'smtp' ? <EmojiTile emoji="✉️" tint="sky" size={size} /> : <LogoTile app={{ key: p, name: NAMES[p] }} size={size} />;
}

const BLANK = { host: '', port: '587', user: '', password: '', fromAddress: '', fromName: '' };

export default function EmailSettings() {
  const { data, setData } = useApi<EmailData>('/api/admin/email');
  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [smtpOpen, setSmtpOpen] = useState(false);
  const [f, setF] = useState(BLANK);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [details, setDetails] = useState<{ fromName: string; replyTo: string } | null>(null);
  const [confirmOff, setConfirmOff] = useState(false);
  if (!data) return <main className="panel"><div className="loading">Loading email settings…</div></main>;

  const c = data.connection;
  const connectedParam = params.get('connected') as Provider | null;
  const errorParam = params.get('error');
  const clearParams = () => setParams({}, { replace: true });

  const connect = async (p: 'google' | 'microsoft') => {
    setBusy(p); setErr(null);
    try {
      const r = await api.post<{ url: string }>(`/api/admin/email/connect/${p}`);
      window.location.href = r.url;
    } catch (e) { setErr((e as ApiError).message); setBusy(null); }
  };
  const openSmtp = () => {
    setSmtpOpen(true); setErrors({}); setErr(null);
    setF(c?.smtp ? { host: c.smtp.host, port: String(c.smtp.port), user: c.smtp.user, password: '', fromAddress: c.fromAddress, fromName: c.fromName || '' } : BLANK);
  };
  const set = (k: keyof typeof BLANK) => (e: { target: { value: string } }) => { setF({ ...f, [k]: e.target.value }); setErrors({ ...errors, [k]: '' }); };
  const saveSmtp = async (e: FormEvent) => {
    e.preventDefault();
    setBusy('smtp'); setErr(null);
    try {
      setData(await api.post<EmailData>('/api/admin/email/smtp', { ...f, port: Number(f.port) }));
      setSmtpOpen(false); clearParams();
      toast('Connected. Send a test email to check it.');
    } catch (e2) {
      const ae = e2 as ApiError;
      const errs = (ae.data?.errors as Record<string, string>) || (ae.data?.field ? { [ae.data.field as string]: ae.message } : {});
      setErrors(errs);
      if (!Object.keys(errs).length) setErr(ae.message);
    } finally { setBusy(null); }
  };
  const test = async () => {
    setBusy('test'); setErr(null);
    try {
      const r = await api.post<{ ok: boolean; to: string; error?: string; settings: EmailData }>('/api/admin/email/test');
      setData(r.settings);
      if (r.ok) toast(`Test email sent to ${r.to}. Check your inbox.`);
      else setErr(r.error || 'The test email didn’t send.');
    } catch (e) { setErr((e as ApiError).message); } finally { setBusy(null); }
  };
  const disconnect = async () => {
    setBusy('off');
    try { setData(await api.del<EmailData>('/api/admin/email')); setConfirmOff(false); clearParams(); toast('Email disconnected.'); }
    catch (e) { setErr((e as ApiError).message); } finally { setBusy(null); }
  };
  const saveDetails = async (e: FormEvent) => {
    e.preventDefault();
    if (!details) return;
    setBusy('details'); setErrors({});
    try { setData(await api.patch<EmailData>('/api/admin/email', details)); setDetails(null); toast('Saved.'); }
    catch (e2) { const ae = e2 as ApiError; setErrors({ [String(ae.data?.field || 'replyTo')]: ae.message }); } finally { setBusy(null); }
  };

  const fallback = data.available.app
    ? 'Until you connect one, invites come from Onboarding Buddy, and replies go to the person who sent them.'
    : 'Until you connect one, nothing is emailed. When you invite someone, you’ll get a link to send them yourself.';

  const aside = (
    <>
      <div className="section">
        <Caps>What gets emailed</Caps>
        <div className="col">
          {[['✉️', 'sky', 'New-hire invites', 'A link to set a password. It works for 14 days.'], ['🧪', 'butter', 'Test emails', 'Only to you, when you press the button.']].map(([e, t, h, b]) => (
            <div key={h} className="ad-row"><EmojiTile emoji={e} tint={t} size={32} /><div className="col"><span className="t-h-m">{h}</span><span className="t-label muted">{b}</span></div></div>
          ))}
        </div>
      </div>
      <Hairline />
      <div className="section">
        <Caps>Privacy</Caps>
        <p className="t-body">Onboarding Buddy can only <b>send</b> email. It can’t read your inbox.</p>
        <p className="t-label muted">🔒 Passwords and sign-in tokens are stored encrypted, and they’re never shown again after you save them.</p>
      </div>
    </>
  );

  const options: { p: Provider; line: string }[] = [
    { p: 'google', line: 'Gmail for your company domain. Sign in once.' },
    { p: 'microsoft', line: 'Outlook and Exchange Online. Sign in once.' },
    { p: 'smtp', line: 'Any other provider, with a server name and password.' },
  ];

  return (
    <Page admin crumbs={[{ label: 'Admin', to: '/admin' }, { label: 'Settings' }, { label: 'Email' }]} kicker="Admin · Settings · Email"
      title={<>Invites from <em>your own address.</em></>}
      lede="Connect your company email once. Invites go out from it, and replies land in your inbox." aside={aside}>
      {connectedParam && NAMES[connectedParam] && <Alert tone="success" title={`${NAMES[connectedParam]} is connected.`}>Send a test email to make sure it works.</Alert>}
      {errorParam && <Alert tone="error" title="That didn’t connect">{errorParam}</Alert>}
      {err && <Alert tone="error" title="Something needs a look">{err}</Alert>}

      <div className={`hero-card ${c ? '' : 'sky'}`}>
        <Caps className={c ? 'gold' : ''}>{c ? 'Connected' : 'Not connected yet'}</Caps>
        {c ? (
          <>
            <div className="row gap-12 mt-8">
              <ProviderTile p={c.provider} size={48} />
              <div className="col grow" style={{ minWidth: 0 }}>
                <h2 className="t-l" style={{ overflowWrap: 'anywhere' }}>{c.fromAddress}</h2>
                <p className="t-label muted">{NAMES[c.provider]}{c.connectedBy ? ` · connected by ${c.connectedBy}` : ''} · {shortDate(c.connectedAt)}</p>
              </div>
            </div>
            <p className="t-body mt-8">Invites show as from <b>{c.fromName || 'your company name'}</b>{c.replyTo ? <>, and replies go to <b>{c.replyTo}</b></> : null}.</p>
            {c.lastTest && (c.lastTest.ok
              ? <p className="t-label success strong mt-8">✓ Last test worked · {relTime(c.lastTest.at)}</p>
              : <p className="t-label danger strong mt-8">Last test failed · {c.lastTest.error}</p>)}
            <div className="row gap-12 mt-16" style={{ flexWrap: 'wrap' }}>
              <Button arrow loading={busy === 'test'} onClick={test}>Send a test email</Button>
              {!confirmOff
                ? <button className="link-btn" onClick={() => setConfirmOff(true)}>Disconnect</button>
                : <span className="row gap-10"><span className="t-label">Stop sending from this address?</span><Button size="sm" variant="outline" loading={busy === 'off'} onClick={disconnect}>Yes, disconnect</Button><button className="link-btn" onClick={() => setConfirmOff(false)}>Keep it</button></span>}
            </div>
          </>
        ) : (
          <>
            <h2 className="t-l mt-8">Pick your company’s email below.</h2>
            <p className="t-body muted mt-8">{fallback}</p>
          </>
        )}
      </div>

      <section className="section">
        <Caps>{c ? 'Switch to a different email' : 'Connect an email'}</Caps>
        <div className="ad-rows" style={{ borderTop: '1px solid var(--border-default)' }}>
          {options.map(({ p, line }) => {
            const current = c?.provider === p;
            const off = p !== 'smtp' && !data.available[p];
            return (
              <div key={p}>
                <div className="ad-row">
                  <ProviderTile p={p} />
                  <div className="grow col" style={{ minWidth: 0 }}>
                    <span className="t-h-m17">{NAMES[p]}</span>
                    <span className="t-label muted">{off ? 'Not switched on for this Onboarding Buddy yet. Use “Other email” for now.' : line}</span>
                  </div>
                  {current && p !== 'smtp' ? <Pill tone="success">✓ Connected</Pill>
                    : p === 'smtp' ? <Button variant="outline" onClick={() => (smtpOpen ? setSmtpOpen(false) : openSmtp())}>{smtpOpen ? 'Cancel' : current ? 'Edit' : 'Set up'}</Button>
                    : <Button variant="outline" disabled={off || (!!busy && busy !== p)} loading={busy === p} onClick={() => connect(p)}>{c ? 'Switch' : 'Connect'}</Button>}
                </div>
                {p === 'smtp' && smtpOpen && (
                  <form className="ad-editor" onSubmit={saveSmtp} noValidate>
                    <p className="t-label muted">Your email provider’s help pages list these. Using Microsoft 365? Use the Microsoft option instead: Microsoft is turning off password sign-in for SMTP at the end of December 2026.</p>
                    <div className="grid">
                      <TextField id="smtp-host" label="Server" value={f.host} onChange={set('host')} error={errors.host} placeholder="smtp.yourcompany.com" autoComplete="off" />
                      <TextField id="smtp-port" label="Port" inputMode="numeric" value={f.port} onChange={set('port')} error={errors.port} help="587 for most providers, 465 for SSL" />
                      <TextField id="smtp-user" label="Username" value={f.user} onChange={set('user')} error={errors.user} placeholder="people@yourcompany.com" autoComplete="off" />
                      <TextField id="smtp-pass" label="Password" type="password" value={f.password} onChange={set('password')} error={errors.password}
                        help={c?.smtp?.hasPassword ? 'Leave blank to keep the saved one' : 'If the account uses 2-step sign-in, use an app password'} autoComplete="new-password" />
                      <TextField id="smtp-from" label="Send from" type="email" value={f.fromAddress} onChange={set('fromAddress')} error={errors.fromAddress} help="Leave blank to use the username" placeholder="people@yourcompany.com" />
                      <TextField id="smtp-name" label="Sender name" value={f.fromName} onChange={set('fromName')} help="What people see, like “Brightside People Ops”" />
                    </div>
                    <div className="row gap-12"><Button arrow loading={busy === 'smtp'} type="submit">Check and save</Button><span className="t-label muted">We sign in to check it before saving.</span></div>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {c && (
        <section className="section">
          <div className="section-head"><Caps>How emails look</Caps>{!details && <button className="link-btn" onClick={() => setDetails({ fromName: c.fromName || '', replyTo: c.replyTo || '' })}>Edit</button>}</div>
          {details ? (
            <form className="ad-editor" onSubmit={saveDetails} noValidate>
              <div className="grid">
                <TextField id="em-name" label="Sender name" value={details.fromName} onChange={(e) => setDetails({ ...details, fromName: e.target.value })} help="Leave blank to use your company name" />
                <TextField id="em-reply" label="Replies go to" type="email" value={details.replyTo} onChange={(e) => { setDetails({ ...details, replyTo: e.target.value }); setErrors({}); }} error={errors.replyTo} help="Leave blank to send replies to whoever sent the invite" />
              </div>
              <div className="row gap-12"><Button loading={busy === 'details'} type="submit">Save</Button><button type="button" className="link-btn" onClick={() => setDetails(null)}>Cancel</button></div>
            </form>
          ) : (
            <dl className="ad-kv">
              <dt>From</dt><dd>{c.fromName ? `${c.fromName} <${c.fromAddress}>` : c.fromAddress}</dd>
              <dt>Replies go to</dt><dd>{c.replyTo || 'Whoever sent the invite'}</dd>
            </dl>
          )}
        </section>
      )}

      <section className="section">
        <Caps>Recent emails</Caps>
        {data.recent.length ? (
          <div className="ad-rows" style={{ borderTop: '1px solid var(--border-default)' }}>
            {data.recent.map((m, i) => (
              <div key={i} className="ad-row" style={{ alignItems: 'flex-start' }}>
                <div className="grow col" style={{ minWidth: 0 }}>
                  <span className="t-h-m" style={{ overflowWrap: 'anywhere' }}>{KIND[m.kind] || 'Email'} · {m.to}</span>
                  <span className="t-label muted">{m.status === 'sent' ? `Sent via ${VIA[m.provider || ''] || 'email'}` : m.error} · {relTime(m.at)}</span>
                </div>
                <Pill tone={m.status === 'sent' ? 'success' : m.status === 'failed' ? 'danger' : 'warning'}>{m.status === 'sent' ? '✓ Sent' : m.status === 'failed' ? 'Failed' : 'Not sent'}</Pill>
              </div>
            ))}
          </div>
        ) : <p className="t-body muted">Nothing sent yet. Invites you send will show up here.</p>}
      </section>
    </Page>
  );
}
