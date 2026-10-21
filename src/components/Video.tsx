// Video player: one spot, three states (Before play → Playing → Finished), matching the Figma "App video states".
// People videos use the presenter's still photo. App walkthroughs use a logo title card (never a photo).
import { useState } from 'react';
import { asset } from '../lib/asset';
import type { AppInfo, Video } from '../lib/types';
import { mmss } from '../lib/format';
import { Avatar, Button, LogoTile, PlayIcon } from './ui';

type State = 'poster' | 'playing' | 'done';

export function VideoPlayer({ video, app, index, total, kicker, onFinish, onNext, nextLabel, onTry }: {
  video: Video; app?: AppInfo | null; index?: number; total?: number; kicker?: string;
  onFinish?: () => void; onNext?: () => void; nextLabel?: string | null; onTry?: () => void;
}) {
  const [state, setState] = useState<State>('poster');
  const dur = mmss(video.durationSec);
  const meta = total ? `Video ${index ?? 1} of ${total} · ${dur}` : kicker || `${dur}`;
  const play = () => setState('playing');
  const finish = () => { setState('done'); onFinish?.(); };
  const chapters = video.chapters || [];
  const at = Math.round((video.durationSec || 200) * 0.29);

  return (
    <div className="video-wrap">
    <div className="video" aria-label={`Video: ${video.title}`}>
      {state === 'poster' && (app ? (
        <div className={`title-card tint-${app.tint}`}>
          <p className="t-caps" style={{ position: 'absolute', left: 36, top: 32 }}>{meta}</p>
          <div className="tc-block">
            <LogoTile app={app} size={112} radius={30} />
            <div className="col gap-4">
              <span className="t-xl">{app.name}</span>
              <span className="t-body-l muted">{video.title}</span>
            </div>
          </div>
          {app.icons.map((ic, i) => (
            <span key={i} className="feature" aria-hidden style={{ right: [190, 90, 200][i], top: [`18%`, `38%`, `55%`][i], transform: `rotate(${[-6, 5, 3][i]}deg)` }}>{ic}</span>
          ))}
          <div className="row gap-16" style={{ position: 'absolute', left: 36, bottom: 32 }}>
            <button className="play-pill" onClick={play}><span className="pc"><PlayIcon size={11} color="#1D4F91" /></span>Play</button>
            {video.presenter && <div className="col"><span className="t-h-m">{video.presenter.name}</span><span className="t-label muted">{video.presenter.title}</span></div>}
          </div>
          {video.presenter && <span style={{ position: 'absolute', right: 36, bottom: 32, borderRadius: '50%', boxShadow: '0 0 0 3px #fff' }}><Avatar person={video.presenter} size={96} /></span>}
        </div>
      ) : (
        <>
          {video.still ? <img className="still" src={video.still} alt="" /> : <div className="still tint-sky" />}
          <div className="scrim" />
          <div className="v-top">
            <p className="t-caps" style={{ color: '#fff' }}>{meta}</p>
            <h3 className="t-m" style={{ color: '#fff', marginTop: 6 }}>{video.title}</h3>
            {video.presenter && <div className="row gap-8 mt-8"><Avatar person={video.presenter} size={28} /><span className="t-label" style={{ color: '#fff' }}>{video.presenter.name}{video.presenter.title ? ` · ${video.presenter.title}` : ''}</span></div>}
          </div>
          <button className="play-big" onClick={play} aria-label={`Play ${video.title}`}><PlayIcon size={20} color="#1A1816" /></button>
        </>
      ))}

      {state === 'playing' && video.url && (
        <>
          <iframe className="embed" src={`${video.url}${video.url.includes('?') ? '&' : '?'}autoplay=1`} title={video.title}
            allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
        </>
      )}

      {state === 'playing' && !video.url && (
        <div className={app ? 'recording' : ''} style={app ? undefined : { position: 'absolute', inset: 0 }} onClick={finish} role="button" tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && finish()} aria-label="Playing. Press to skip to the end.">
          {app ? (
            <>
              <div className="chrome">
                <span className="dot" /><span className="dot" /><span className="dot" />
                <span className="tab"><img src={asset(`/logos/${app.key}.svg`)} alt="" width={14} height={14} />{app.name}</span>
                <span className="rec"><span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--text-danger)' }} />Screen recording</span>
              </div>
              <div style={{ display: 'flex', height: 'calc(100% - 34px)' }}>
                <div style={{ width: 168, background: '#F6F4F1', padding: '22px 18px', display: 'flex', flexDirection: 'column', gap: 17 }}>
                  {[110, 86, 120, 70, 96, 104].map((w, i) => <span key={i} className="skel" style={{ width: w, background: i === 2 ? '#C9DEF9' : undefined, outline: i === 2 ? '2px solid var(--border-focus)' : undefined, outlineOffset: 6 }} />)}
                </div>
                <div style={{ flex: 1, background: '#fff', padding: '22px 28px', display: 'flex', flexDirection: 'column', gap: 22 }}>
                  <span className="skel" style={{ width: 180, height: 12, background: '#DCD8D2' }} />
                  {[300, 240, 330].map((w, i) => (
                    <div key={i} className="row gap-12"><span style={{ width: 30, height: 30, borderRadius: '50%', background: '#E6E2DC' }} />
                      <div className="col gap-8"><span className="skel" style={{ width: 90, height: 8 }} /><span className="skel" style={{ width: w, height: 8, background: '#E9E6E1' }} /></div></div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              {video.still && <img className="still" src={video.still} alt="" />}
            </>
          )}
          {app && video.presenter && <span className="face"><Avatar person={video.presenter} size={84} /></span>}
          {video.caption && <span className="caption">{video.caption}</span>}
          <div className="controls">
            <span className="row gap-4" aria-hidden><i style={{ width: 4, height: 14, background: '#fff', borderRadius: 1.5 }} /><i style={{ width: 4, height: 14, background: '#fff', borderRadius: 1.5 }} /></span>
            <span className="t-mono" style={{ color: '#fff' }}>{mmss(at)} / {dur}</span>
            <span className="scrub"><i style={{ width: '29%' }} />{chapters.slice(1).map(([s], i) => <b key={i} style={{ left: `${(s / (video.durationSec || 1)) * 100}%` }} />)}</span>
            <span className="t-label" style={{ color: '#fff' }}>1.5×</span>
            <span className="t-label" style={{ color: '#fff', border: '1.2px solid #fff', borderRadius: 4, padding: '0 5px' }}>CC</span>
          </div>
        </div>
      )}

      {state === 'done' && (
        <div className={`finished ${app ? 'tint-' + app.tint : 'tint-sky'}`}>
          <span style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--text-success)', display: 'grid', placeItems: 'center', color: '#fff', fontSize: 26 }} aria-hidden>✓</span>
          <h3 className="t-l">{total ? `Video ${index ?? 1} done.` : 'Done.'}</h3>
          {nextLabel && <p className="t-body-l muted">Up next: {nextLabel}</p>}
          <div className="row gap-12 mt-8">
            {onNext ? <Button arrow onClick={() => { onNext(); setState('poster'); }}>Play next</Button> : <Button variant="outline" onClick={() => setState('poster')}>Watch again</Button>}
            {onTry && <Button variant="outline" arrow onClick={onTry}>Try it now</Button>}
          </div>
        </div>
      )}
    </div>
    {state === 'playing' && video.url && (
      <div className="row between mt-8">
        <span className="t-label muted">Playing from {video.url.includes('loom') ? 'Loom' : video.url.includes('vimeo') ? 'Vimeo' : 'YouTube'}. Finished?</span>
        <button className="link-btn" onClick={finish}>Mark as watched</button>
      </div>
    )}
    </div>
  );
}

