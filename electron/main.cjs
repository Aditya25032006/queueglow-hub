const {
  app,
  BrowserWindow,
  ipcMain,
  screen,
  clipboard,
  dialog,
  shell,
  Notification,
  safeStorage,
  desktopCapturer,
  powerMonitor,
  Tray,
  Menu,
} = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { HubStore } = require('./store.cjs');
const hooks = require('./hooks.cjs');
const { MediaBridge } = require('./media.cjs');
const { DURATION_MS, IDLE_SECONDS, gaze } = require('./island-motion.cjs');

if (process.env.QUEUEGLOW_SOFTWARE_RENDER === '1') app.disableHardwareAcceleration();

const root =
  process.env.QUEUEGLOW_HOME ||
  path.join(process.env.LOCALAPPDATA || app.getPath('userData'), 'Queueglow');
const ipcRoot = path.join(root, 'ipc');
let store,
  win,
  tray,
  mediaBridge,
  folded = true,
  targetFolded = true,
  motion = 'idle',
  lastClip = '',
  pending = new Map(),
  audio = [];
let hoverArmed = false,
  outsideSince = 0,
  quitting = false;
let motionTimer = null,
  lastPresence = '',
  lastPresenceAt = 0;
let lastCursorPoint = null,
  lastCursorMovementAt = Date.now();
const MAX_EVENT = 64000;
const EXPANDED = { width: 720, height: 330, zoom: 0.6 };
const FOLDED = { width: 108, height: 36 };

