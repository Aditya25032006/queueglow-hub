import React, { useEffect, useRef, useState } from 'react';
import Connectivity from './Connectivity.jsx';
import {
  Home,
  TerminalSquare,
  Sparkles,
  Music2,
  Timer,
  Moon,
  Inbox,
  Copy,
  FileText,
  CalendarDays,
  Mail,
  Volume2,
  Plus,
  MoreHorizontal,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  X,
  FolderOpen,
  Send,
  Maximize2,
  Minimize2,
  Settings2,
  LayoutGrid,
  Check,
  Trash2,
  Link,
  Clipboard,
  Bell,
  KeyRound,
  ExternalLink,
  Wifi,
  Bluetooth,
  Battery,
  BatteryCharging,
  Sun,
  RefreshCw,
  Pencil,
  Power,
} from 'lucide-react';

const ICONS = {
  home: Home,
  codex: TerminalSquare,
  robo: Sparkles,
  music: Music2,
  focus: Timer,
  modes: Moon,
  tray: Inbox,
  clips: Copy,
  note: FileText,
  agenda: CalendarDays,
  mail: Mail,
};
const NAMES = {
  home: 'Home',
  codex: 'Codex',
  robo: 'Robo',
  music: 'Music',
  focus: 'Focus',
  modes: 'Modes',
  tray: 'Tray',
  clips: 'Clips',
  note: 'Note',
  agenda: 'Agenda',
  mail: 'Mail',
};
const fmt = (seconds) =>
  `${Math.floor(Math.max(0, seconds) / 60)
    .toString()
    .padStart(2, '0')}:${Math.floor(Math.max(0, seconds) % 60)
    .toString()
    .padStart(2, '0')}`;
const clock = (date) => date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const day = (date) =>
  `${date.toLocaleDateString([], { weekday: 'short' })} ${date.getDate()} ${date.toLocaleDateString([], { month: 'short' })}`.toUpperCase();
const initial = {
  settings: {},
  apps: [],
  jobs: [],
  events: [],
  clips: [],
  tray: [],
  agenda: [],
  modes: [],
  pending: [],
  note: '',
  audio: [],
  systemMedia: null,
  volume: null,
  system: null,
  focus: null,
  folded: true,
  motion: 'idle',
};

