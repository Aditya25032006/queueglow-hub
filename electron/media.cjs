const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const readline = require('node:readline');
const { linuxSystemRequest } = require('./linux-system.cjs');
const { LyricsClient } = require('./lyrics.cjs');

class MediaBridge {
  constructor(resourcePath, onChange) {
    this.resourcePath = resourcePath;
    this.onChange = onChange;
    this.pending = new Map();
    this.counter = 0;
    this.media = null;
    this.volume = null;
    this.system = null;
    this.lyrics = new LyricsClient();
    this.lyricsEnabled = true;
    this.lyricsTrackKey = '';
  }
  start() {
    if (process.platform === 'linux') {
      this.poll();
      this.interval = setInterval(() => this.poll(), 4000);
      return;
    }
    if (process.platform !== 'win32') return;
    const packaged = path.join(this.resourcePath, 'media_bridge.ps1');
    const script = fs.existsSync(packaged) ? packaged : path.join(__dirname, 'media_bridge.ps1');
    this.process = spawn(
      'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script],
      { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] },
    );
    readline.createInterface({ input: this.process.stdout }).on('line', (line) => {
      try {
        const response = JSON.parse(line);
        const waiting = this.pending.get(response.id);
        if (waiting) {
          clearTimeout(waiting.timer);
          this.pending.delete(response.id);
          response.ok
            ? waiting.resolve({
                media: response.media,
                volume: response.volume,
                system: response.system,
              })
            : waiting.reject(new Error(response.error || 'Media request failed'));
        }
      } catch {
        /* Ignore nonprotocol output. */
      }
    });
    this.process.on('exit', () => {
      for (const item of this.pending.values()) {
        clearTimeout(item.timer);
        item.reject(new Error('Media bridge stopped'));
      }
      this.pending.clear();
      this.process = null;
    });
    this.poll();
    this.interval = setInterval(() => this.poll(), 4000);
  }
  request(action, seconds, options = {}) {
    if (process.platform === 'linux') return linuxSystemRequest(action, seconds, options);
    if (!this.process?.stdin.writable)
      return Promise.reject(new Error('Windows media controls are unavailable'));
    const id = ++this.counter;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('Media request timed out'));
      }, 12000);
      this.pending.set(id, { resolve, reject, timer });
      this.process.stdin.write(`${JSON.stringify({ id, action, seconds, ...options })}\n`);
    });
  }
  mergeArtwork(next) {
    if (next.media) next.media.sampledAt = Date.now();
    if (
      next.media &&
      this.media &&
      !next.media.artwork &&
      next.media.title === this.media.title &&
      next.media.artist === this.media.artist &&
      next.media.source === this.media.source
    ) {
      next.media.artwork = this.media.artwork || null;
    }
    if (next.media && this.media && this.trackKey(next.media) === this.trackKey(this.media)) {
      next.media.lyrics = this.media.lyrics || null;
    }
    return next;
  }
  trackKey(track) {
    return track ? `${track.source || ''}\0${track.title || ''}\0${track.artist || ''}` : '';
  }
  setLyricsEnabled(enabled) {
    this.lyricsEnabled = !!enabled;
    this.lyricsTrackKey = '';
    if (this.media) {
      this.media.lyrics = null;
      this.onChange();
      if (this.lyricsEnabled) this.lookupLyrics();
    }
  }
  lookupLyrics() {
    if (!this.lyricsEnabled || !this.media) return;
    const key = this.trackKey(this.media);
    if (!key || key === this.lyricsTrackKey) return;
    this.lyricsTrackKey = key;
    this.lyrics.lookup(this.media).then((lyrics) => {
      if (this.lyricsEnabled && this.media && this.trackKey(this.media) === key) {
        this.media.lyrics = lyrics;
        this.onChange();
      }
    });
  }
  async poll() {
    try {
      const next = this.mergeArtwork(await this.request('state'));
      if (
        JSON.stringify(next) !==
        JSON.stringify({ media: this.media, volume: this.volume, system: this.system })
      ) {
        this.media = next.media;
        this.volume = next.volume;
        this.system = next.system;
        this.onChange(next);
        this.lookupLyrics();
      }
    } catch {
      /* Local player still works. */
    }
  }
  async control(action, seconds, options) {
    const next = this.mergeArtwork(await this.request(action, seconds, options));
    this.media = next.media;
    this.volume = next.volume;
    this.system = next.system;
    this.onChange(next);
    this.lookupLyrics();
    return next;
  }
  stop() {
    clearInterval(this.interval);
    this.process?.kill();
  }
}
module.exports = { MediaBridge };
