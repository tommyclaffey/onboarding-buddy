// Core components, mirroring the Figma component set: Button, Checkbox, Choice, TextField, Avatar,
// Smiley, LogoTile, EmojiTile, Alert, Toast, EmptyState, Pill, Caps, Hairline.
import { createContext, useCallback, useContext, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import { asset } from '../lib/asset';
import type { AppInfo, Person } from '../lib/types';

export const Arrow = ({ size = 15 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden><path d="M3 8h9.5M9 4.5 12.5 8 9 11.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
export const PlayIcon = ({ size = 12, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden><path d="M3 1.8v8.4c0 .4.4.6.7.4l6.6-4.2a.5.5 0 0 0 0-.8L3.7 1.4c-.3-.2-.7 0-.7.4Z" fill={color} /></svg>
);
export const Tick = ({ size = 12, color = '#fff' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden><path d="m2.5 6.3 2.3 2.2 4.7-5" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'ink' | 'outline' | 'yellow'; arrow?: boolean; loading?: boolean; size?: 'sm' | 'md' };
export function Button({ variant = 'ink', arrow, loading, size = 'md', children, className = '', disabled, ...rest }: BtnProps) {
  return (
    <button className={`btn btn-${variant} ${size === 'sm' ? 'btn-sm' : ''} ${className}`} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading && <span className="spin" aria-hidden />}
      {children}
      {arrow && !loading && <Arrow />}
    </button>
  );
}

export function Checkbox({ checked, onChange, label, disabled }: { checked: boolean; onChange?: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} aria-label={label} disabled={disabled} className={`check ${checked ? 'done' : ''}`}
      onClick={(e) => { e.stopPropagation(); onChange?.(!checked); }}>
      <Tick />
    </button>
  );
}

export function Choice({ title, desc, checked, error, onSelect, disabled }: { title: string; desc?: string; checked: boolean; error?: boolean; onSelect: () => void; disabled?: boolean }) {
  return (
    <button type="button" role="radio" aria-checked={checked} className={`choice ${error ? 'error' : ''}`} onClick={onSelect} disabled={disabled}>
      <span className="radio" aria-hidden />
      <span>
        <span className="c-title">{title}</span>
        {desc && <span className="c-desc">{desc}</span>}
      </span>
    </button>
  );
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & { label: string; help?: string; error?: string | null };
export function TextField({ label, help, error, id, ...rest }: FieldProps) {
  const fid = id || 'f-' + label.toLowerCase().replace(/\W+/g, '-');
  return (
    <div className={`field ${error ? 'error' : ''}`}>
      <label htmlFor={fid}>{label}</label>
      <input id={fid} aria-invalid={!!error} aria-describedby={(error || help) ? fid + '-h' : undefined} {...rest} />
      {(error || help) && <span className="help" id={fid + '-h'}>{error || help}</span>}
    </div>
  );
}

export function Avatar({ person, size = 32 }: { person?: Pick<Person, 'name' | 'photo'> | null; size?: number }) {
  if (!person) return <span className="role-tile" style={{ width: size, height: size, fontSize: size * 0.55 }} aria-hidden>🙋</span>;
  return person.photo
    ? <img className="avatar" src={person.photo} alt="" width={size} height={size} style={{ width: size, height: size }} />
    : <span className="avatar" style={{ width: size, height: size, display: 'grid', placeItems: 'center', fontSize: size * 0.4, fontWeight: 600 }} aria-hidden>{person.name.split(' ').map((s) => s[0]).join('').slice(0, 2)}</span>;
}

/** The brand mark: a geometric smiley. Yellow is used at full strength only here. */
export function Smiley({ size = 28 }: { size?: number }) {
  return (
    <span className="smiley" style={{ width: size, height: size }} aria-hidden>
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 20 20"><rect x="5.5" y="4" width="2.4" height="5" rx="1.2" fill="#1A1816" /><rect x="12.1" y="4" width="2.4" height="5" rx="1.2" fill="#1A1816" /><path d="M4.5 11.6c1.3 2.8 3.3 4 5.5 4s4.2-1.2 5.5-4" stroke="#1A1816" strokeWidth="2.2" fill="none" strokeLinecap="round" /></svg>
    </span>
  );
}

/** Official app logo, uniform scale, always on a white tile. Never recolour. */
export function LogoTile({ app, size = 48, radius }: { app: Pick<AppInfo, 'key' | 'name'>; size?: number; radius?: number }) {
  return (
    <span className="logo-tile" style={{ width: size, height: size, borderRadius: radius ?? Math.round(size * 0.28) }}>
      <img src={asset(`/logos/${app.key}.svg`)} alt={`${app.name} logo`} style={{ width: size * 0.58, height: size * 0.58 }} />
    </span>
  );
}
export const Logo = ({ app, size = 16 }: { app: Pick<AppInfo, 'key' | 'name'>; size?: number }) => (
  <img src={asset(`/logos/${app.key}.svg`)} alt={`${app.name} logo`} width={size} height={size} style={{ width: size, height: size, objectFit: 'contain', flex: 'none' }} />
);

export function EmojiTile({ emoji, tint = 'sky', size = 36 }: { emoji: string; tint?: string; size?: number }) {
  return <span className={`emoji-tile tint-${tint}`} style={{ width: size, height: size, fontSize: size * 0.47, borderRadius: size * 0.33 }} aria-hidden>{emoji}</span>;
}

export function Alert({ tone = 'info', title, children }: { tone?: 'info' | 'success' | 'warning' | 'error'; title: string; children?: ReactNode }) {
  const icon = { info: 'i', success: '✓', warning: '!', error: '!' }[tone];
  return (
    <div className={`alert ${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <span className="a-icon" aria-hidden>{icon}</span>
      <div><span className="a-title">{title}</span>{children && <div className="a-msg">{children}</div>}</div>
    </div>
  );
}

export function EmptyState({ emoji, title, children, action }: { emoji: string; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <EmojiTile emoji={emoji} size={56} />
      <h2 className="t-m">{title}</h2>
      {children && <p className="t-body muted">{children}</p>}
      {action && <div className="mt-8">{action}</div>}
    </div>
  );
}

export const Pill = ({ tone, children }: { tone?: 'success' | 'warning' | 'danger' | 'sky' | 'peach'; children: ReactNode }) => <span className={`pill ${tone || ''}`}>{children}</span>;
export const Caps = ({ children, className = '' }: { children: ReactNode; className?: string }) => <p className={`t-caps ${className}`}>{children}</p>;
export const Hairline = () => <hr className="hairline" />;

/* ---------- Toasts ---------- */
interface ToastItem { id: number; message: string; action?: { label: string; run: () => void } }
const ToastCtx = createContext<(m: string, action?: ToastItem['action']) => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const show = useCallback((message: string, action?: ToastItem['action']) => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, message, action }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 5000);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className="toast-wrap" aria-live="polite">
        {items.map((t) => (
          <div className="toast" key={t.id}>
            <span className="t-icon" aria-hidden>✓</span>
            <span>{t.message}</span>
            {t.action && <button onClick={() => { t.action!.run(); setItems((x) => x.filter((y) => y.id !== t.id)); }}>{t.action.label}</button>}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);
