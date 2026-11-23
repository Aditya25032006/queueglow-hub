const test = require('node:test');
const assert = require('node:assert/strict');
const { LyricsClient, parseSyncedLyrics, lyricAt } = require('../electron/lyrics.cjs');

test('parses timestamped lines and selects the current line', () => {
  const lines = parseSyncedLyrics('[00:02.50]First\n[00:07.125]Second\n[ar:Ignored]');
  assert.deepEqual(lines, [
    { at: 2.5, text: 'First' },
    { at: 7.125, text: 'Second' },
  ]);
  assert.equal(lyricAt(lines, 6), 'First');
  assert.equal(lyricAt(lines, 7.2), 'Second');
});

test('looks up lyrics once per track and includes duration when present', async () => {
  let requests = 0;
  const client = new LyricsClient(async (url, options) => {
    requests++;
    assert.equal(new URL(url).searchParams.get('track_name'), 'A track');
    assert.equal(new URL(url).searchParams.get('duration'), '184');
    assert.match(options.headers['User-Agent'], /Queueglow/);
    return {
      ok: true,
      json: async () => ({ syncedLyrics: '[00:03.10]A line', plainLyrics: 'A line' }),
    };
  });
  const track = { title: 'A track', artist: 'An artist', duration: 183.7 };
  const [first, second] = await Promise.all([client.lookup(track), client.lookup(track)]);
  assert.deepEqual(first, second);
  assert.equal(requests, 1);
  assert.equal((await client.lookup(track)).lines[0].text, 'A line');
  assert.equal(requests, 1);
});

test('does not query with incomplete metadata and treats misses as empty', async () => {
  const client = new LyricsClient(async () => ({ ok: false }));
  assert.equal(await client.lookup({ title: 'A track' }), null);
  assert.equal(await client.lookup({ title: 'A track', artist: 'An artist' }), null);
});

test('a missing exact track falls back to a duration and artist matched record', async () => {
  const calls = [];
  const client = new LyricsClient(async (url) => {
    calls.push(url);
    if (url.includes('/api/get?')) return { ok: false, status: 404 };
    return {
      ok: true,
      json: async () => [
        {
          trackName: 'Veezha Veera',
          artistName: 'Someone else',
          duration: 236,
          syncedLyrics: '[00:01.00]Wrong',
        },
        {
          trackName: 'Veezha Veera',
          artistName: 'Sai Abhyankkar',
          duration: 236,
          syncedLyrics: '[00:01.00]Matched',
        },
      ],
    };
  });
  const result = await client.lookup({
    title: 'Veezha Veera (From O.M: Operation Mole)',
    artist: 'Sai Abhyankkar',
    duration: 236,
  });
  assert.equal(result.lines[0].text, 'Matched');
  assert.equal(new URL(calls[1]).searchParams.get('track_name'), 'Veezha Veera');
});

test('rate limits pause requests across different songs', async () => {
  let count = 0;
  const client = new LyricsClient(async () => {
    count++;
    return { ok: false, status: 429, headers: { get: () => '30' } };
  });
  await client.lookup({ title: 'First', artist: 'Artist' });
  await client.lookup({ title: 'Second', artist: 'Artist' });
  assert.equal(count, 1);
  assert.ok(client.blockedUntil > Date.now() + 30000);
});
