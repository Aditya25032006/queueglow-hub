const { _electron: electron } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { mainPage, hoverNotch, moveSystemCursor } = require('./window.cjs');

async function waitForBounds(app, width, height) {
  for (let i = 0; i < 65; i++) {
    const b = await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].getBounds(),
    );
    if (b.width === width && b.height === height) return b;
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw new Error(`Timed out waiting for ${width}×${height} window`);
}

(async () => {
  const project = path.resolve(__dirname, '..');
  const root = path.resolve(project, '..', '..', 'work', 'hub-e2e-data');
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
    const pageErrors = [];
    win.on('pageerror', (error) => pageErrors.push(error.message));
    await win.waitForFunction(() =>
      document.querySelector('.shell')?.classList.contains('motion-folded'),
    );
    const foldedBounds = await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].getBounds(),
    );
    assert.equal(foldedBounds.width, 660);
    assert.equal(foldedBounds.height, 300);
    assert.equal(
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length),
      1,
      'folded eyes should use one renderer window',
    );
    assert.equal(
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isAlwaysOnTop()),
      true,
    );
    await app.evaluate(({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows()[0];
      w.queueglowResizeEvents = 0;
      w.on('resize', () => w.queueglowResizeEvents++);
    });
    await hoverNotch(app);
    await win.waitForSelector('.shell.motion-expanding');
    assert.equal(
      await win.locator('.shell').evaluate((el) => getComputedStyle(el, '::before').animationName),
      'island-grow',
    );
    await win.waitForSelector('.shell.motion-idle');
    const expandedBounds = await waitForBounds(app, 660, 300);
    moveSystemCursor(expandedBounds.x + 100, expandedBounds.y + 100);
    assert.equal(expandedBounds.width, 660);
    assert.equal(expandedBounds.height, 300);
    assert.equal(
      await app.evaluate(
        ({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].queueglowResizeEvents,
      ),
      0,
      'opening should not resize the native window',
    );
    assert.equal(await win.locator('.home-cards button').count(), 3);
    const eye = await win
      .locator('.island-notch .eyes span')
      .first()
      .evaluate((el) => ({
        height: el.getBoundingClientRect().height,
        opacity: getComputedStyle(el).opacity,
        background: getComputedStyle(el).backgroundColor,
      }));
    assert.ok(
      eye.height > 4 && eye.opacity !== '0' && eye.background === 'rgb(255, 255, 255)',
      `Expanded eyes should be visible: ${JSON.stringify(eye)}`,
    );
    await win.getByRole('button', { name: 'Wi-Fi and Bluetooth' }).click();
    await win.getByRole('group', { name: 'Wi-Fi and Bluetooth controls' }).waitFor();
    await win.getByRole('button', { name: 'Wi-Fi networks' }).waitFor();
    await win.getByRole('button', { name: 'Bluetooth devices' }).waitFor();
    let connection;
    for (let attempt = 0; attempt < 30; attempt++) {
      connection = await win.evaluate(() => window.hub.state());
      if (connection?.system?.wifiSsid) break;
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
    assert.ok(
      connection?.system?.wifiSsid,
      `Wi-Fi name should load: ${JSON.stringify(connection?.system)}`,
    );
    for (const [radio, label] of [
      ['wifi', 'Wi-Fi'],
      ['bluetooth', 'Bluetooth'],
    ]) {
      const enabled = connection.system[`${radio}Enabled`];
      assert.equal(typeof enabled, 'boolean', `${label} state should load`);
      const toggle = win.getByRole('button', { name: `Turn ${label} ${enabled ? 'off' : 'on'}` });
      await toggle.waitFor();
      assert.equal(await toggle.isEnabled(), true, `${label} toggle should be available`);
      await toggle.hover();
      await win.getByRole('group', { name: 'Wi-Fi and Bluetooth controls' }).waitFor();
    }
    const connectivityLayout = await win.evaluate(() => {
      const panel = document.querySelector('.connectivity-popover').getBoundingClientRect();
      const shell = document.querySelector('.shell').getBoundingClientRect();
      const dock = document.querySelector('.dock').getBoundingClientRect();
      return {
        panel: { right: panel.right, bottom: panel.bottom },
        shell: { right: shell.right },
        dock: { top: dock.top },
      };
    });
    assert.ok(
      connectivityLayout.panel.right <= connectivityLayout.shell.right &&
        connectivityLayout.panel.bottom <= connectivityLayout.dock.top,
      `Connectivity panel must stay inside island content: ${JSON.stringify(connectivityLayout)}`,
    );
    await win.screenshot({ path: path.join(project, 'screenshot-connectivity.png') });
    await win.getByRole('button', { name: 'Wi-Fi networks' }).hover();
    await win.getByRole('group', { name: 'Wi-Fi and Bluetooth controls' }).waitFor();
    await win.getByRole('button', { name: 'Home', exact: true }).hover();
    await win
      .getByRole('group', { name: 'Wi-Fi and Bluetooth controls' })
      .waitFor({ state: 'hidden' });
    await win.getByRole('button', { name: 'Wi-Fi and Bluetooth' }).focus();
    await win.getByRole('button', { name: 'Wi-Fi and Bluetooth' }).press('Enter');
    await win.getByRole('group', { name: 'Wi-Fi and Bluetooth controls' }).waitFor();
    await win.getByRole('button', { name: 'Wi-Fi and Bluetooth' }).press('Escape');
    await win
      .getByRole('group', { name: 'Wi-Fi and Bluetooth controls' })
      .waitFor({ state: 'hidden' });
    await win.screenshot({ path: path.join(project, 'screenshot-home.png') });
    const layout = await win.evaluate(() =>
      Object.fromEntries(
        ['.shell', '.content', '.home-page', '.hero-clock', '.home-cards', '.dock'].map(
          (selector) => {
            const r = document.querySelector(selector).getBoundingClientRect();
            return [selector, { top: r.top, bottom: r.bottom, height: r.height }];
          },
        ),
      ),
    );
    assert.ok(
      layout['.home-cards'].bottom <= layout['.dock'].top,
      `Home cards must fit above dock: ${JSON.stringify(layout)}`,
    );
    await win.getByRole('button', { name: 'Music', exact: true }).click();
    await win.screenshot({ path: path.join(project, 'screenshot-music.png') });
    await win.getByRole('button', { name: 'Codex', exact: true }).click();
    await win.waitForSelector('.agent-page');
    await win.screenshot({ path: path.join(project, 'screenshot-codex.png') });
    await win.getByRole('button', { name: 'Focus', exact: true }).click();
    await win.getByRole('button', { name: /Start focus/ }).click();
    await win.getByRole('button', { name: /End focus/ }).waitFor();
    await win.getByRole('button', { name: /End focus/ }).click();
    await win.getByRole('button', { name: 'Clips', exact: true }).click();
    await win.getByRole('checkbox', { name: 'Capture text' }).check();
    await win.getByRole('button', { name: 'Note', exact: true }).click();
    await win.getByRole('textbox', { name: 'Your note' }).fill('[ ] Smoke test note');
    await win.getByRole('button', { name: 'Check Smoke test note' }).click();
    await win.waitForFunction(
      async () => (await window.hub.state()).note === '[x] Smoke test note',
    );
    await win.getByRole('button', { name: 'Agenda', exact: true }).click();
    await win.getByRole('button', { name: 'Month', exact: true }).click();
    await win.locator('.month-grid button').first().waitFor();
    await win.getByRole('button', { name: 'Robo', exact: true }).click();
    await win.screenshot({ path: path.join(project, 'screenshot-robo.png') });
    assert.equal(
      await win.locator('.robo-page').evaluate((el) => el.scrollHeight <= el.clientHeight),
      true,
      'Robo panel should fit without outer scrolling',
    );
    if (await win.getByRole('combobox', { name: 'Image to include' }).count())
      await win.getByRole('combobox', { name: 'Image to include' }).selectOption('screen');
    await win.getByRole('button', { name: 'Modes', exact: true }).click();
    await win.getByRole('button', { name: /Sleep/ }).waitFor();
    await win.getByRole('button', { name: /Game/ }).waitFor();
    await win.getByLabel('Site blocking').check();
    await win.waitForFunction(
      async () => (await window.hub.state()).modes.find((mode) => mode.id === 'work').block_sites,
    );
    await win.getByLabel('Site blocking').uncheck();
    await win.getByRole('button', { name: 'More options' }).click();
    await win.getByRole('group', { name: 'App menu' }).waitFor();
    await win.getByRole('button', { name: 'Updates' }).waitFor();
    const menuFits = await win.evaluate(
      () =>
        document.querySelector('.menu').getBoundingClientRect().bottom <=
        document.querySelector('.dock').getBoundingClientRect().top,
    );
    assert.ok(menuFits, 'App menu should fit above dock');
    await win.screenshot({ path: path.join(project, 'screenshot-menu.png') });
    await win.getByRole('button', { name: 'Fold in' }).click();
    await win.waitForFunction(() =>
      document.querySelector('.shell')?.classList.contains('motion-folded'),
    );

    assert.equal(
      await app.evaluate(
        ({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].queueglowResizeEvents,
      ),
      0,
      'folding should not resize the native window',
    );
    await hoverNotch(app);
    await win.waitForSelector('.shell.motion-expanding');
    await win.waitForSelector('.shell.motion-idle');
    await waitForBounds(app, 660, 300);
    await win.getByRole('button', { name: 'Quick controls', exact: true }).click();
    await win.locator('#system-volume').waitFor();
    await win.locator('#system-volume').waitFor({ state: 'visible' });
    await win.waitForFunction(() => !document.querySelector('#system-volume').disabled, {
      timeout: 10000,
    });
    await win.locator('#system-brightness').waitFor();
    await win.waitForFunction(
      async () =>
        (await window.hub.state()).system?.batteryPercent !== null &&
        (await window.hub.state()).system?.brightnessPercent !== null,
      null,
      { timeout: 12000 },
    );
    const hardware = await win.evaluate(async () => {
      const current = (await window.hub.state()).system;
      return window.hub.brightnessSet(current.brightnessPercent);
    });
    assert.equal(typeof hardware.system.brightnessPercent, 'number');
    const volume = await win.evaluate(async () => {
      const current = (await window.hub.state()).volume;
      return window.hub.volumeSet(current);
    });
    assert.equal(typeof volume.volume, 'number');
    await win.screenshot({ path: path.join(project, 'screenshot-controls.png') });
    await win.locator('.shell').dispatchEvent('mouseout', { relatedTarget: null });
    await win.waitForFunction(
      () => document.querySelector('.shell')?.classList.contains('motion-folded'),
      null,
      { timeout: 5000 },
    );
    await win.waitForFunction(
      () => getComputedStyle(document.querySelector('.shell')).clipPath.startsWith('inset('),
      null,
      { timeout: 1500, polling: 50 },
    );
    assert.match(
      await win.locator('.shell').evaluate((el) => getComputedStyle(el).clipPath),
      /inset\(/,
      'folded island should be clipped to the notch',
    );
    const foldedEye = await win
      .locator('.island-notch .eyes span')
      .first()
      .evaluate((el) => ({
        rect: el.getBoundingClientRect().toJSON(),
        opacity: getComputedStyle(el).opacity,
        display: getComputedStyle(el).display,
      }));
    assert.ok(
      foldedEye.rect.width > 0 && foldedEye.opacity !== '0' && foldedEye.display !== 'none',
      `Folded eyes should render: ${JSON.stringify(foldedEye)}`,
    );
    assert.equal(
      await win.locator('.volume-panel, .menu, .connectivity-popover').count(),
      0,
      'folded island must close all popovers',
    );
    await win.screenshot({ path: path.join(project, 'screenshot-folded-surface.png') });

    assert.equal(
      await app.evaluate(
        ({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].queueglowResizeEvents,
      ),
      0,
      'repeated transition should not resize the native window',
    );
    assert.deepEqual(pageErrors, [], 'No renderer errors');
    const memory = await app.evaluate(({ app }) =>
      app.getAppMetrics().map((item) => ({
        type: item.type,
        workingSetKB: item.memory.workingSetSize,
        privateKB: item.memory.privateBytes,
      })),
    );
    console.log('Electron process memory', memory);
    console.log(
      'E2E passed: compact 660×300 island, growing surface, fitted Home cards, zero native resizes, core flows',
    );
  } finally {
    await app.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
