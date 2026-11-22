const { _electron: electron } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { mainPage, hoverNotch, moveSystemCursor } = require('./window.cjs');

(async () => {
  const project = path.resolve(__dirname, '..');
  const root = path.resolve(project, '..', '..', 'work', 'hub-e2e-music');
  fs.mkdirSync(root, { recursive: true });
  const packaged = process.env.QUEUEGLOW_PACKAGE_EXE;
  moveSystemCursor(20, 400);
  const app = await electron.launch({
    executablePath: packaged || undefined,
    args: packaged ? [] : ['.'],
    cwd: project,
    env: { ...process.env, QUEUEGLOW_HOME: root },
  });
  try {
    await app.firstWindow();

    const win = await mainPage(app);
    await win.screenshot({ path: path.join(project, 'screenshot-folded.png') });
    await hoverNotch(app);
    await win.waitForSelector('.shell.motion-idle');
    await win.waitForFunction(
      async () => Boolean((await window.hub.state()).systemMedia?.artwork),
      null,
      { timeout: 12000 },
    );
    await win.getByRole('button', { name: 'Music', exact: true }).click();
    await win.locator('.album-art').waitFor();
    assert.equal(
      await win.locator('.music-page').evaluate((el) => el.scrollHeight <= el.clientHeight),
      true,
      'Music panel should fit without outer scrolling',
    );
    const source = await win.locator('.album-art').getAttribute('src');
    assert.match(source, /^data:image\/(png|jpeg|gif);base64,/);
    await win.screenshot({ path: path.join(project, 'screenshot-music.png') });
    console.log('Music E2E passed: current Windows track artwork rendered');
  } finally {
    await app.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
