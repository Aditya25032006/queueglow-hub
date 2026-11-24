import React, { useEffect, useId, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity,
  Bell,
  Bot,
  CircleCheck,
  Command,
  Globe2,
  House,
  LayoutGrid,
  Link2,
  Newspaper,
  PanelTop,
  SlidersHorizontal,
  Sparkles,
  Shirt,
  Timer,
  UserRound,
} from 'lucide-react';
import './settings.css';

const sections = [
  ['home', 'Home', House],
  ['connections', 'Connections', Link2],
  ['ai', 'AI & Chat', Sparkles],
  ['apps', 'Apps', LayoutGrid],
  ['robo', 'Robo', Bot],
  ['wardrobe', 'Wardrobe', Shirt],
  ['account', 'Account', UserRound],
  ['general', 'General', SlidersHorizontal],
  ['notifications', 'Notifications', Bell],
  ['island', 'Island', PanelTop],
  ['focus', 'Focus', Timer],
  ['news', 'News', Newspaper],
];
const appLabels = {
  codex: 'Coding agents',
  robo: 'Robo',
  music: 'Music',
  focus: 'Focus',
  modes: 'Modes',
  tray: 'File tray',
  clips: 'Clips',
  note: 'Notes',
  agenda: 'Agenda',
  mail: 'Mail',
};
const providerNames = { codex: 'Codex', claude: 'Claude Code' };
const bridge = window.queueglowSettings;

function Group({ title, children }) {
  return (
    <section className="group">
      <h2>{title}</h2>
      <div className="group-body">{children}</div>
    </section>
  );
}

function Row({ title, description, children }) {
  return (
    <div className="setting-row">
      <div>
        <strong>{title}</strong>
        {description && <p>{description}</p>}
      </div>
      {children}
    </div>
  );
}

function Toggle({ label, description, value, change, disabled }) {
  const id = useId();
  return (
    <label className="setting-row">
      <span>
        <strong id={id}>{label}</strong>
        {description && (
          <span id={id + '-description'} className="row-description">
            {description}
          </span>
        )}
      </span>
      <input
        className="switch"
        type="checkbox"
        aria-labelledby={id}
        aria-describedby={description ? id + '-description' : undefined}
        checked={value}
        onChange={(event) => change(event.target.checked)}
        disabled={disabled}
      />
    </label>
  );
}

