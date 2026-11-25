const { execFile, spawn } = require('node:child_process');
const { promisify } = require('node:util');
const { getLinuxMedia, controlLinuxMedia } = require('./linux-media.cjs');

const run = promisify(execFile);
async function command(program, args) {
  const { stdout } = await run(program, args, {
    timeout: 3500,
    env: { ...process.env, LC_ALL: 'C' },
  });
  return stdout.trim();
}

const sink = '@DEFAULT_AUDIO_SINK@';
const screen = 'org.gnome.SettingsDaemon.Power.Screen';
const screenArgs = [
  'call',
  '--session',
  '--dest',
  'org.gnome.SettingsDaemon.Power',
  '--object-path',
  '/org/gnome/SettingsDaemon/Power',
  '--method',
];

async function linuxSystemState() {
  const [audio, brightness, wifi, networks, bluetooth, devices, battery, player] =
    await Promise.all([
      command('wpctl', ['get-volume', sink]).catch(() => ''),
      command('gdbus', [
        ...screenArgs,
        'org.freedesktop.DBus.Properties.Get',
        screen,
        'Brightness',
      ]).catch(() => ''),
      command('nmcli', ['-t', 'radio', 'wifi']).catch(() => ''),
      command('nmcli', [
        '-t',
        '--escape',
        'no',
        '-f',
        'ACTIVE,SSID',
        'dev',
        'wifi',
        'list',
        '--rescan',
        'no',
      ]).catch(() => ''),
      command('bluetoothctl', ['show']).catch(() => ''),
      command('bluetoothctl', ['devices', 'Connected']).catch(() => ''),
      command('upower', ['-i', '/org/freedesktop/UPower/devices/DisplayDevice']).catch(() => ''),
      getLinuxMedia(command).catch(() => null),
    ]);
  const level = audio.match(/^Volume: (\d+(?:\.\d+)?)/)?.[1];
  const backlight = Number(brightness.match(/<(\d+)>/)?.[1]);
  const wifiSsid =
    networks
      .split('\n')
      .find((line) => line.startsWith('yes:'))
      ?.slice(4) || null;
  const charge = battery.match(/^\s*percentage:\s*(\d+)%/m)?.[1];
  const powered = bluetooth.match(/Powered: (yes|no)/)?.[1];
  return {
    media: player?.media || null,
    volume:
      level == null
        ? null
        : audio.includes('[MUTED]')
          ? 0
          : Math.min(100, Math.round(Number(level) * 100)),
    system: {
      batteryPercent: charge == null ? null : Number(charge),
      charging: /^\s*state:\s*(charging|fully-charged)\s*$/m.test(battery),
      brightnessPercent: backlight >= 0 && backlight <= 100 ? backlight : null,
      wifiAvailable: wifi === 'enabled' || wifi === 'disabled',
      wifiEnabled: wifi === 'enabled',
      wifiConnected: Boolean(wifiSsid),
      wifiSsid,
      bluetoothAvailable: powered != null,
      bluetoothEnabled: powered === 'yes',
      bluetoothDevice:
        powered === 'yes'
          ? devices.match(/^Device (?:[0-9A-F]{2}:){5}[0-9A-F]{2} (.+)$/im)?.[1] || null
          : null,
    },
  };
}

async function linuxSystemRequest(action, value, options) {
  switch (action) {
    case 'state':
      break;
    case 'setVolume':
      await command('wpctl', ['set-volume', sink, `${value}%`]);
      if (value > 0) await command('wpctl', ['set-mute', sink, '0']);
      break;
    case 'setBrightness':
      await command('gdbus', [
        ...screenArgs,
        'org.freedesktop.DBus.Properties.Set',
        screen,
        'Brightness',
        `<int32 ${value}>`,
      ]);
      break;
    case 'setRadio': {
      const mode = options.enabled ? 'on' : 'off';
      if (options.target === 'wifi') {
        await command('nmcli', ['radio', 'wifi', mode]);
      } else {
        const response = await command('bluetoothctl', ['power', mode]);
        if (!response.includes('succeeded'))
          throw new Error(response || 'Bluetooth power change failed');
      }
      break;
    }
    default:
      await controlLinuxMedia(command, action, value);
  }
  return linuxSystemState();
}

function openLinuxSettings(target) {
  const panels = { wifi: 'wifi', bluetooth: 'bluetooth', display: 'display' };
  return new Promise((resolve, reject) => {
    const child = spawn('gnome-control-center', [panels[target]], {
      detached: true,
      stdio: 'ignore',
    });
    child.once('error', reject);
    child.once('spawn', () => {
      child.unref();
      resolve(true);
    });
  });
}

async function launchDesktopApp(file) {
  await command('gio', ['launch', file]);
  return true;
}

module.exports = { linuxSystemRequest, openLinuxSettings, launchDesktopApp };
