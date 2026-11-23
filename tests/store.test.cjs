const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { HubStore } = require('../electron/store.cjs');

function withStore(fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'queueglow-store-'));
  const store = new HubStore(root);
  try {
    fn(store);
  } finally {
    store.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
}
test('local flows persist safely and reject invalid input', () =>
  withStore((store) => {
    assert.equal(store.state().apps.length, 11);
    assert.equal(store.state().settings.clipboardEnabled, false);
    store.setSetting('clipboardEnabled', true);
    assert.equal(store.setting('clipboardEnabled'), true);
    assert.throws(() => store.setSetting('unknown', true));
    store.addClip('https://example.com');
    store.addClip('https://example.com');
    assert.equal(store.state().clips.length, 1);
    assert.equal(store.clipContent(store.state().clips[0].id), 'https://example.com');
    store.clearClips();
    assert.equal(store.state().clips.length, 0);
    store.saveNote('Remember this');
    assert.equal(store.state().note, 'Remember this');
    store.addAgendaEvent('Meeting', '2026-11-22T09:00:00Z', '2026-11-22T10:00:00Z');
    assert.equal(store.state().agenda[0].title, 'Meeting');
    assert.throws(() =>
      store.addAgendaEvent('Bad', '2026-11-22T10:00:00Z', '2026-11-22T09:00:00Z'),
    );
    store.startFocus('work', 1500);
    assert.equal(store.state().focus.planned_seconds, 1500);
    store.stopFocus();
    assert.equal(store.state().focus, null);
    store.setAppVisible('music', false);
    assert.equal(store.state().apps.find((a) => a.id === 'music').visible, false);
    assert.throws(() => store.setAppVisible('home', false));
    const id = store.addTrayFile('test.txt', Buffer.from('hello'));
    assert.equal(fs.readFileSync(store.trayPath(id), 'utf8'), 'hello');
    store.removeTrayFile(id);
    assert.equal(store.state().tray.length, 0);
  }));
test('notes preserve intentional whitespace and reject excess text without replacing the note', () =>
  withStore((store) => {
    const body = ' \n ' + 'a'.repeat(29994) + ' \r\n';
    assert.equal(body.length, 30000);
    assert.equal(store.saveNote(body), body);
    assert.throws(() => store.saveNote(body + 'a'), /up to 30,000/);
    assert.equal(store.state().note, body);
    assert.equal(store.saveNote(' \t '), ' \t ');
    assert.equal(store.state().note, ' \t ');
    assert.equal(store.saveNote(''), '');
  }));

test('agent event history is idempotent and omits sensitive detail', () =>
  withStore((store) => {
    const event = {
      id: 'event-1',
      provider: 'codex',
      session_id: 'codex:demo',
      kind: 'permission',
      summary: 'Run a command',
      detail: 'secret argument',
      happened_at: '2026-11-22T00:00:00Z',
    };
    store.addAgentEvent(event);
    store.addAgentEvent(event);
    assert.equal(store.state().events.length, 1);
    assert.equal(store.state().jobs[0].state, 'attention');
    assert.equal(JSON.stringify(store.state()).includes('secret argument'), false);
  }));

test('legacy agent history gains bounded final-response details', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'queueglow-store-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const original = new DatabaseSync(path.join(root, 'hub.db'));
  const schema = fs.readFileSync(path.join(__dirname, '..', 'electron', 'schema.sql'), 'utf8');
  original.exec(schema.replace(", detail TEXT NOT NULL DEFAULT ''", ''));
  original.exec(
    "INSERT INTO agent_jobs VALUES('codex:demo','codex','','done','2026-11-22T00:00:00Z','2026-11-22T00:00:00Z');" +
      "INSERT INTO agent_events VALUES('previous','codex:demo','codex','done','Session finished','2026-11-22T00:00:00Z');",
  );
  original.close();

  const store = new HubStore(root);
  try {
    store.addAgentEvent({
      id: 'final',
      provider: 'codex',
      session_id: 'codex:demo',
      kind: 'done',
      summary: 'Final response',
      detail: 'Done with the update. ' + 'a'.repeat(4200),
      happened_at: '2026-11-22T00:00:01Z',
    });
    const [final, previous] = store.state().events;
    assert.match(final.detail, /^Done with the update\./);
    assert.equal(final.detail.length, 4000);
    assert.equal(previous.summary, 'Session finished');
    assert.equal(previous.detail, '');
  } finally {
    store.close();
  }
});

test('settings validate and persist island, notification, and shortcut preferences', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'queueglow-settings-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const store = new HubStore(root);
  try {
    assert.equal(store.setting('lyricsEnabled'), false);
    assert.deepEqual(store.setting('customShortcuts'), [null, null, null, null]);
    store.setSetting('islandSize', 'large');
    store.setSetting('notificationPresentation', 'private');
    store.setSetting('focusGuard', true);
    store.setSetting('lyricsEnabled', true);
    store.setSetting('roboProvider', 'claude');
    assert.throws(() => store.setSetting('roboProvider', 'unknown'), /Invalid setting/);
    assert.deepEqual(store.setShortcut(3, { label: '  Docs  ', url: 'HTTPS://example.com' }), {
      label: 'Docs',
      url: 'https://example.com/',
    });
    assert.throws(() => store.setSetting('islandSize', 'giant'), /Invalid setting/);
    assert.throws(() => store.setSetting('focusGuard', 1), /Invalid setting/);
    assert.throws(() => store.setSetting('customShortcuts', []), /Invalid setting/);
    assert.throws(() => store.setting('constructor'), /Unknown setting/);
    assert.throws(() => store.setShortcut(4, null), /Invalid shortcut slot/);
    assert.throws(() => store.setShortcut(3, { label: '', url: 'https://example.com' }), /label/);
    for (const url of [
      'javascript:alert(1)',
      'http://example.com',
      'https://a:b@example.com',
      'https:///example.com',
    ]) {
      assert.throws(() => store.setShortcut(3, { label: 'Docs', url }), /HTTPS/);
    }
  } finally {
    store.close();
  }

  const reopened = new HubStore(root);
  try {
    assert.equal(reopened.setting('islandSize'), 'large');
    assert.equal(reopened.setting('notificationPresentation'), 'private');
    assert.equal(reopened.setting('focusGuard'), true);
    assert.equal(reopened.setting('lyricsEnabled'), true);
    assert.equal(reopened.setting('roboProvider'), 'claude');
    assert.deepEqual(reopened.setting('customShortcuts')[3], {
      label: 'Docs',
      url: 'https://example.com/',
    });
    reopened.setShortcut(3, null);
    assert.deepEqual(reopened.setting('customShortcuts'), [null, null, null, null]);
  } finally {
    reopened.close();
  }
});