function Select({ label, description, value, change, options, disabled }) {
  const id = useId();
  return (
    <label className="setting-row">
      <span>
        <strong id={id}>{label}</strong>
        {description && (
          <span id={id + '-description'} className="row-description">
            {description}
          </span>
        )}
      </span>
      <select
        aria-labelledby={id}
        aria-describedby={description ? id + '-description' : undefined}
        value={value}
        onChange={(event) => change(event.target.value)}
        disabled={disabled}
      >
        {options.map(([id, name]) => (
          <option key={id} value={id}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}

function Home({ activity, connections, navigate }) {
  const linked = Object.values(connections).filter((value) => value === 'connected').length;
  return (
    <>
      <div className="summary-grid">
        <button onClick={() => navigate('connections')}>
          <Link2 />
          <strong>{linked} of 2</strong>
          <span>Agents connected</span>
        </button>
        <div>
          <Activity />
          <strong>{activity.jobs}</strong>
          <span>Recent sessions</span>
        </div>
        <div>
          <Bell />
          <strong>{activity.decisions}</strong>
          <span>Decisions waiting</span>
        </div>
      </div>
      <Group title="Recent activity">
        {activity.events.length ? (
          activity.events.map((event) => (
            <div className="activity-row" key={event.id}>
              <span className={'activity-mark ' + event.kind} />
              <div>
                <strong>{providerNames[event.provider] || 'Queueglow'}</strong>
                <p>{event.summary}</p>
              </div>
              <time dateTime={event.occurred_at}>
                {new Date(event.occurred_at).toLocaleTimeString([], {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </time>
            </div>
          ))
        ) : (
          <p className="empty">Activity will appear here after an agent sends its first event.</p>
        )}
      </Group>
    </>
  );
}

function Connections({ connections, run }) {
  const statusLabels = {
    connected: 'Hooks installed',
    update: 'Reconnect to update hooks',
    disconnected: 'Disconnected',
    unavailable: 'Provider configuration unavailable',
  };
  return (
    <Group title="Coding agents">
      {Object.entries(providerNames).map(([id, label]) => {
        const status = connections[id];
        return (
          <Row key={id} title={label} description={statusLabels[status]}>
            <div className="actions">
              {status === 'update' && (
                <button onClick={() => run(() => bridge.hook(id, 'remove'))}>Disconnect</button>
              )}
              <button
                className={status === 'connected' ? '' : 'accent'}
                disabled={status === 'unavailable'}
                onClick={() =>
                  run(() => bridge.hook(id, status === 'connected' ? 'remove' : 'connect'))
                }
              >
                {status === 'connected'
                  ? 'Disconnect'
                  : status === 'update'
                    ? 'Reconnect'
                    : 'Connect'}
              </button>
            </div>
          </Row>
        );
      })}
      <p className="helper">
        Start a new agent session after connecting. Codex may prompt you to trust the installed
        hooks.
      </p>
    </Group>
  );
}

function AiSettings({ data, run }) {
  const available = data.robo;
  const connected = available.openai;
  return (
    <>
      <Group title="Choose a provider">
        <Select
          label="Robo answers with"
          value={data.settings.roboProvider}
          change={(value) => run(() => bridge.set('roboProvider', value))}
          options={[
            ['auto', 'Automatic'],
            ['codex', 'Codex CLI'],
            ['claude', 'Claude Code CLI'],
            ['openai', 'OpenAI API key'],
          ]}
        />
        <Row
          title="Codex CLI"
          description={
            available.codex
              ? 'Installed locally. Uses your existing Codex sign-in.'
              : 'CLI not found on this PC.'
          }
        >
          <span className={available.codex ? 'status connected' : 'status'}>
            {available.codex ? 'Installed' : 'Unavailable'}
          </span>
        </Row>
        <Row
          title="Claude Code CLI"
          description={
            available.claude
              ? 'Installed locally. Text questions use your existing Claude Code sign-in.'
              : 'CLI not found on this PC.'
          }
        >
          <span className={available.claude ? 'status connected' : 'status'}>
            {available.claude ? 'Installed' : 'Unavailable'}
          </span>
        </Row>
        <p className="helper">
          Current provider:{' '}
          {available.provider
            ? providerNames[available.provider] || 'OpenAI API'
            : 'none available'}
          . Robo asks only when you submit a question. Screen attachments are available with Codex
          or OpenAI.
        </p>
      </Group>
      <Group title="Optional OpenAI key">
        <Row
          title="OpenAI"
          description="Optional fallback using the Responses API with GPT‑4.1 mini."
        >
          <span className={connected ? 'status connected' : 'status'}>
            {connected && <CircleCheck size={14} />}
            {connected ? 'Key saved' : 'Key needed'}
          </span>
        </Row>
        <form
          className="entry-form"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const key = new FormData(form).get('api-key');
            run(() => bridge.roboKey(key)).then((saved) => {
              if (saved) form.reset();
            });
          }}
        >
          <label>
            OpenAI API key
            <input
              name="api-key"
              required
              type="password"
              maxLength={300}
              autoComplete="off"
              placeholder="Enter API key"
            />
          </label>
          <button className="accent" type="submit">
            {connected ? 'Replace key' : 'Save key'}
          </button>
          {connected && (
            <button type="button" onClick={() => run(bridge.roboDisconnect)}>
              Remove key
            </button>
          )}
        </form>
        <p className="helper">
          Windows encrypts the saved key on this PC. Robo sends your prompt and any screen
          attachment you select to OpenAI.
        </p>
      </Group>
    </>
  );
}

function Shortcut({ index, shortcut, run }) {
  return (
    <form
      className="entry-form shortcut-form"
      onSubmit={(event) => {
        event.preventDefault();
        const fields = new FormData(event.currentTarget);
        run(() => bridge.shortcut(index, { label: fields.get('label'), url: fields.get('url') }));
      }}
    >
      <label>
        Shortcut {index + 1}
        <input
          name="label"
          required
          maxLength={32}
          defaultValue={shortcut?.label}
          placeholder="Label"
        />
      </label>
      <label>
        Web address
        <input
          name="url"
          required
          type="url"
          maxLength={2048}
          defaultValue={shortcut?.url}
          placeholder="https://example.com"
        />
      </label>
      <button className="accent" type="submit">
        Save
      </button>
      {shortcut && (
        <button type="button" onClick={() => run(() => bridge.shortcut(index, null))}>
          Remove
        </button>
      )}
    </form>
  );
}

function Apps({ data, run }) {
  return (
    <>
      <Group title="Custom shortcuts">
        <p className="helper">
          <Globe2 size={15} /> Add up to four HTTPS shortcuts to the island’s apps list.
        </p>
        {data.settings.customShortcuts.map((shortcut, index) => (
          <Shortcut
            key={index + ':' + (shortcut?.label || '') + ':' + (shortcut?.url || '')}
            index={index}
            shortcut={shortcut}
            run={run}
          />
        ))}
      </Group>
      <Group title="Built-in apps">
        <div className="app-switches">
          {data.apps
            .filter((app) => app.id !== 'home')
            .map((app) => (
              <Toggle
                key={app.id}
                label={appLabels[app.id]}
                value={app.visible}
                change={(visible) => run(() => bridge.appVisible(app.id, visible))}
              />
            ))}
        </div>
      </Group>
    </>
  );
}

function Preferences({ section, data, run }) {
  const settings = data.settings;
  const toggle = (key, label, description, disabled) => (
    <Toggle
      label={label}
      description={description}
      value={settings[key]}
      disabled={disabled}
      change={(value) => run(() => bridge.set(key, value))}
    />
  );
  const select = (key, label, options, description, disabled) => (
    <Select
      label={label}
      description={description}
      value={settings[key]}
      options={options}
      disabled={disabled}
      change={(value) => run(() => bridge.set(key, value))}
    />
  );
  if (section === 'robo')
    return (
      <>
        <Group title="Appearance">
          {select('roboAppearance', 'Accent color', [
            ['cyan', 'Cyan'],
            ['violet', 'Violet'],
            ['mint', 'Mint'],
          ])}
        </Group>
        <Group title="Screen context">
          {toggle(
            'roboScreenCapture',
            'Allow screen attachments',
            'You choose a screen or window before sending an attachment with a prompt.',
          )}
        </Group>
      </>
    );
  if (section === 'general')
    return (
      <>
        <Group title="Windows">
          <Toggle
            label="Launch at sign-in"
            value={data.launchOnLogin}
            disabled={!data.canLaunchOnLogin}
            description={
              data.canLaunchOnLogin
                ? 'Open Queueglow when you sign in to Windows.'
                : 'Available in the packaged Windows app.'
            }
            change={(value) => run(() => bridge.login(value))}
          />
          {toggle('sound', 'Sounds', 'Play a sound with Queueglow’s Windows notifications.')}
          {toggle(
            'reduceMotion',
            'Reduce animations',
            'Open and fold the island without transition effects.',
          )}
        </Group>
        <Group title="Clipboard">
          {toggle(
            'clipboardEnabled',
            'Keep clipboard history',
            'Save copied text and links locally in Clips.',
          )}
        </Group>
      </>
    );
  if (section === 'wardrobe')
    return (
      <>
        <Group title="Island look">
          {select('islandSkin', 'Island skin', [
            ['obsidian', 'Obsidian'],
            ['slate', 'Slate'],
            ['violet', 'Violet'],
          ])}
          {select('roboAppearance', 'Robo eyes', [
            ['cyan', 'Cyan'],
            ['violet', 'Violet'],
            ['mint', 'Mint'],
          ])}
        </Group>
        <p className="empty">More looks can be added as Queueglow grows.</p>
      </>
    );
  if (section === 'account')
    return (
      <Group title="Local profile">
        <Row
          title="Queueglow Hub"
          description="Independent desktop companion, version 0.1.0 preview."
        />
        <Row
          title="Sign-in"
          description="This preview stores preferences on this PC and does not require an account."
        />
        <Row title="License" description="MIT open-source license." />
      </Group>
    );
  if (section === 'news')
    return (
      <Group title="Preview updates">
        <Row
          title="Queueglow Hub 0.1.0"
          description="Compact island, Wi-Fi and Bluetooth controls, media playback, coding-agent activity, and a separate Settings window."
        />
        <Row
          title="Privacy defaults"
          description="Clipboard history and online lyrics are off until enabled. Agent questions are sent only when submitted."
        />
      </Group>
    );
  if (section === 'notifications') {
    const disabled = !data.notificationsAvailable;
    const muted = disabled || !settings.notifications;
    return (
      <>
        <Group title="Windows banners">
          {toggle(
            'notifications',
            'Show notifications',
            disabled
              ? 'Windows notifications are unavailable.'
              : 'Send agent alerts to Windows notifications.',
            disabled,
          )}
          {select(
            'notificationPresentation',
            'Banner detail',
            [
              ['summary', 'Show event summaries'],
              ['private', 'Show title only'],
            ],
            null,
            muted,
          )}
        </Group>
        <Group title="Agent events">
          {toggle(
            'notifyApprovals',
            'Approval requests',
            'Alert when a decision is available in Queueglow.',
            muted,
          )}
          {toggle('notifyCompletion', 'Turn finished', null, muted)}
          {toggle('notifyErrors', 'Agent errors', null, muted)}
        </Group>
      </>
    );
  }
  if (section === 'island')
    return (
      <>
        <Group title="Appearance">
          {select('islandSize', 'Size', [
            ['compact', 'Compact'],
            ['standard', 'Standard'],
            ['large', 'Large'],
          ])}
          {select('islandSkin', 'Skin', [
            ['obsidian', 'Obsidian'],
            ['slate', 'Slate'],
            ['violet', 'Violet'],
          ])}
          {select('restingIndicator', 'When folded', [
            ['eyes', 'Eyes'],
            ['dot', 'Dot'],
            ['none', 'No indicator'],
          ])}
        </Group>
        <Group title="Behavior">
          {select('islandExpansion', 'Open the island', [
            ['hover', 'Move pointer over it'],
            ['click', 'Click it'],
          ])}
          {toggle(
            'lyricsEnabled',
            'Synced lyrics',
            'Queueglow sends the current track title and artist to LRCLIB to find synced lyrics.',
          )}
        </Group>
      </>
    );
  return (
    <Group title="Focus guard">
      {toggle(
        'focusGuard',
        'Quiet agent notifications during focus',
        'Pause completion and error banners while a focus timer runs. Approval requests can still appear.',
      )}
      <Row
        title="Website and app blocking"
        description="Blocking is unavailable in this version."
      />
    </Group>
  );
}

const descriptions = {
  home: 'Check recent agent activity and open decisions.',
  connections: 'Connect the coding agents you use on this PC.',
  ai: 'Manage the account Robo uses to answer questions.',
  apps: 'Choose which apps and shortcuts are visible on the island.',
  robo: 'Adjust how Robo looks and handles screen context.',
  wardrobe: 'Personalize the island colors and Robo eyes.',
  account: 'See how this local preview stores its settings.',
  general: 'Set Queueglow’s Windows, animation, and clipboard preferences.',
  notifications: 'Choose which agent events can show a Windows banner.',
  island: 'Adjust the island’s appearance and behavior.',
  focus: 'Manage interruptions while a focus timer is running.',
  news: 'Read what is included in this Queueglow preview.',
};

function SettingsApp() {
  const heading = useRef(null);
  const [section, setSection] = useState(() => {
    const requested = new URLSearchParams(window.location.search).get('section');
    return sections.some(([id]) => id === requested) ? requested : 'home';
  });
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const activeMutation = useRef(false);
  const title = sections.find(([id]) => id === section)[1];

  function navigate(next) {
    setSection(next);
    setError('');
    requestAnimationFrame(() => heading.current?.focus());
  }

  async function run(action) {
    if (activeMutation.current) return false;
    activeMutation.current = true;
    setBusy(true);
    setError('');
    try {
      setData(await action());
      return true;
    } catch (failure) {
      setError(
        String(failure.message || failure)
          .split('Error: ')
          .at(-1),
      );
      return false;
    } finally {
      activeMutation.current = false;
      setBusy(false);
    }
  }

  useEffect(() => {
    const refresh = () => {
      if (!activeMutation.current) run(bridge.state);
    };
    const stopNavigation = bridge.onNavigate((next) => {
      navigate(next);
      refresh();
    });
    const stopActivity = bridge.onActivity((activity) =>
      setData((current) => (current ? { ...current, activity } : current)),
    );
    window.addEventListener('focus', refresh);
    refresh();
    return () => {
      stopNavigation();
      stopActivity();
      window.removeEventListener('focus', refresh);
    };
  }, []);

  let content;
  if (data) {
    if (section === 'home') content = <Home {...data} navigate={navigate} />;
    else if (section === 'connections')
      content = <Connections connections={data.connections} run={run} />;
    else if (section === 'ai') content = <AiSettings data={data} run={run} />;
    else if (section === 'apps') content = <Apps data={data} run={run} />;
    else content = <Preferences section={section} data={data} run={run} />;
  }

  return (
    <div className="settings-shell">
      <aside className="sidebar">
        <div className="brand">
          <span>
            <Command size={19} />
          </span>
          <div>
            <strong>Queueglow</strong>
            <small>Settings</small>
          </div>
        </div>
        <nav aria-label="Settings">
          {sections.map(([id, label, Icon]) => (
            <button
              key={id}
              aria-current={id === section ? 'page' : undefined}
              onClick={() => navigate(id)}
            >
              <Icon size={17} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </aside>
      <main>
        <div className="content" key={section}>
          <header>
            <h1 ref={heading} tabIndex={-1}>
              {title}
            </h1>
            <p>{descriptions[section]}</p>
          </header>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {data ? (
            <fieldset disabled={busy} aria-busy={busy}>
              {content}
            </fieldset>
          ) : (
            !error && (
              <p className="empty" role="status">
                Loading settings…
              </p>
            )
          )}
        </div>
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<SettingsApp />);