function bounds(width, height) {
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const area = display.workArea;
  return { x: Math.round(area.x + (area.width - width) / 2), y: area.y, width, height };
}
function emit(extra = {}) {
  if (win && !win.isDestroyed())
    win.webContents.send('update', {
      ...store.state(),
      pending: [...pending.values()],
      audio,
      systemMedia: mediaBridge?.media || null,
      volume: mediaBridge?.volume ?? null,
      system: mediaBridge?.system || null,
      folded,
      motion,
      ...extra,
    });
}
function emitMotion() {
  if (win && !win.isDestroyed()) win.webContents.send('motion', { folded, motion });
}
function current() {
  return {
    ...store.state(),
    pending: [...pending.values()],
    audio,
    systemMedia: mediaBridge?.media || null,
    volume: mediaBridge?.volume ?? null,
    system: mediaBridge?.system || null,
    folded,
    motion,
  };
}
function resize(fold, snap = false) {
  if (!win || win.isDestroyed()) return null;
  if (!snap && targetFolded === fold)
    return {
      folded: fold,
      width: fold ? FOLDED.width : EXPANDED.width,
      height: fold ? FOLDED.height : EXPANDED.height,
    };
  if (motionTimer) {
    clearTimeout(motionTimer);
    motionTimer = null;
  }
  targetFolded = fold;
  const size = fold ? FOLDED : EXPANDED;
  const reduced = store?.setting('reduceMotion');
  motion = snap || reduced ? 'idle' : fold ? 'folding' : 'expanding';
  if (!fold) folded = false;
  if (fold) {
    hoverArmed = false;
    outsideSince = 0;
  } else {
    hoverArmed = pointerInside();
    outsideSince = 0;
  }
  if (motion === 'idle') {
    folded = fold;
    win.setIgnoreMouseEvents(fold, fold ? { forward: true } : undefined);
    emitMotion();
  } else {
    if (!fold) {
      win.setIgnoreMouseEvents(false);
    }
    emitMotion();
    motionTimer = setTimeout(() => {
      motionTimer = null;
      if (!win || win.isDestroyed()) return;
      if (fold) {
        win.setIgnoreMouseEvents(true, { forward: true });
      }
      folded = fold;
      motion = 'idle';
      emitMotion();
    }, DURATION_MS);
  }
  return { folded: fold, width: size.width, height: size.height };
}
function pointerInsideNotch(point) {
  const rect = win.getBounds();
  return (
    point.x >= rect.x + (rect.width - FOLDED.width) / 2 &&
    point.x < rect.x + (rect.width + FOLDED.width) / 2 &&
    point.y >= rect.y &&
    point.y < rect.y + FOLDED.height
  );
}
function pointerInside() {
  const point = screen.getCursorScreenPoint();
  const rect = win.getBounds();
  return (
    point.x >= rect.x &&
    point.x < rect.x + rect.width &&
    point.y >= rect.y &&
    point.y < rect.y + rect.height
  );
}
function checkPointerExit() {
  if (!win || win.isDestroyed() || motion !== 'idle') return;
  if (targetFolded) {
    if (pointerInsideNotch(screen.getCursorScreenPoint())) resize(false);
    return;
  }
  if (pointerInside()) {
    hoverArmed = true;
    outsideSince = 0;
    return;
  }
  if (!hoverArmed) return;
  if (!outsideSince) outsideSince = Date.now();
  else if (Date.now() - outsideSince > 650) resize(true);
}
function pollPresence() {
  if (!win || win.isDestroyed()) return;
  const point = screen.getCursorScreenPoint();
  if (!lastCursorPoint || point.x !== lastCursorPoint.x || point.y !== lastCursorPoint.y) {
    lastCursorPoint = point;
    lastCursorMovementAt = Date.now();
  }
  const sleeping =
    powerMonitor.getSystemIdleTime() >= IDLE_SECONDS &&
    Date.now() - lastCursorMovementAt >= IDLE_SECONDS * 1000;
  const presence = gaze(point, win.getBounds(), sleeping);
  const key = JSON.stringify(presence);
  if (key !== lastPresence || Date.now() - lastPresenceAt > 500) {
    win.webContents.send('presence', presence);
    lastPresence = key;
    lastPresenceAt = Date.now();
  }
}
function pollEvents() {
  const inbox = path.join(ipcRoot, 'inbox');
  fs.mkdirSync(inbox, { recursive: true });
  fs.mkdirSync(path.join(ipcRoot, 'decisions'), { recursive: true });
  fs.writeFileSync(path.join(ipcRoot, 'heartbeat'), String(Date.now()));
  let changed = false;
  for (const name of fs
    .readdirSync(inbox)
    .filter((n) => /^[a-f0-9-]{36}\.json$/i.test(n))
    .slice(0, 50)) {
    const file = path.join(inbox, name);
    try {
      if (fs.statSync(file).size > MAX_EVENT) continue;
      const event = JSON.parse(fs.readFileSync(file, 'utf8'));
      store.addAgentEvent(event);
      if (event.kind === 'permission' && Number(event.expires_at) > Date.now() / 1000) {
        pending.set(event.id, {
          id: event.id,
          provider: event.provider,
          summary: String(event.summary || '').slice(0, 180),
          detail: String(event.detail || '').slice(0, 4000),
          expires_at: Number(event.expires_at),
        });
        if (Notification.isSupported() && store.setting('notifications'))
          new Notification({
            title: 'Queueglow needs your decision',
            body: event.summary || 'Agent permission request',
          }).show();
      }
      changed = true;
    } catch (error) {
      console.error('Agent event:', error.message);
    } finally {
      fs.rmSync(file, { force: true });
    }
  }
  for (const [id, item] of pending)
    if (item.expires_at <= Date.now() / 1000) {
      pending.delete(id);
      changed = true;
    }
  if (changed) emit();
}
function openWindow() {
  win = new BrowserWindow({
    ...bounds(EXPANDED.width, EXPANDED.height),
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    maximizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      zoomMode: 'isolated',
    },
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.on('close', (event) => {
    if (!quitting) {
      event.preventDefault();
      resize(true);
      win.hide();
    }
  });
  win.webContents.setZoomFactor(EXPANDED.zoom);
  win.setIgnoreMouseEvents(true, { forward: true });
  win.setMenuBarVisibility(false);
  win.webContents.on('did-finish-load', () => {
    lastPresence = '';
    pollPresence();
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  const reposition = () => {
    win.setBounds(bounds(EXPANDED.width, EXPANDED.height));
  };
  screen.on('display-metrics-changed', reposition);
  screen.on('display-removed', reposition);
}
function openTray() {
  const icon = path.join(__dirname, '..', 'assets', 'tray.png');
  tray = new Tray(icon);
  tray.setToolTip('Queueglow Hub');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: 'Open Queueglow',
        click: () => {
          win.show();
          resize(false);
        },
      },
      { label: 'Fold to eyes', click: () => resize(true) },
      { type: 'separator' },
      { label: 'Quit Queueglow', click: () => app.quit() },
    ]),
  );
  tray.on('click', () => {
    win.show();
    resize(false);
  });
}
function register() {
  ipcMain.handle('state', current);
  ipcMain.handle('fold', () => resize(true));
  ipcMain.handle('expand', () => resize(false));
  ipcMain.handle('quit', () => app.quit());
  ipcMain.handle('setting', (_e, key, value) => {
    store.setSetting(key, value);
    if (key === 'clipboardEnabled' && value) lastClip = clipboard.readText();
    emit();
    return true;
  });
  ipcMain.handle('appVisible', (_e, id, value) => {
    store.setAppVisible(id, value);
    emit();
    return true;
  });
  ipcMain.handle('focusStart', (_e, mode, seconds) => {
    store.startFocus(mode, seconds);
    emit();
    return true;
  });
  ipcMain.handle('focusStop', () => {
    store.stopFocus();
    emit();
    return true;
  });
  ipcMain.handle('clipClear', () => {
    store.clearClips();
    emit();
    return true;
  });
  ipcMain.handle('clipCopy', (_e, id) => {
    const content = store.clipContent(id);
    if (!content) throw new Error('Clip was removed');
    clipboard.writeText(content);
    lastClip = content;
    return true;
  });
  ipcMain.handle('trayAdd', async () => {
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile', 'multiSelections'],
    });
    if (result.canceled) return false;
    for (const file of result.filePaths) {
      const stat = fs.statSync(file);
      if (stat.size > 25 * 1024 * 1024) throw new Error('Choose files under 25 MB');
      store.addTrayFile(path.basename(file), fs.readFileSync(file));
    }
    emit();
    return true;
  });
  ipcMain.handle('trayDrop', (_e, name, bytes) => {
    if (
      typeof name !== 'string' ||
      name.length > 180 ||
      !(bytes instanceof Uint8Array) ||
      bytes.length > 25 * 1024 * 1024
    )
      throw new Error('Invalid file');
    store.addTrayFile(name, bytes);
    emit();
    return true;
  });
  ipcMain.handle('trayRemove', (_e, id) => {
    store.removeTrayFile(id);
    emit();
    return true;
  });
  ipcMain.handle('trayOpen', (_e, id) => {
    const file = store.trayPath(id);
    if (file) return shell.showItemInFolder(file);
    throw new Error('File was removed');
  });
  ipcMain.handle('noteSave', (_e, body) => {
    store.saveNote(body);
    emit();
    return true;
  });
  ipcMain.handle('agendaAdd', (_e, title, start, end) => {
    store.addAgendaEvent(title, start, end);
    emit();
    return true;
  });
  ipcMain.handle('agendaRemove', (_e, id) => {
    store.removeAgendaEvent(id);
    emit();
    return true;
  });
  ipcMain.handle('musicOpen', async () => {
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'm4a', 'ogg', 'flac'] }],
    });
    if (result.canceled) return false;
    audio = result.filePaths
      .filter((file) => fs.statSync(file).size < 30 * 1024 * 1024)
      .slice(0, 12)
      .map((file) => ({
        id: crypto.randomUUID(),
        name: path.parse(file).name,
        url: `data:audio/${path.extname(file).slice(1)};base64,${fs.readFileSync(file).toString('base64')}`,
      }));
    emit();
    return true;
  });
  ipcMain.handle('mediaControl', (_e, action, seconds) => {
    if (!['playPause', 'next', 'previous', 'seek'].includes(action))
      throw new Error('Invalid media action');
    return mediaBridge.control(action, seconds);
  });
  ipcMain.handle('volumeSet', (_e, value) => {
    if (!Number.isFinite(value) || value < 0 || value > 100) throw new Error('Invalid volume');
    return mediaBridge.control('setVolume', value);
  });
  ipcMain.handle('brightnessSet', (_e, value) => {
    if (!Number.isInteger(value) || value < 0 || value > 100) throw new Error('Invalid brightness');
    return mediaBridge.control('setBrightness', value);
  });
  ipcMain.handle('radioSet', (_e, target, enabled) => {
    if (!['wifi', 'bluetooth'].includes(target) || typeof enabled !== 'boolean')
      throw new Error('Invalid radio request');
    return mediaBridge.control('setRadio', undefined, { target, enabled });
  });
  ipcMain.handle('openSystemSettings', (_e, target) => {
    const urls = {
      wifi: 'ms-settings:network-wifi',
      bluetooth: 'ms-settings:bluetooth',
      display: 'ms-settings:display',
    };
    if (!Object.hasOwn(urls, target)) throw new Error('Invalid system settings target');
    return shell.openExternal(urls[target]);
  });
  ipcMain.handle('hooks', (_e, action, provider) => {
    const script = path.join(process.resourcesPath, 'agent_hook.ps1');
    const devScript = path.join(__dirname, 'agent_hook.ps1');
    return hooks.change(provider, action, fs.existsSync(script) ? script : devScript);
  });
  ipcMain.handle('decide', (_e, id, behavior) => {
    if (!['allow', 'deny'].includes(behavior) || !/^[0-9a-f-]{36}$/i.test(id))
      throw new Error('Invalid decision');
    const item = pending.get(id);
    if (!item || item.expires_at <= Date.now() / 1000) throw new Error('Request expired');
    const output = path.join(ipcRoot, 'decisions', `${id}.json`);
    fs.writeFileSync(output, JSON.stringify({ id, behavior }));
    pending.delete(id);
    emit();
    return true;
  });
  ipcMain.handle('roboKey', (_e, value) => {
    if (typeof value !== 'string' || value.length > 300) throw new Error('Invalid key');
    if (!safeStorage.isEncryptionAvailable()) throw new Error('Windows encryption is unavailable');
    fs.writeFileSync(path.join(root, 'robo-key.bin'), safeStorage.encryptString(value.trim()));
    return true;
  });
  ipcMain.handle('roboTargets', async () =>
    (
      await desktopCapturer.getSources({
        types: ['window'],
        thumbnailSize: { width: 1, height: 1 },
      })
    )
      .filter((source) => source.name && !/queueglow/i.test(source.name))
      .slice(0, 40)
      .map((source) => ({ id: source.id, name: source.name.slice(0, 120) })),
  );
  ipcMain.handle('roboAsk', async (_e, prompt, captureTarget) => {
    const clean = String(prompt || '')
      .trim()
      .slice(0, 2000);
    if (!clean) throw new Error('Type a question');
    const file = path.join(root, 'robo-key.bin');
    if (!fs.existsSync(file)) throw new Error('Add your OpenAI API key in Settings first');
    const key = safeStorage.decryptString(fs.readFileSync(file));
    const content = [{ type: 'input_text', text: clean }];
    if (captureTarget && captureTarget !== 'none') {
      if (typeof captureTarget !== 'string' || captureTarget.length > 200)
        throw new Error('Invalid capture target');
      const isScreen = captureTarget === 'screen';
      const sources = await desktopCapturer.getSources({
        types: [isScreen ? 'screen' : 'window'],
        thumbnailSize: { width: 1280, height: 720 },
      });
      const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
      const selected = isScreen
        ? sources.find((source) => source.display_id === String(display.id)) || sources[0]
        : sources.find((source) => source.id === captureTarget && !/queueglow/i.test(source.name));
      if (!selected || selected.thumbnail.isEmpty())
        throw new Error('Could not capture the screen');
      content.push({ type: 'input_image', image_url: selected.thumbnail.toDataURL() });
    }
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4.1-mini', input: [{ role: 'user', content }] }),
      signal: AbortSignal.timeout(30000),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Robo request failed');
    return (
      (data.output || [])
        .flatMap((item) => item.content || [])
        .filter((item) => item.type === 'output_text')
        .map((item) => item.text)
        .join('\n') || 'No text returned'
    );
  });
}
app.whenReady().then(() => {
  fs.mkdirSync(root, { recursive: true });
  store = new HubStore(root);
  register();
  openWindow();
  openTray();
  mediaBridge = new MediaBridge(process.resourcesPath, () => emit());
  mediaBridge.start();
  setInterval(checkPointerExit, 100);
  setInterval(pollPresence, 100);
  setInterval(pollEvents, 700);
  pollEvents();
  setInterval(() => {
    if (!store.setting('clipboardEnabled')) return;
    const value = clipboard.readText();
    if (value && value !== lastClip) {
      lastClip = value;
      store.addClip(value);
      emit();
    }
  }, 1200);
});
app.on('before-quit', () => {
  quitting = true;
});
app.on('window-all-closed', () => {
  mediaBridge?.stop();
  store?.close();
  app.quit();
});
