const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
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
