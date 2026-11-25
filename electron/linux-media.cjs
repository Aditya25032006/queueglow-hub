const { fileURLToPath } = require('node:url');

const servicePrefix = 'org.mpris.MediaPlayer2.';
const objectPath = '/org/mpris/MediaPlayer2';
const player = 'org.mpris.MediaPlayer2.Player';
const microsPerSecond = 1000000;

async function getLinuxMedia(command) {
  const bus = async (args) => {
    const response = await command('busctl', ['--user', '--json=short', ...args]);
    return response ? JSON.parse(response).data : null;
  };
  const [names] = await bus([
    'call',
    'org.freedesktop.DBus',
    '/org/freedesktop/DBus',
    'org.freedesktop.DBus',
    'ListNames',
  ]);
  async function session(service) {
    const property = (name) => bus(['get-property', service, objectPath, player, name]);
    const [status, metadata, position] = await Promise.all([
      property('PlaybackStatus'),
      property('Metadata'),
      property('Position').catch(() => 0),
    ]);
    if (status === 'Stopped' || !metadata?.['xesam:title']?.data) return null;
    const cover = metadata['mpris:artUrl']?.data;
    let artwork = null;
    if (cover?.startsWith('file://')) {
      try {
        const { nativeImage } = require('electron');
        const image = nativeImage.createFromPath(fileURLToPath(cover));
        if (!image.isEmpty()) artwork = image.resize({ width: 320 }).toDataURL();
      } catch {
        // Track metadata remains usable without cover art.
      }
    }
    return {
      trackId: metadata['mpris:trackid']?.data,
      media: {
        title: metadata['xesam:title'].data,
        artist: metadata['xesam:artist']?.data?.join(', ') || '',
        source: service.slice(servicePrefix.length),
        platform: 'linux',
        playing: status === 'Playing',
        position: position / microsPerSecond,
        duration: (metadata['mpris:length']?.data || 0) / microsPerSecond,
        artwork,
      },
      call: (method, ...args) => bus(['call', service, objectPath, player, method, ...args]),
    };
  }
  const sessions = (
    await Promise.all(
      names
        .filter((name) => name.startsWith(servicePrefix))
        .map((name) => session(name).catch(() => null)),
    )
  ).filter(Boolean);
  return sessions.find(({ media }) => media.playing) || sessions[0] || null;
}

async function controlLinuxMedia(command, action, value) {
  const session = await getLinuxMedia(command);
  if (!session) throw new Error('No Linux media player is active');
  if (action === 'seek') {
    if (!session.trackId || !Number.isFinite(value) || value < 0)
      throw new Error('Invalid track position');
    await session.call(
      'SetPosition',
      'ox',
      session.trackId,
      String(Math.round(value * microsPerSecond)),
    );
    return;
  }
  const methods = { playPause: 'PlayPause', next: 'Next', previous: 'Previous' };
  if (!Object.hasOwn(methods, action)) throw new Error('Unknown media action');
  await session.call(methods[action]);
}
module.exports = { controlLinuxMedia, getLinuxMedia };
