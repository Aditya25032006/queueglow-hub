const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const packageJson = require('../package.json');
const build = require('../scripts/electron-builder.config.cjs');

test('public Windows builds use an installable, update-enabled NSIS setup', () => {
  assert.match(packageJson.version, /^\d+\.\d+\.\d+$/);
  assert.match(packageJson.scripts['release:win'], /electron-builder/);
  assert.equal(build.appId, 'com.kausthub.queueglowhub');
  assert.equal(build.win.target[0].target, 'nsis');
  assert.equal(build.nsis.oneClick, false);
  assert.equal(build.nsis.perMachine, false);
  assert.equal(build.publish[0].provider, 'github');
  assert.equal(build.publish[0].owner, 'KausthubPulipati');
  assert.equal(build.publish[0].repo, 'queueglow-hub');
  assert.equal(build.electronDownload.cache, path.resolve(__dirname, '..', '.cache', 'electron'));
});

test('installer keeps the helper scripts at the resources root used by Electron', () => {
  assert.deepEqual(
    build.extraResources.map(({ from, to }) => ({ from, to })),
    [
      { from: 'electron/agent_hook.ps1', to: 'agent_hook.ps1' },
      { from: 'electron/media_bridge.ps1', to: 'media_bridge.ps1' },
      { from: 'electron/volume.cs', to: 'volume.cs' },
    ],
  );
});