/** Library / hub card. App walkthroughs lead with the logo; people videos with their still. */
export function VideoCard({ video, app, kind, title, meta, status, onClick, footer }: {
  video?: Video | null; app?: AppInfo | null; kind: string; title: string; meta?: React.ReactNode; status?: React.ReactNode; onClick?: () => void; footer?: React.ReactNode;
}) {
  const missing = video?.status === 'missing';
  return (
    <button type="button" className="vcard" onClick={onClick}>
      <div className={`thumb ${app ? 'tint-' + app.tint : ''}`} style={missing ? { background: 'var(--tint-sky)' } : undefined}>
        {app ? <span style={{ position: 'absolute', left: '50%', top: '46%', transform: 'translate(-50%,-50%)' }}><LogoTile app={app} size={64} radius={18} /></span>
          : video?.still ? <img className="still" src={video.still} alt="" /> : null}
        {missing
          ? <span className="dur-pill"><span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--text-danger)' }} />Record</span>
          : video?.durationSec != null && <span className="dur-pill">{mmss(video.durationSec)}</span>}
        {!missing && <span className="play-dot" aria-hidden><PlayIcon size={11} color="#fff" /></span>}
      </div>
      <div className="body">
        <span className="t-caps">{kind}</span>
        <span className="t-h-m17">{title}</span>
        {meta && <span className="t-label muted">{meta}</span>}
        {status}
        {footer}
      </div>
    </button>
  );
}
