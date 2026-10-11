// Your people: the buddy is the one hero card (peach) with their hello video. Then your crew (manager, People Ops,
// IT) as open tiles with a hello each, and the whole team. Aside: meetings on your calendar, team rituals, a tip.
import { useState } from 'react';
import { useAuth } from '../../auth';
import { Page } from '../../components/Shell';
import { VideoPlayer } from '../../components/Video';
import { Avatar, Button, Caps, Hairline, PlayIcon } from '../../components/ui';
import { dayDate, mmss, shortDate, todayIso } from '../../lib/format';
import type { Person, Task, Video } from '../../lib/types';
import { useApi } from '../../lib/useApi';
import { MessageCompose, VideoModal, addDaysIso, monoDate } from './Journey';
import '../../styles/hire-discovery.css';

type WithHello = Person & { hello: Video | null };
interface PeopleData {
  buddy: (WithHello & { quote: string | null; askAbout: string[] }) | null;
  crew: (WithHello & { duty: string | null })[];
  team: (Person & { isBuddy: boolean })[];
  meetings: Task[];
}

const CREW_ROLE: Record<string, { role: string; line: string; tint: string }> = {
  manager: { role: 'Your manager', line: 'Your goals, your 30-60-90 plan, and weekly 1:1s', tint: 'sky' },
  people_ops: { role: 'People Ops', line: 'Paperwork, pay, benefits, and anything awkward', tint: 'peach' },
  it: { role: 'IT', line: 'Your laptop, logins, and anything that won’t connect', tint: 'sage' },
};
const RITUALS = [
  { emoji: '☕', title: 'Monday kickoff', when: 'Mon · 10:00 · plans for the week' },
  { emoji: '🎨', title: 'Design crit', when: 'Thu · 14:00 · bring anything, even messy' },
  { emoji: '🎉', title: 'Friday demos', when: 'Fri · 16:00 · show what you made' },
];

