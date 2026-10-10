// Inbox (any role). One hero for what needs you, then earlier messages as open rows split by hairlines.
// Opening a message marks it read and follows its link; messages without a page open in place, with Reply.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { Page } from '../components/Shell';
import { Avatar, Button, Caps, EmptyState, Hairline, Smiley } from '../components/ui';
import { relTime } from '../lib/format';
import type { Person } from '../lib/types';
import { useApi } from '../lib/useApi';
import { MessageBox } from './hire/TaskPage';
import '../styles/hire-flows.css';

interface Message { id: number; kind: string; title: string; body: string; link: string | null; action: boolean; createdAt: string; read: boolean; from: Person | null }
type Filter = 'all' | 'action' | 'people' | 'system' | 'unread';

const FILTERS: [Filter, string, (m: Message) => boolean][] = [
  ['all', 'Everything', () => true],
  ['action', 'Needs you', (m) => m.action],
  ['unread', 'Unread', (m) => !m.read],
  ['people', 'From people', (m) => !!m.from],
  ['system', 'From Onboarding Buddy', (m) => !m.from],
];

const Sender = ({ m, size }: { m: Message; size: number }) => (m.from ? <Avatar person={m.from} size={size} /> : <Smiley size={size} />);

export default function Inbox() {
  const { data, setData } = useApi<{ messages: Message[] }>('/api/inbox');
  const navigate = useNavigate();
  const { user } = useAuth();
  const [filter, setFilter] = useState<Filter>('all');
  const [openId, setOpenId] = useState<number | null>(null);
  const [replyTo, setReplyTo] = useState<number | null>(null);
  if (!data) return <main className="panel"><div className="loading">Loading your inbox…</div></main>;

  const msgs = data.messages;
  const markRead = (ids: number[]) => {
    setData({ messages: msgs.map((m) => (ids.includes(m.id) ? { ...m, read: true } : m)) });
    return Promise.all(ids.map((id) => api.post(`/api/inbox/${id}/read`)));
  };
  const openMsg = async (m: Message) => {
    if (!m.read) await markRead([m.id]);
    if (m.link && m.link !== '/inbox') navigate(m.link);
    else setOpenId(openId === m.id ? null : m.id);
  };

  const test = FILTERS.find((f) => f[0] === filter)![2];
  const needs = msgs.filter((m) => m.action && test(m));
  const earlier = msgs.filter((m) => !m.action && test(m));
  const actionCount = msgs.filter((m) => m.action).length;
  const unread = msgs.filter((m) => !m.read);

  const aside = (
    <>
      <div className="section">
        <Caps>Show</Caps>
        <div className="filter-list">
          {FILTERS.map(([key, label, fn]) => (
            <button key={key} aria-pressed={filter === key} onClick={() => setFilter(key)}>
              <span>{label}</span><span className="t-mono muted">{msgs.filter(fn).length}</span>
            </button>
          ))}
        </div>
      </div>
      <Hairline />
      <div className="section">
        <Caps>How messages work</Caps>
        <p className="t-body">Your people, People Ops and Onboarding Buddy write to you here. Anything that needs you goes to the top and says so.</p>
      </div>
      <Hairline />
      <p className="t-label muted row top gap-8"><span aria-hidden>🗂</span><span>Nothing here is ever deleted. Read messages stay in the list below.</span></p>
    </>
  );

  const body = (m: Message) => (
    openId === m.id && (
      <div className="col gap-10" style={{ padding: '0 0 16px 58px' }}>
        <p className="t-body">{m.body}</p>
        {m.from && (replyTo === m.id
          ? <MessageBox person={m.from} onDone={() => setReplyTo(null)} />
          : <Button size="sm" variant="outline" style={{ alignSelf: 'flex-start' }} onClick={() => setReplyTo(m.id)}>Reply to {m.from.first}</Button>)}
      </div>
    )
  );

  return (
    <Page crumbs={user?.role === 'hire' ? [{ label: 'Onboarding', to: '/today' }, { label: 'Inbox' }] : [{ label: 'Inbox' }]} kicker="Inbox"
      title={actionCount ? <>{`${actionCount} ${actionCount === 1 ? 'thing' : 'things'}`} <em>{actionCount === 1 ? 'needs you.' : 'need you.'}</em></> : <>You’re all <em>caught up.</em></>}
      lede="Everything your team sends you, in one place. Nothing is urgent unless it says so." aside={aside}>
      {msgs.length === 0 ? (
        <EmptyState emoji="📭" title="No messages yet">When someone writes to you, or something needs you, it shows up here.</EmptyState>
      ) : (
        <>
          {needs.length > 0 && (
            <div className="hero-card">
              <div className="row between"><Caps className="gold">Needs you</Caps><span className="t-mono muted">{needs.length}</span></div>
              <div className="col gap-12 mt-16">
                {needs.map((m) => (
                  <div key={m.id} className="msg-card">
                    <Sender m={m} size={40} />
                    <div className="grow col gap-6">
                      <div className="row between top">
                        <p className="t-h-m">{m.from ? m.from.name : 'Onboarding Buddy'} <span className="t-label muted" style={{ fontWeight: 500 }}>{m.from?.title || ''}</span></p>
                        <span className="row gap-8">{!m.read && <span className="unread-dot" aria-label="Unread" />}<span className="t-mono muted">{relTime(m.createdAt)}</span></span>
                      </div>
                      <p className="t-h-m17">{m.title}</p>
                      <p className="t-body">{m.body}</p>
                      <div className="mt-8"><Button size="sm" arrow onClick={() => openMsg(m)}>{m.link && m.link !== '/inbox' ? 'Open' : openId === m.id ? 'Close' : 'Read'}</Button></div>
                      {body(m)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <section className="section">
            <div className="section-head">
              <Caps>{needs.length ? 'Earlier messages' : 'Messages'}</Caps>
              {unread.length > 0 && <button className="link-btn" onClick={() => markRead(unread.map((m) => m.id))}>Mark all as read</button>}
            </div>
            {earlier.length === 0 ? (
              <p className="t-body muted">Nothing else here for this view.</p>
            ) : (
              <div className="msg-list">
                {earlier.map((m) => (
                  <div key={m.id}>
                    <button className="msg-row" onClick={() => openMsg(m)} aria-expanded={!m.link || m.link === '/inbox' ? openId === m.id : undefined}>
                      {m.read ? <span className="unread-gap" /> : <span className="unread-dot" aria-label="Unread" />}
                      <Sender m={m} size={36} />
                      <span className="grow col gap-2">
                        <span className="t-body"><b>{m.from ? m.from.name : 'Onboarding Buddy'}</b> <span className={m.read ? 'muted' : ''}>{m.title}</span></span>
                        <span className="t-label muted ellipsis">{m.body}</span>
                      </span>
                      <span className="t-mono muted">{relTime(m.createdAt)}</span>
                      <span className="muted" aria-hidden>›</span>
                    </button>
                    {body(m)}
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </Page>
  );
}