export default function App() {
  const [state, setState] = useState(initial),
    [page, setPage] = useState('home'),
    [menu, setMenu] = useState(false),
    [now, setNow] = useState(new Date());
  const [volumeOpen, setVolumeOpen] = useState(false),
    [volumeDraft, setVolumeDraft] = useState(0),
    [brightnessDraft, setBrightnessDraft] = useState(50);
  const [connectivityOpen, setConnectivityOpen] = useState(false);
  const [error, setError] = useState(''),
    [success, setSuccess] = useState('');
  const [duration, setDuration] = useState(25),
    [selectedMode, setSelectedMode] = useState('work');
  const [note, setNote] = useState(''),
    [agendaTitle, setAgendaTitle] = useState(''),
    [agendaStart, setAgendaStart] = useState(''),
    [agendaEnd, setAgendaEnd] = useState('');
  const [prompt, setPrompt] = useState(''),
    [answer, setAnswer] = useState(''),
    [busy, setBusy] = useState(false),
    [apiKey, setApiKey] = useState(''),
    [captureTarget, setCaptureTarget] = useState('none'),
    [roboTargets, setRoboTargets] = useState([]);
  const [track, setTrack] = useState(0),
    [playing, setPlaying] = useState(false),
    [progress, setProgress] = useState(0);
  const audio = useRef(null);
  const foldTimer = useRef(null);
  useEffect(() => {
    window.hub.state().then((s) => {
      setState(s);
      setNote(s.note || '');
    });
    return window.hub.onUpdate((s) => {
      setState(s);
      if (document.activeElement?.tagName !== 'TEXTAREA') setNote(s.note || '');
    });
  }, []);
  useEffect(
    () => window.hub.onMotion((value) => setState((previous) => ({ ...previous, ...value }))),
    [],
  );
  useEffect(() => {
    if (state.folded || state.motion === 'folding') {
      setMenu(false);
      setVolumeOpen(false);
      setConnectivityOpen(false);
    }
  }, [state.folded, state.motion]);
  useEffect(
    () =>
      window.hub.onPresence(({ x, y, sleeping }) => {
        document.documentElement.style.setProperty('--gaze-x', `${x}px`);
        document.documentElement.style.setProperty('--gaze-y', `${y}px`);
        document.documentElement.dataset.eyesSleep = String(sleeping);
      }),
    [],
  );
  useEffect(() => {
    document.documentElement.dataset.reduceMotion = String(!!state.settings?.reduceMotion);
  }, [state.settings?.reduceMotion]);
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 500);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (state.volume !== null) setVolumeDraft(state.volume);
  }, [state.volume]);
  useEffect(() => {
    if (state.system?.brightnessPercent !== null && state.system?.brightnessPercent !== undefined)
      setBrightnessDraft(state.system.brightnessPercent);
  }, [state.system?.brightnessPercent]);
  useEffect(() => {
    if (page === 'robo')
      window.hub
        .roboTargets()
        .then(setRoboTargets)
        .catch(() => setRoboTargets([]));
  }, [page]);
  useEffect(() => {
    if (page !== 'music' || !audio.current) return;
    if (playing) audio.current.play().catch(() => setPlaying(false));
    else audio.current.pause();
  }, [playing, track, page]);
  const activeTrack = state.audio[track];
  const remaining = state.focus
    ? Math.max(0, Math.ceil((new Date(state.focus.deadline_at) - now) / 1000))
    : duration * 60;
  const jobsToday = state.jobs.filter(
    (job) => new Date(job.started_at).toDateString() === now.toDateString(),
  ).length;
  const call = async (fn, message) => {
    setError('');
    setSuccess('');
    try {
      await fn();
      if (message) setSuccess(message);
    } catch (e) {
      setError(e.message || String(e));
    }
  };
  const navigate = (id) => {
    setPage(id);
    setMenu(false);
    setError('');
    setSuccess('');
  };
  const visible = state.apps.filter((app) => app.visible).map((app) => app.id);
  const cancelFold = () => {
    if (foldTimer.current) clearTimeout(foldTimer.current);
    foldTimer.current = null;
  };
  const scheduleFold = () => {
    cancelFold();
    foldTimer.current = setTimeout(() => call(() => window.hub.fold()), 650);
  };

  return (
    <div
      className={`shell theme-${page} motion-${state.folded ? 'folded' : state.motion || 'idle'}`}
      onMouseEnter={cancelFold}
      onMouseLeave={scheduleFold}
    >
      <div className="island-notch">
        <div className="eyes">
          <span />
          <span />
        </div>
      </div>
      <header className="topbar">
        <div className="header-left">
          <Connectivity
            system={state.system}
            open={connectivityOpen}
            setOpen={setConnectivityOpen}
            dismissOtherPanels={() => {
              setMenu(false);
              setVolumeOpen(false);
            }}
            call={call}
          />
          <span className="date mono">{day(now)}</span>
        </div>
        <span className="topcenter">QUEUEGLOW</span>
        <div className="header-right">
          <button
            className="battery-button mono"
            aria-label="Battery and quick controls"
            onClick={() => {
              setMenu(false);
              setConnectivityOpen(false);
              setVolumeOpen(!volumeOpen);
            }}
          >
            {state.system?.charging ? <BatteryCharging size={17} /> : <Battery size={17} />}
            <span>
              {state.system?.batteryPercent === null || state.system?.batteryPercent === undefined
                ? '—'
                : `${state.system.batteryPercent}%`}
            </span>
          </button>
          <span className="time mono">{clock(now)}</span>
          <button
            className="icon-button"
            aria-label="More options"
            onClick={() => {
              setVolumeOpen(false);
              setConnectivityOpen(false);
              setMenu(!menu);
            }}
          >
            <MoreHorizontal />
          </button>
        </div>
      </header>
      {menu && (
        <div className="menu" role="group" aria-label="App menu">
          <label className="menu-volume">
            <Volume2 size={17} />
            <input
              aria-label="Menu volume"
              type="range"
              min="0"
              max="100"
              disabled={state.volume === null}
              value={volumeDraft}
              onChange={(e) => setVolumeDraft(Number(e.target.value))}
              onPointerUp={() => call(() => window.hub.volumeSet(volumeDraft))}
              onKeyUp={() => call(() => window.hub.volumeSet(volumeDraft))}
            />
          </label>
          <div className="menu-grid">
            <button onClick={() => navigate('all')}>
              <LayoutGrid size={19} />
              All apps
            </button>
            <button onClick={() => navigate('customize')}>
              <Pencil size={19} />
              Customize
            </button>
            <button onClick={() => navigate('settings')}>
              <Settings2 size={19} />
              Settings
            </button>
            <button
              onClick={() => {
                setMenu(false);
                setSuccess('Updates are not configured in this preview.');
              }}
            >
              <RefreshCw size={19} />
              Updates
            </button>
            <button
              onClick={() => {
                setMenu(false);
                call(() => window.hub.fold());
              }}
            >
              <ChevronUp size={19} />
              Fold in
            </button>
            <button className="quit-tile" onClick={() => window.hub.quit()}>
              <Power size={19} />
              Quit
            </button>
          </div>
        </div>
      )}
      <main className="content">
        {page === 'home' && (
          <HomePage
            now={now}
            jobsToday={jobsToday}
            state={state}
            remaining={remaining}
            navigate={navigate}
            play={() => {
              navigate('music');
              if (activeTrack) setPlaying(true);
            }}
          />
        )}
        {page === 'codex' && <AgentPage state={state} call={call} navigate={navigate} />}
        {page === 'robo' && (
          <section className="robo-page">
            <div className="page-title">
              Robo <span className="subtle">Your screen companion</span>
            </div>
            <div className="robo-answer">
              <PagedText
                text={
                  busy
                    ? 'Thinking…'
                    : answer || 'Ask a question, explain a concept, or refine a piece of writing.'
                }
              />
            </div>
            <div className="chips">
              {['Explain this', 'Check spelling', 'Translate', 'Summarize'].map((v) => (
                <button key={v} onClick={() => setPrompt(v + ': ')}>
                  {v}
                </button>
              ))}
              <select
                aria-label="Image to include"
                value={captureTarget}
                onChange={(e) => setCaptureTarget(e.target.value)}
              >
                <option value="none">No image</option>
                <option value="screen">Entire screen</option>
                {roboTargets.map((target) => (
                  <option key={target.id} value={target.id}>
                    {target.name}
                  </option>
                ))}
              </select>
            </div>
            <form
              className="composer"
              onSubmit={(e) => {
                e.preventDefault();
                setBusy(true);
                call(async () => {
                  setAnswer(await window.hub.roboAsk(prompt, captureTarget));
                  setPrompt('');
                  setCaptureTarget('none');
                }, null).finally(() => setBusy(false));
              }}
            >
              <input
                aria-label="Ask Robo"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ask Robo anything"
              />
              <button aria-label="Send question" type="submit">
                <Send size={22} />
              </button>
            </form>
          </section>
        )}
        {page === 'music' && (
          <MusicPage
            state={state}
            activeTrack={activeTrack}
            audio={audio}
            progress={progress}
            setProgress={setProgress}
            playing={playing}
            setPlaying={setPlaying}
            track={track}
            setTrack={setTrack}
            call={call}
          />
        )}
        {page === 'focus' && (
          <section className="focus-page">
            <div className="eyebrow">MAKE SPACE FOR WHAT MATTERS</div>
            <h1>Focus</h1>
            <div className="focus-time mono">{fmt(remaining)}</div>
            <p>
              {state.focus
                ? `Until ${clock(new Date(state.focus.deadline_at))}`
                : `Ready when you are · ends at ${clock(new Date(now.getTime() + duration * 60000))}`}
            </p>
            <div className="duration-row">
              {[15, 25, 45, 60].map((value) => (
                <button
                  className={duration === value ? 'selected' : ''}
                  key={value}
                  onClick={() => setDuration(value)}
                  disabled={!!state.focus}
                >
                  {value} min
                </button>
              ))}
            </div>
            <button
              className="primary-button"
              onClick={() =>
                call(() =>
                  state.focus
                    ? window.hub.focusStop()
                    : window.hub.focusStart(selectedMode, duration * 60),
                )
              }
            >
              {state.focus ? 'End focus' : 'Start focus'}{' '}
              {state.focus ? <X size={18} /> : <Play size={18} />}
            </button>
          </section>
        )}
        {page === 'modes' && (
          <section className="modes-page">
            <div className="page-title">
              Modes <span className="subtle">Set the tone</span>
            </div>
            <div className="mode-grid">
              {(state.modes || []).map((mode) => (
                <button
                  key={mode.id}
                  className={`mode-card ${selectedMode === mode.id ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedMode(mode.id);
                    setDuration(mode.duration_seconds / 60);
                  }}
                >
                  <span className="mode-dot" />
                  <strong>{mode.name}</strong>
                  <small>{Math.round(mode.duration_seconds / 60)} minute session</small>
                </button>
              ))}
            </div>
            <div className="mode-options">
              <span>Site blocking</span>
              <span className="muted">Coming later</span>
              <span>Quiet contacts</span>
              <span className="muted">Coming later</span>
              <span>Keep music playing</span>
              <span className="muted">Local player</span>
            </div>
            <button
              className="primary-button"
              onClick={() => {
                navigate('focus');
                call(() => window.hub.focusStart(selectedMode, duration * 60));
              }}
            >
              Start {selectedMode}
            </button>
          </section>
        )}
        {page === 'tray' && (
          <section
            className="list-page"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const files = [...e.dataTransfer.files];
              call(async () => {
                for (const file of files)
                  await window.hub.trayDrop(file.name, new Uint8Array(await file.arrayBuffer()));
              }, 'Files added');
            }}
          >
            <div className="page-title">
              Tray <span className="subtle">Keep files close</span>
            </div>
            <div className="action-row">
              <button className="primary-button" onClick={() => call(() => window.hub.trayAdd())}>
                <Plus size={18} /> Add files
              </button>
              <span className="muted">Drop files here · 25 MB each · stored on this PC</span>
            </div>
            {!state.tray.length ? (
              <Empty
                icon={Inbox}
                title="Your tray is empty"
                body="Drop files here or choose Add files."
              />
            ) : (
              <PagedItems items={state.tray} pageSize={2} className="item-list">
                {(file) => (
                  <div className="list-item" key={file.id}>
                    <FolderOpen size={20} />
                    <span className="item-name">{file.name}</span>
                    <small>{Math.ceil(file.byte_size / 1024)} KB</small>
                    <button
                      aria-label={`Show ${file.name}`}
                      onClick={() => call(() => window.hub.trayOpen(file.id))}
                    >
                      <ExternalLink size={18} />
                    </button>
                    <button
                      aria-label={`Remove ${file.name}`}
                      onClick={() => call(() => window.hub.trayRemove(file.id))}
                    >
                      <X size={18} />
                    </button>
                  </div>
                )}
              </PagedItems>
            )}
          </section>
        )}
        {page === 'clips' && (
          <section className="list-page">
            <div className="page-title">
              Clips <span className="subtle">Your recent copies</span>
            </div>
            <div className="action-row">
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={!!state.settings.clipboardEnabled}
                  onChange={(e) =>
                    call(() => window.hub.setting('clipboardEnabled', e.target.checked))
                  }
                />{' '}
                Capture text
              </label>
              <button className="soft-button" onClick={() => call(() => window.hub.clipClear())}>
                <Trash2 size={16} /> Clear history
              </button>
            </div>
            {!state.clips.length ? (
              <Empty
                icon={Copy}
                title="No clips yet"
                body="Turn on capture, then copy text or a link."
              />
            ) : (
              <PagedItems items={state.clips} pageSize={2} className="item-list">
                {(clip) => (
                  <button
                    className="list-item clip"
                    key={clip.id}
                    onClick={() => call(() => window.hub.clipCopy(clip.id), 'Copied to clipboard')}
                  >
                    <span>
                      {clip.kind === 'link' ? <Link size={19} /> : <Clipboard size={19} />}
                    </span>
                    <span className="item-name">{clip.preview}</span>
                    <small>
                      {new Date(clip.captured_at).toLocaleTimeString([], {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </small>
                    <Copy size={16} />
                  </button>
                )}
              </PagedItems>
            )}
          </section>
        )}
        {page === 'note' && (
          <section className="note-page">
            <div className="page-title">
              Note <span className="subtle">A space for quick thoughts</span>
            </div>
            <textarea
              aria-label="Your note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Write anything here…"
            />
            <button
              className="primary-button"
              onClick={() => call(() => window.hub.noteSave(note), 'Saved locally')}
            >
              <Check size={18} /> Save note
            </button>
          </section>
        )}
        {page === 'agenda' && (
          <AgendaPage
            state={state}
            call={call}
            now={now}
            agendaTitle={agendaTitle}
            setAgendaTitle={setAgendaTitle}
            agendaStart={agendaStart}
            setAgendaStart={setAgendaStart}
            agendaEnd={agendaEnd}
            setAgendaEnd={setAgendaEnd}
          />
        )}
        {page === 'mail' && (
          <section className="center-page">
            <Mail size={60} />
            <h1>Mail at a glance</h1>
            <p>
              Google Mail connection is not available in this build. Your inbox stays in your mail
              app.
            </p>
            <span className="muted">No account is connected and no messages are read.</span>
          </section>
        )}
        {page === 'all' && (
          <section className="all-page">
            <div className="page-title">All apps</div>
            <div className="all-grid">
              {Object.keys(NAMES).map((id) => {
                const Icon = ICONS[id];
                return (
                  <button key={id} onClick={() => navigate(id)}>
                    <Icon size={26} />
                    {NAMES[id]}
                  </button>
                );
              })}
            </div>
          </section>
        )}
        {page === 'customize' && (
          <section className="list-page">
            <div className="page-title">
              Customize <span className="subtle">Choose apps for your dock</span>
            </div>
            <div className="custom-grid">
              {state.apps.map((app) => {
                const Icon = ICONS[app.id];
                return (
                  <label key={app.id}>
                    <Icon size={21} />
                    {NAMES[app.id]}
                    <input
                      type="checkbox"
                      checked={app.visible}
                      disabled={app.id === 'home'}
                      onChange={(e) => call(() => window.hub.appVisible(app.id, e.target.checked))}
                    />
                  </label>
                );
              })}
            </div>
          </section>
        )}
        {page === 'settings' && (
          <section className="settings-page">
            <div className="page-title">Settings</div>
            <div className="settings-grid">
              <div>
                <h2>Local controls</h2>
                {['notifications', 'sound', 'reduceMotion'].map((key) => (
                  <label className="setting-line" key={key}>
                    {key === 'reduceMotion' ? 'Reduce motion' : key[0].toUpperCase() + key.slice(1)}
                    <input
                      type="checkbox"
                      checked={!!state.settings[key]}
                      onChange={(e) => call(() => window.hub.setting(key, e.target.checked))}
                    />
                  </label>
                ))}
                <button className="soft-button" onClick={() => call(() => window.hub.fold())}>
                  <Minimize2 size={16} /> Fold in
                </button>
              </div>
              <div>
                <h2>Coding agents</h2>
                {['codex', 'claude'].map((provider) => (
                  <div className="agent-connect" key={provider}>
                    <span>{provider === 'codex' ? 'Codex' : 'Claude Code'}</span>
                    <button
                      onClick={() =>
                        call(
                          () => window.hub.hooks('connect', provider),
                          `${provider} hook connected. Restart the agent.`,
                        )
                      }
                    >
                      Connect
                    </button>
                    <button
                      onClick={() =>
                        call(
                          () => window.hub.hooks('remove', provider),
                          `${provider} hook removed.`,
                        )
                      }
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <h2>Robo API key</h2>
                <div className="key-row">
                  <input
                    type="password"
                    aria-label="OpenAI API key"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Your OpenAI API key"
                  />
                  <button
                    onClick={() =>
                      call(async () => {
                        await window.hub.roboKey(apiKey);
                        setApiKey('');
                      }, 'Key saved with Windows encryption')
                    }
                  >
                    <KeyRound size={18} /> Save
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
      {(error || success) && (
        <div className={`toast ${error ? 'error' : ''}`} role="status">
          {error || success}
          <button
            onClick={() => {
              setError('');
              setSuccess('');
            }}
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      )}
      {volumeOpen && (
        <div className="volume-panel" role="group" aria-label="Quick controls">
          <div className="quick-title">
            Quick controls{' '}
            <button aria-label="Close quick controls" onClick={() => setVolumeOpen(false)}>
              <X size={16} />
            </button>
          </div>
          <label htmlFor="system-volume">
            <Volume2 size={17} /> Volume{' '}
            <span>{state.volume === null ? 'Unavailable' : `${volumeDraft}%`}</span>
          </label>
          <input
            id="system-volume"
            type="range"
            min="0"
            max="100"
            disabled={state.volume === null}
            value={volumeDraft}
            onChange={(e) => setVolumeDraft(Number(e.target.value))}
            onPointerUp={() => call(() => window.hub.volumeSet(volumeDraft))}
            onKeyUp={() => call(() => window.hub.volumeSet(volumeDraft))}
          />
          <label htmlFor="system-brightness">
            <Sun size={17} /> Brightness{' '}
            <span>
              {state.system?.brightnessPercent == null ? 'Unavailable' : `${brightnessDraft}%`}
            </span>
          </label>
          <input
            id="system-brightness"
            type="range"
            min="0"
            max="100"
            disabled={state.system?.brightnessPercent == null}
            value={brightnessDraft}
            onChange={(e) => setBrightnessDraft(Number(e.target.value))}
            onPointerUp={() => call(() => window.hub.brightnessSet(brightnessDraft))}
            onKeyUp={() => call(() => window.hub.brightnessSet(brightnessDraft))}
          />
          <div className="quick-battery">
            {state.system?.charging ? <BatteryCharging size={17} /> : <Battery size={17} />} Battery{' '}
            <strong>
              {state.system?.batteryPercent == null
                ? 'Unavailable'
                : `${state.system.batteryPercent}%${state.system.charging ? ' · Charging' : ''}`}
            </strong>
          </div>
        </div>
      )}
      <footer className="dock">
        <button className="dock-plus" aria-label="All apps" onClick={() => navigate('all')}>
          <Plus />
        </button>
        <nav aria-label="Apps">
          {visible.map((id) => {
            const Icon = ICONS[id];
            return (
              <button
                key={id}
                className={page === id ? 'current' : ''}
                aria-label={NAMES[id]}
                aria-current={page === id ? 'page' : undefined}
                onClick={() => navigate(id)}
              >
                <Icon size={23} />
                {page === id && <span>{NAMES[id]}</span>}
              </button>
            );
          })}
        </nav>
        <button
          className="dock-volume"
          aria-label="Quick controls"
          onClick={() => {
            setMenu(false);
            setConnectivityOpen(false);
            setVolumeOpen(!volumeOpen);
          }}
        >
          <Volume2 size={21} />
        </button>
      </footer>
    </div>
  );
}

function Empty({ icon: Icon, title, body }) {
  return (
    <div className="empty">
      <Icon size={42} />
      <strong>{title}</strong>
      <span>{body}</span>
    </div>
  );
}
function PagedItems({ items, pageSize, className = '', children }) {
  const [page, setPage] = useState(0);
  const last = Math.max(0, Math.ceil(items.length / pageSize) - 1);
  const current = Math.min(page, last);
  return (
    <div className="paged-items">
      <div className={className}>
        {items.slice(current * pageSize, (current + 1) * pageSize).map(children)}
      </div>
      {last > 0 && (
        <div className="page-controls">
          <button
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
            aria-label="Previous items"
          >
            ‹
          </button>
          <span>
            {current + 1} / {last + 1}
          </span>
          <button
            disabled={current === last}
            onClick={() => setPage(current + 1)}
            aria-label="Next items"
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}
function PagedText({ text }) {
  const [page, setPage] = useState(0);
  const chunks = text.match(/[\s\S]{1,220}/g) || [''];
  const current = Math.min(page, chunks.length - 1);
  return (
    <div className="paged-text">
      <div>{chunks[current]}</div>
      {chunks.length > 1 && (
        <div className="page-controls">
          <button
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
            aria-label="Previous answer"
          >
            ‹
          </button>
          <span>
            {current + 1} / {chunks.length}
          </span>
          <button
            disabled={current === chunks.length - 1}
            onClick={() => setPage(current + 1)}
            aria-label="Next answer"
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}
function MusicPage({
  state,
  activeTrack,
  audio,
  progress,
  setProgress,
  playing,
  setPlaying,
  track,
  setTrack,
  call,
}) {
  const system = state.systemMedia;
  const title = system?.title || activeTrack?.name || 'Your soundtrack starts here';
  const isPlaying = system ? system.playing : playing;
  const percent = system?.duration
    ? Math.min(100, (system.position / system.duration) * 100)
    : progress;
  const control = (action, seconds) =>
    system ? call(() => window.hub.mediaControl(action, seconds)) : null;
  return (
    <section className="music-page">
      <div className="album-placeholder">
        {system?.artwork ? (
          <img className="album-art" src={system.artwork} alt={`${title} cover art`} />
        ) : (
          <Music2 size={96} />
        )}
      </div>
      <div className="music-info">
        <div className="eyebrow">{system ? 'WINDOWS MEDIA' : 'LOCAL MUSIC'}</div>
        <h1>{title}</h1>
        <p>
          {system
            ? system.artist || 'Current Windows media session'
            : activeTrack
              ? 'Playing from your files'
              : 'Add audio files or play music in another Windows app.'}
        </p>
        <input
          className="seek"
          aria-label="Track position"
          type="range"
          min="0"
          max="100"
          value={percent}
          onChange={(e) => {
            const value = Number(e.target.value);
            if (system?.duration) control('seek', (system.duration * value) / 100);
            else if (audio.current?.duration)
              audio.current.currentTime = (audio.current.duration * value) / 100;
            setProgress(value);
          }}
        />
        <div className="transport">
          <button
            aria-label="Previous track"
            onClick={() =>
              system ? control('previous') : (setTrack(Math.max(0, track - 1)), setPlaying(true))
            }
          >
            <SkipBack />
          </button>
          <button
            className="play-button"
            aria-label={isPlaying ? 'Pause' : 'Play'}
            onClick={() => (system ? control('playPause') : setPlaying(!playing))}
          >
            {isPlaying ? <Pause /> : <Play />}
          </button>
          <button
            aria-label="Next track"
            onClick={() =>
              system
                ? control('next')
                : (setTrack(Math.min(state.audio.length - 1, track + 1)), setPlaying(true))
            }
          >
            <SkipForward />
          </button>
        </div>
        <button className="soft-button" onClick={() => call(() => window.hub.musicOpen())}>
          <Plus size={16} /> Add local music
        </button>
        {activeTrack && !system && (
          <audio
            ref={audio}
            src={activeTrack.url}
            onTimeUpdate={(e) =>
              setProgress(e.target.duration ? (e.target.currentTime / e.target.duration) * 100 : 0)
            }
            onEnded={() => setPlaying(false)}
          />
        )}
      </div>
    </section>
  );
}
function AgendaPage({
  state,
  call,
  now,
  agendaTitle,
  setAgendaTitle,
  agendaStart,
  setAgendaStart,
  agendaEnd,
  setAgendaEnd,
}) {
  const [view, setView] = useState('day');
  const [selected, setSelected] = useState(() => new Date());
  const daysInMonth = new Date(selected.getFullYear(), selected.getMonth() + 1, 0).getDate();
  const offset = (new Date(selected.getFullYear(), selected.getMonth(), 1).getDay() + 6) % 7;
  const eventsOnDay = (date) =>
    state.agenda.filter(
      (event) => new Date(event.starts_at).toDateString() === date.toDateString(),
    );
  const chosenEvents = eventsOnDay(selected);
  return (
    <section className="agenda-page">
      <div className="page-title">
        Agenda <span className="subtle">{day(selected)}</span>
        <div className="view-tabs">
          <button className={view === 'day' ? 'active' : ''} onClick={() => setView('day')}>
            Day
          </button>
          <button className={view === 'month' ? 'active' : ''} onClick={() => setView('month')}>
            Month
          </button>
        </div>
      </div>
      <div className="agenda-layout">
        <div className="agenda-list">
          {view === 'day' ? (
            <>
              <div className="day-head">
                <button
                  aria-label="Previous day"
                  onClick={() =>
                    setSelected(
                      new Date(selected.getFullYear(), selected.getMonth(), selected.getDate() - 1),
                    )
                  }
                >
                  ‹
                </button>
                <h2>{selected.toDateString() === now.toDateString() ? 'Today' : day(selected)}</h2>
                <button
                  aria-label="Next day"
                  onClick={() =>
                    setSelected(
                      new Date(selected.getFullYear(), selected.getMonth(), selected.getDate() + 1),
                    )
                  }
                >
                  ›
                </button>
              </div>
              {chosenEvents.length ? (
                <PagedItems items={chosenEvents} pageSize={2} className="agenda-events">
                  {(event) => (
                    <div className="timeline-event" key={event.id}>
                      <span className="mono">
                        {new Date(event.starts_at).toLocaleTimeString([], {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </span>
                      <strong title={event.title}>{event.title}</strong>
                      <button
                        aria-label={`Remove ${event.title}`}
                        onClick={() => call(() => window.hub.agendaRemove(event.id))}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}
                </PagedItems>
              ) : (
                <p className="agenda-empty">No events today</p>
              )}
            </>
          ) : (
            <>
              <div className="month-head">
                <button
                  onClick={() =>
                    setSelected(new Date(selected.getFullYear(), selected.getMonth() - 1, 1))
                  }
                >
                  ‹
                </button>
                <h2>{selected.toLocaleDateString([], { month: 'long', year: 'numeric' })}</h2>
                <button
                  onClick={() =>
                    setSelected(new Date(selected.getFullYear(), selected.getMonth() + 1, 1))
                  }
                >
                  ›
                </button>
              </div>
              <div className="month-grid">
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((label, i) => (
                  <span key={i} className="weekday">
                    {label}
                  </span>
                ))}
                {Array.from({ length: offset }, (_, i) => (
                  <span key={`blank${i}`} />
                ))}
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const date = new Date(selected.getFullYear(), selected.getMonth(), i + 1);
                  return (
                    <button
                      key={i}
                      className={date.toDateString() === selected.toDateString() ? 'active' : ''}
                      onClick={() => {
                        setSelected(date);
                        setView('day');
                      }}
                    >
                      {i + 1}
                      {eventsOnDay(date).length > 0 && <i />}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
        <form
          className="agenda-form"
          onSubmit={(e) => {
            e.preventDefault();
            call(() => window.hub.agendaAdd(agendaTitle, agendaStart, agendaEnd), 'Event added');
            setAgendaTitle('');
          }}
        >
          <h2>Add local event</h2>
          <input
            aria-label="Event title"
            placeholder="Event title"
            value={agendaTitle}
            onChange={(e) => setAgendaTitle(e.target.value)}
          />
          <label>
            Starts
            <input
              type="datetime-local"
              value={agendaStart}
              onChange={(e) => setAgendaStart(e.target.value)}
            />
          </label>
          <label>
            Ends
            <input
              type="datetime-local"
              value={agendaEnd}
              onChange={(e) => setAgendaEnd(e.target.value)}
            />
          </label>
          <button className="primary-button" type="submit">
            <Plus size={17} /> Add event
          </button>
          <span className="muted">Stored only on this PC</span>
        </form>
      </div>
    </section>
  );
}
function HomePage({ now, jobsToday, state, remaining, navigate, play }) {
  return (
    <section className="home-page">
      <div className="hero-clock mono">{clock(now).replace(/\s?(AM|PM)$/i, '')}</div>
      <div className="home-cards">
        <button onClick={() => navigate('codex')}>
          <span className="card-number mono">{jobsToday}</span>
          <span>jobs today</span>
        </button>
        <button onClick={play}>
          {state.systemMedia?.artwork ? (
            <img className="home-cover" src={state.systemMedia.artwork} alt="Current track cover" />
          ) : (
            <Music2 size={29} />
          )}
          <span>
            <strong>{state.systemMedia?.title || state.audio[0]?.name || 'Music'}</strong>
            <small>
              {state.systemMedia
                ? state.systemMedia.playing
                  ? 'Playing'
                  : 'Paused'
                : state.audio.length
                  ? 'Ready to play'
                  : 'Add your songs'}
            </small>
          </span>
          <Play className="round-icon" size={18} />
        </button>
        <button onClick={() => navigate('focus')}>
          <span className="card-number mono">{fmt(remaining)}</span>
          <span>{state.focus ? 'Focus in progress' : 'Focus, ready'}</span>
          <Play className="round-icon" size={18} />
        </button>
      </div>
    </section>
  );
}
function AgentPage({ state, call, navigate }) {
  return (
    <section className="agent-page">
      <div className="agent-side">
        <div className="big-eyes">
          <span />
          <span />
        </div>
        <div className="agent-count mono">
          {
            state.jobs.filter(
              (j) => new Date(j.started_at).toDateString() === new Date().toDateString(),
            ).length
          }
        </div>
        <div className="eyebrow">JOBS TODAY</div>
      </div>
      <div className="agent-feed">
        <h1>
          Codex <span className="subtle">and Claude Code</span>
        </h1>
        {state.pending?.length > 0 && (
          <div className="permission">
            <strong>Decision needed</strong>
            <PagedItems items={state.pending} pageSize={1}>
              {(p) => (
                <div key={p.id}>
                  <p>{p.summary}</p>
                  {p.detail && <pre title={p.detail}>{p.detail}</pre>}
                  <div className="decision-row">
                    <button onClick={() => call(() => window.hub.decide(p.id, 'deny'))}>
                      Deny
                    </button>
                    <button onClick={() => call(() => window.hub.decide(p.id, 'allow'))}>
                      Allow once
                    </button>
                  </div>
                </div>
              )}
            </PagedItems>
          </div>
        )}
        {state.events.length ? (
          <PagedItems items={state.events} pageSize={2} className="event-feed">
            {(event) => (
              <div className="event" key={event.id}>
                <span className={`event-mark ${event.kind}`} />
                <span>
                  <strong>{event.provider === 'claude' ? 'Claude Code' : 'Codex'}</strong>
                  <small>{event.summary}</small>
                </span>
                <time>
                  {new Date(event.occurred_at).toLocaleTimeString([], {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </time>
              </div>
            )}
          </PagedItems>
        ) : (
          <div className="agent-empty">
            Connect your coding agent to see recent activity and decisions in this space.
            <div>
              <button onClick={() => navigate('settings')}>
                Connect agents <ExternalLink size={15} />
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
