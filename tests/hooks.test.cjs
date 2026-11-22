const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { plan } = require('../electron/hooks.cjs');
test('hook plan preserves unrelated commands and can remove ours', () => {
  const original = {
    hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'other.exe' }] }] },
    otherSetting: 42,
  };
  const executable = path.join(__dirname, '..', 'electron', 'agent_hook.ps1');
  const installed = plan(original, 'codex', 'connect', executable);
  assert.equal(original.hooks.SessionStart.length, 1);
  assert.equal(installed.hooks.SessionStart.length, 2);
  assert.equal(installed.otherSetting, 42);
  const removed = plan(installed, 'codex', 'remove', executable);
  assert.equal(removed.hooks.SessionStart.length, 1);
  assert.equal(removed.hooks.SessionStart[0].hooks[0].command, 'other.exe');
});
