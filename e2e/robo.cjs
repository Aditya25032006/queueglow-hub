const { _electron: electron } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { mainPage, hoverNotch, moveSystemCursor } = require('./window.cjs');

(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'queueglow-robo-e2e-'));
  moveSystemCursor(20, 400);
  const app = await electron.launch({
    args: ['.'],
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, QUEUEGLOW_HOME: root },
  });
  try {
    await app.firstWindow();
    const island = await mainPage(app);
    await hoverNotch(app);
    await island.waitForSelector('.shell.motion-idle');
    const provider = await island.evaluate(
      async () => (await window.hub.state()).roboCapabilities.provider,
    );
    assert.equal(provider, 'codex', 'This fixture expects the local Codex CLI');
    await island.getByRole('button', { name: 'Robo', exact: true }).click();
    await island.getByRole('textbox', { name: 'Ask Robo' }).fill('Reply with READY only.');
    await island.getByRole('button', { name: 'Send question' }).click();
    await island.getByText('READY', { exact: true }).waitFor({ timeout: 60000 });
    console.log('Robo E2E passed: local Codex CLI answered without an API key');
  } finally {
    await app.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
