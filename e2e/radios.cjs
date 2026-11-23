const { _electron: electron } = require('@playwright/test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { mainPage, hoverNotch, moveSystemCursor } = require('./window.cjs');

(async () => {
  const project = path.resolve(__dirname, '..');
  const root = path.resolve(project, '..', '..', 'work', 'hub-e2e-radios');
  fs.mkdirSync(root, { recursive: true });
  moveSystemCursor(20, 400);
  const app = await electron.launch({
    executablePath: process.env.QUEUEGLOW_EXE,
    args: process.env.QUEUEGLOW_EXE ? [] : ['.'],
    cwd: project,
    env: { ...process.env, QUEUEGLOW_HOME: root },
  });
  let original;
  let win;
  try {
    await app.firstWindow();
    win = await mainPage(app);
    await hoverNotch(app);
    await win.waitForSelector('.shell.motion-idle');
    let state;
    for (let attempt = 0; attempt < 30; attempt++) {
      state = await win.evaluate(() => window.hub.state());
      if (state.system?.bluetoothEnabled != null) break;
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
    assert.ok(
      state.system?.bluetoothEnabled != null,
      `Radio state did not load: ${JSON.stringify(state.system)}`,
    );
    original = state.system.bluetoothEnabled;
    console.log('Initial radios', { wifi: state.system.wifiEnabled, bluetooth: original });
    for (const target of ['wifi', 'bluetooth']) {
      const enabled = state.system[`${target}Enabled`];
      const result = await win.evaluate(
        ([name, value]) => window.hub.radioSet(name, value),
        [target, enabled],
      );
      console.log(`${target} no-change result`, result.system[`${target}Enabled`]);
      assert.equal(result.system[`${target}Enabled`], enabled);
    }
    if (process.env.QUEUEGLOW_TEST_RADIO_TOGGLE === '1') {
      await win.getByRole('button', { name: 'Wi-Fi and Bluetooth' }).click();
      await win.getByRole('button', { name: `Turn Bluetooth ${original ? 'off' : 'on'}` }).click();
      await win
        .getByRole('button', { name: `Turn Bluetooth ${original ? 'on' : 'off'}` })
        .waitFor({ timeout: 8000 });
      console.log('Bluetooth tile changed state');
      await win.getByRole('button', { name: `Turn Bluetooth ${original ? 'on' : 'off'}` }).click();
      await win
        .getByRole('button', { name: `Turn Bluetooth ${original ? 'off' : 'on'}` })
        .waitFor({ timeout: 8000 });
      console.log('Bluetooth tile restored state');
    }
  } finally {
    if (original !== undefined && win && process.env.QUEUEGLOW_TEST_RADIO_TOGGLE === '1') {
      try {
        const restored = await win.evaluate(
          (value) => window.hub.radioSet('bluetooth', value),
          original,
        );
        console.log('Bluetooth restored', restored.system.bluetoothEnabled);
      } catch (error) {
        console.error('Bluetooth restoration failed:', error);
      }
    }
    await app.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
