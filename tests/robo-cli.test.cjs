const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { discoverCli, chooseProvider, askCli } = require('../electron/robo-cli.cjs');

test('Robo prefers an installed local CLI over an API key', () => {
  assert.equal(chooseProvider('auto', { codex: 'codex.exe', openai: true }), 'codex');
  assert.equal(chooseProvider('claude', { codex: 'codex.exe', openai: true }), null);
});

test('CLI discovery accepts an executable on PATH', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'queueglow-cli-test-'));
  try {
    const executable = path.join(directory, process.platform === 'win32' ? 'codex.exe' : 'codex');
    fs.writeFileSync(executable, 'fixture', { mode: 0o700 });
    const found = discoverCli({ PATH: directory });
    assert.equal(found.codex, executable);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('Codex Robo runs with tool access disabled and returns only its answer', async () => {
  const executable = path.join(os.tmpdir(), 'codex.exe');
  const answer = await askCli(
    'codex',
    executable,
    'Reply READY',
    null,
    async (_exe, args, options, input) => {
      assert.equal(options.shell, false);
      assert.equal(args[args.indexOf('--sandbox') + 1], 'read-only');
      assert.ok(args.includes('shell_tool'));
      assert.ok(args.includes('hooks'));
      assert.match(input, /Reply READY/);
      fs.writeFileSync(args[args.indexOf('--output-last-message') + 1], 'READY');
      return '';
    },
  );
  assert.equal(answer, 'READY');
});