export default function People() {
  const { data } = useApi<PeopleData>('/api/people');
  const { user } = useAuth();
  const [playing, setPlaying] = useState<Video | null>(null);
  const [compose, setCompose] = useState<null | 'hi' | 'move'>(null);
  if (!data) return <main className="panel"><div className="loading">Loading your people…</div></main>;

  const { buddy, crew, team, meetings } = data;
  const anchor = meetings[0];
  const startDate = anchor ? addDaysIso(anchor.dueDate, -anchor.dueDay) : null;
  const coffee = meetings.find((t) => t.ownerRole === 'hire' && /coffee/i.test(t.title)) || meetings.find((t) => /coffee/i.test(t.title));
  const booked = meetings.some((t) => /coffee/i.test(t.title) && t.status === 'done');
  const today = todayIso();
  const upcoming = [...meetings].filter((t) => t.dueDate >= today && !/^Book /.test(t.title)).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 4);
  const peopleOps = crew.find((c) => c.duty === 'people_ops');
  const teamName = user?.team ? `The ${user.team} team` : 'Your team';
  const everyone = [...team.map((p) => ({ ...p, note: p.isBuddy ? 'your buddy' : '' })), ...(user ? [{ id: user.id, name: user.name, first: user.name.split(' ')[0], title: user.title, photo: user.photo, isBuddy: false, note: 'you' }] : [])];

  const aside = (
    <>
      <section className="section">
        <Caps>On your calendar</Caps>
        {upcoming.length ? (
          <div className="col gap-14">
            {upcoming.map((t) => (
              <div key={t.id} className={`cal-row ${t.status === 'done' ? 'done' : ''}`}>
                <span className="c-dot" aria-hidden />
                <div><p className="t-h-m">{t.title}</p><p className="t-label muted">{t.meta.replace(/^Meeting · /, '')}{t.owner && t.ownerRole !== 'hire' ? ` · with ${t.owner.first}` : ''}{t.status === 'done' ? ' · booked' : ''}</p></div>
                <span className="t-mono muted">{monoDate(t.dueDate)}</span>
              </div>
            ))}
          </div>
        ) : <p className="t-body muted">Nothing booked yet.</p>}
      </section>
      <Hairline />
      <section className="section">
        <Caps>Team rituals</Caps>
        <div className="col gap-12">
          {RITUALS.map((r) => (
            <div key={r.title} className="row gap-12">
              <span className="emoji-tile tint-neutral" style={{ width: 34, height: 34, fontSize: 16, borderRadius: '50%' }} aria-hidden>{r.emoji}</span>
              <div><p className="t-h-m">{r.title}</p><p className="t-label muted">{r.when}</p></div>
            </div>
          ))}
        </div>
      </section>
      <Hairline />
      <section className="section">
        <Caps>A tip from {peopleOps?.first || 'People Ops'}</Caps>
        <p className="t-body">Watch everyone’s hellos before Day 1. It’s much easier to say hi on a call when you already know the face.</p>
      </section>
    </>
  );

  return (
    <Page crumbs={[{ label: 'Your people' }]} kicker="Your people"
      title={<>The people <em>in your corner.</em></>}
      lede="Your buddy, your manager, and the team you’re joining. Everyone recorded a short hello, so you’ll know their faces on Day 1."
      glow={['#FBE3D5', '#DDEBFF']} aside={aside}>
      {buddy && (
        <div className="hero-card peach buddy-hero">
          <div>
            {buddy.hello
              ? <VideoPlayer key={buddy.hello.id} video={buddy.hello} kicker={`Hello · ${mmss(buddy.hello.durationSec)}`} />
              : <img src={buddy.photo || ''} alt="" style={{ width: '100%', aspectRatio: '5 / 6', objectFit: 'cover', borderRadius: 16 }} />}
          </div>
          <div className="col gap-12" style={{ minWidth: 0 }}>
            <Caps>Your buddy{startDate ? ` · until ${shortDate(addDaysIso(startDate, 90))}` : ''}</Caps>
            <div>
              <h2 className="t-l">{buddy.name}</h2>
              {buddy.title && <p className="t-body-l muted" style={{ marginTop: 4 }}>{buddy.title}</p>}
            </div>
            {buddy.quote && <p className="t-body bubble">“{buddy.quote}”</p>}
            {buddy.askAbout.length > 0 && (
              <div className="row wrap gap-8">
                <span className="t-label muted">Ask me about:</span>
                {buddy.askAbout.map((a) => <span key={a} className="ask-chip">{a}</span>)}
              </div>
            )}
            {coffee && <p className="t-label"><span aria-hidden>☕ </span>Coffee chat · {dayDate(coffee.dueDate)} · {booked ? 'booked' : 'not booked yet'}</p>}
            {compose ? (
              <div className="bubble">
                <MessageCompose to={buddy} onClose={() => setCompose(null)}
                  prefill={compose === 'move' ? `Hi ${buddy.first}! Could we move our coffee chat? ` : undefined}
                  label={compose === 'move' ? `Ask ${buddy.first} to move it` : undefined} />
              </div>
            ) : (
              <div className="row gap-12 wrap">
                <Button arrow onClick={() => setCompose('hi')}>Say hi</Button>
                {coffee && <Button variant="outline" onClick={() => setCompose('move')}>Reschedule</Button>}
              </div>
            )}
          </div>
        </div>
      )}

      {crew.length > 0 && (
        <section className="section">
          <Caps>Your crew</Caps>
          <div className="grid-3">
            {crew.map((p) => {
              const r = CREW_ROLE[p.duty || 'manager'] || CREW_ROLE.manager;
              return (
                <div key={p.id} className="crew-tile">
                  <Avatar person={p} size={48} />
                  <p className="t-h-m17 mt-8">{p.name}</p>
                  <p className="t-label muted">{p.title && p.title.toLowerCase().includes(r.role.replace('Your ', '').toLowerCase()) ? p.title : `${r.role}${p.title ? ` · ${p.title}` : ''}`}</p>
                  <p className="t-body" style={{ margin: '8px 0 12px', flex: 1 }}>{r.line}</p>
                  {p.hello
                    ? <button className={`hello-chip tint-${r.tint}`} onClick={() => setPlaying(p.hello)}><span className="pc"><PlayIcon size={9} color="#fff" /></span>Hello · {mmss(p.hello.durationSec)}</button>
                    : <span className="t-label muted">No hello yet</span>}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {everyone.length > 0 && (
        <section className="section">
          <Caps>{teamName} · {everyone.length} people</Caps>
          <div className="team-grid mt-8">
            {everyone.map((p) => (
              <div key={p.id} className="row gap-10 top">
                <Avatar person={p} size={36} />
                <div style={{ minWidth: 0 }}>
                  <p className="t-h-m">{p.name}</p>
                  <p className="t-label muted">{p.title}{p.note ? ` · ${p.note}` : ''}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      <VideoModal video={playing} onClose={() => setPlaying(null)} />
    </Page>
  );
}
