const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

function launcher() {
  if (process.platform !== 'linux') return null;
  const candidates = [
    process.env.QUEUEGLOW_ECHO_MUSIC,
    path.join(os.homedir(), '.local/opt/echo-music/bin/echo-music-launcher'),
    '/opt/echo-music/bin/echo-music-launcher',
  ];
  return (
    candidates.find((file) => {
      if (!file || !path.isAbsolute(file)) return false;
      try {
        fs.accessSync(file, fs.constants.X_OK);
        return fs.statSync(file).isFile();
      } catch {
        return false;
      }
    }) || null
  );
}

function requestEcho(action) {
  const runtime = process.env.XDG_RUNTIME_DIR;
  if (!runtime || !path.isAbsolute(runtime)) return Promise.resolve(null);
  return new Promise((resolve) => {
    const socket = net.createConnection(path.join(runtime, 'echo-music', 'control.sock'));
    let response = '';
    const finish = (result = null) => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(1200, () => finish());
    socket.setEncoding('utf8');
    socket.once('error', () => finish());
    socket.once('end', () => finish());
    socket.once('connect', () => socket.write(action + '\n'));
    socket.on('data', (chunk) => {
      response += chunk;
      if (response.length > 16000) return finish();
      if (!response.includes('\n')) return;
      try {
        const state = JSON.parse(response.split('\n')[0]);
        finish(state.ok === true ? state : null);
      } catch {
        finish();
      }
    });
  });
}

async function launchEcho(show) {
  const action = show ? 'show' : 'hide';
  if (await requestEcho(action)) return true;
  const executable = launcher();
  if (!executable) throw new Error('Echo Music is not installed');
  return new Promise((resolve, reject) => {
    const child = spawn(executable, show ? [] : ['--tray'], { detached: true, stdio: 'ignore' });
    child.once('error', reject);
    child.once('spawn', () => {
      child.unref();
      resolve(true);
    });
  });
}

function echoArtwork(value) {
  if (typeof value !== 'string' || value.length > 4096) return null;
  try {
    const url = new URL(value);
    if (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.port &&
      [
        'yt3.googleusercontent.com',
        'lh3.googleusercontent.com',
        'i.ytimg.com',
        'yt3.ggpht.com',
      ].includes(url.hostname)
    )
      return url.href;
  } catch {}
  return null;
}

module.exports = { echoArtwork, echoInstalled: () => Boolean(launcher()), launchEcho, requestEcho };
