const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
const { change, plan, registrationStatus } = require('../electron/hooks.cjs');

const executable = path.join(__dirname, '..', 'electron', 'agent_hook.ps1');
const hookArgs = (provider) => [
  '-NoProfile',
  '-NonInteractive',
  '-ExecutionPolicy',
  'Bypass',
  '-File',
  executable,
  '-Provider',
  provider,
];

test('hook plan removes only Queueglow’s matching provider and installed script', () => {
  const otherScript = path.join(__dirname, 'other tool', 'agent_hook.ps1');
  const original = {
    hooks: {
      SessionStart: [
        {
          matcher: 'startup',
          hooks: [
            { type: 'command', command: 'other.exe' },
            {
              type: 'command',
              command:
                'powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' +
                otherScript +
                '" -Provider codex',
            },
            { type: 'command', command: 'powershell.exe', args: ['-File', otherScript] },
            { type: 'command', command: 'echo QueueglowHook.exe' },
          ],
        },
        { matcher: 'unused', hooks: [] },
      ],
    },
    otherSetting: 42,
  };
  const installed = plan(original, 'codex', 'connect', executable);
  const ours = installed.hooks.SessionStart.pop().hooks[0];
  const windowsOverride = { ...ours, commandWindows: 'different-hook.exe' };
  installed.hooks.SessionStart[0].hooks.push(ours, windowsOverride);
  assert.equal(original.hooks.SessionStart.length, 2);
  assert.equal(installed.otherSetting, 42);
  assert.equal(installed.hooks.PostToolUse.length, 1);
  assert.equal(installed.hooks.PostToolUseFailure, undefined);

  const removed = plan(installed, 'codex', 'remove', executable);
  original.hooks.SessionStart[0].hooks.push(windowsOverride);
  assert.deepEqual(removed.hooks.SessionStart, original.hooks.SessionStart);
  assert.deepEqual(removed.hooks.PostToolUse, []);
  assert.deepEqual(plan(installed, 'claude', 'remove', executable), installed);
  const configured = plan(original, 'claude', 'connect', executable);
  assert.equal(configured.hooks.PostToolUseFailure.length, 1);
  assert.deepEqual(plan(configured, 'claude', 'connect', executable), configured);
});

function hookFixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'queueglow-hook-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const inbox = path.join(root, 'ipc', 'inbox');
  const env = { ...process.env, QUEUEGLOW_HOME: root };
  const events = () =>
    fs.existsSync(inbox)
      ? fs
          .readdirSync(inbox)
          .filter((file) => file.endsWith('.json'))
          .map((file) => JSON.parse(fs.readFileSync(path.join(inbox, file), 'utf8')))
      : [];
  return { root, env, events };
}

test('reconnecting after a portable move replaces the exact recorded hook only', (t) => {
  const { root } = hookFixture(t);
  const config = path.join(root, 'codex-hooks.json');
  const oldConfig = process.env.QUEUEGLOW_CODEX_HOOKS;
  process.env.QUEUEGLOW_CODEX_HOOKS = config;
  t.after(() => {
    if (oldConfig === undefined) delete process.env.QUEUEGLOW_CODEX_HOOKS;
    else process.env.QUEUEGLOW_CODEX_HOOKS = oldConfig;
  });

  const oldScript = path.join(root, 'first copy', 'agent_hook.ps1');
  const newScript = path.join(root, 'next copy', 'agent_hook.ps1');
  const unrelatedScript = path.join(root, 'unrelated tool', 'agent_hook.ps1');
  assert.equal(registrationStatus('codex', oldScript), 'disconnected');
  fs.mkdirSync(path.dirname(oldScript));
  fs.copyFileSync(executable, oldScript);
  change('codex', 'connect', oldScript);
  assert.equal(registrationStatus('codex', oldScript), 'connected');

  const original = JSON.parse(fs.readFileSync(config, 'utf8'));
  const registered = original.hooks.SessionStart[0].hooks[0];
  const unrelated = {
    ...registered,
    command: registered.command.replace(oldScript, unrelatedScript),
  };
  original.hooks.SessionStart[0].hooks.push(unrelated);
  fs.writeFileSync(config, JSON.stringify(original));
  fs.mkdirSync(path.dirname(newScript));
  fs.renameSync(oldScript, newScript);
  assert.equal(registrationStatus('codex', newScript), 'update');
  change('codex', 'connect', newScript);
  assert.equal(registrationStatus('codex', newScript), 'connected');

  const moved = JSON.parse(fs.readFileSync(config, 'utf8'));
  assert.deepEqual(moved.hooks.SessionStart[0].hooks, [unrelated]);
  assert.equal(moved.hooks.SessionStart.length, 2);
  assert.match(moved.hooks.SessionStart[1].hooks[0].command, /next copy/);
  assert.doesNotMatch(JSON.stringify(moved), /first copy/);
  assert.deepEqual(JSON.parse(fs.readFileSync(config + '.queueglow-codex-hooks.json', 'utf8')), [
    newScript,
  ]);

  // Removing after a move must also work before the new location is registered.
  change('codex', 'remove', oldScript);
  assert.equal(registrationStatus('codex', newScript), 'disconnected');
  const removed = JSON.parse(fs.readFileSync(config, 'utf8'));
  assert.deepEqual(removed.hooks.SessionStart, [{ hooks: [unrelated] }]);
});

const windowsOnly = { skip: process.platform !== 'win32' };
test('official hook inputs expose action labels and redacted final text', windowsOnly, (t) => {
  const { env, events } = hookFixture(t);
  const fixtures = [
    [
      'codex',
      {
        hook_event_name: 'PreToolUse',
        tool_name: 'Bash',
        tool_input: {
          command: 'pwsh.exe -NoProfile -Command "npm run test -- --token secret-argument"',
        },
      },
      'Running tests - npm run test',
    ],
    [
      'codex',
      {
        hook_event_name: 'PostToolUse',
        tool_name: 'Bash',
        tool_input: { command: 'git status --short' },
        tool_response: 'secret-output',
      },
      'Finished command - git status',
    ],
    [
      'claude',
      {
        hook_event_name: 'PostToolUseFailure',
        tool_name: 'Bash',
        tool_input: { command: 'npm test' },
        error: 'Exit code 1\nsecret-output',
      },
      'Tests failed (exit 1) - npm test',
    ],
    [
      'claude',
      {
        hook_event_name: 'PreToolUse',
        cwd: 'C:\\project',
        tool_name: 'Write',
        tool_input: { file_path: 'C:\\project\\src\\index.ts', content: 'secret-source' },
      },
      'Write - src/index.ts',
    ],
    [
      'codex',
      {
        hook_event_name: 'PostToolUse',
        tool_name: 'apply_patch',
        tool_input: {
          command: '*** Begin Patch\n*** Update File: src/main.js\n+secret-source\n*** End Patch',
        },
      },
      'Applied patch - src/main.js',
    ],
    [
      'codex',
      {
        hook_event_name: 'Stop',
        last_assistant_message:
          'Finished résumé.\n\nAPI_KEY="secret-value"\n' +
          'Authorization: Basic secret-basic\nProxy-Authorization: Digest response="secret-digest"\n' +
          'x'.repeat(5000),
        transcript_path: 'secret-transcript',
      },
      'Final response',
    ],
    [
      'claude',
      {
        hook_event_name: 'Stop',
        last_assistant_message: 'Claude finished the update.',
      },
      'Final response',
    ],
    ['claude', { hook_event_name: 'Stop' }, 'Session finished'],
  ];

  for (const [index, [provider, payload, summary]] of fixtures.entries()) {
    const session = 'fixture-' + index;
    const run = spawnSync('powershell.exe', hookArgs(provider), {
      input: JSON.stringify({ session_id: session, ...payload }),
      encoding: 'utf8',
      windowsHide: true,
      env,
    });
    assert.equal(run.status, 0, run.error?.message || run.stderr);
    assert.equal(run.stderr, '');
    const event = events().find((candidate) => candidate.session_id === provider + ':' + session);
    assert.equal(event?.summary, summary);
    if (index === 5) {
      assert.deepEqual(JSON.parse(run.stdout), {});
      assert.match(event.detail, /^Finished résumé\.\n\nAPI_KEY=\[redacted\]/);
      assert.match(event.detail, /Authorization: \[redacted\]\nProxy-Authorization: \[redacted\]/);
      assert.equal(event.detail.length, 4000);
    } else if (index === 6) {
      assert.equal(event.detail, 'Claude finished the update.');
    } else {
      assert.equal(event.detail, '');
    }
  }
  assert.doesNotMatch(
    JSON.stringify(events()),
    /secret-(?:argument|source|output|value|transcript|basic|digest)/,
  );
});

for (const [provider, behavior] of [
  ['codex', 'allow'],
  ['claude', 'deny'],
]) {
  test(
    provider + ' hook relays a decision once without persisting raw tool input',
    windowsOnly,
    async (t) => {
      const { root, env, events } = hookFixture(t);
      const heartbeat = path.join(root, 'ipc', 'heartbeat');
      fs.mkdirSync(path.dirname(heartbeat));
      fs.writeFileSync(heartbeat, '');
      const refresh = setInterval(() => fs.utimesSync(heartbeat, new Date(), new Date()), 500);
      t.after(() => clearInterval(refresh));
      const child = spawn('powershell.exe', hookArgs(provider), { env, windowsHide: true });
      t.after(() => child.kill());
      let output = '';
      let errors = '';
      child.stdout.on('data', (chunk) => (output += chunk));
      child.stderr.on('data', (chunk) => (errors += chunk));
      const result = new Promise((resolve, reject) => {
        child.on('error', reject);
        child.on('close', resolve);
      });
      child.stdin.end(
        JSON.stringify({
          hook_event_name: 'PermissionRequest',
          tool_name: 'Bash',
          tool_input: {
            command: 'npm test -- --runInBand',
            description: 'Run tests',
            extra: 'private-extra',
          },
        }),
      );
      const deadline = Date.now() + 6000;
      let event;
      do {
        await delay(50);
        [event] = events();
      } while (!event && Date.now() < deadline);
      assert.equal(event?.summary, 'Run tests', errors);
      assert.equal(event.detail, 'npm test -- --runInBand');
      assert.ok(event.expires_at > Date.now() / 1000);
      assert.doesNotMatch(JSON.stringify(event), /private-extra/);
      const decisionFile = path.join(root, 'ipc', 'decisions', event.id + '.json');
      fs.writeFileSync(decisionFile, JSON.stringify({ id: event.id, behavior }));
      assert.equal(await result, 0);
      assert.equal(errors, '');
      assert.equal(JSON.parse(output).hookSpecificOutput.decision.behavior, behavior);
      assert.equal(fs.existsSync(decisionFile), false);
    },
  );
}

test('opaque, redacted, and offline approvals are delegated to the provider', windowsOnly, (t) => {
  const { root, env, events } = hookFixture(t);
  const heartbeat = path.join(root, 'ipc', 'heartbeat');
  for (const [index, [tool, input, hubRunning]] of [
    ['Bash', { command: 'npm test' }, false],
    ['mcp__workspace__operation', { description: 'Apply changes', target: 'private-target' }, true],
    ['Bash', { command: 'npm test --token private-token' }, true],
  ].entries()) {
    if (hubRunning) fs.writeFileSync(heartbeat, '');
    const session = 'deferred-' + index;
    const run = spawnSync('powershell.exe', hookArgs('codex'), {
      input: JSON.stringify({
        hook_event_name: 'PermissionRequest',
        session_id: session,
        tool_name: tool,
        tool_input: input,
      }),
      encoding: 'utf8',
      env,
      timeout: 10000,
      windowsHide: true,
    });
    assert.equal(run.status, 0, run.stderr);
    assert.equal(run.stderr, '');
    assert.equal(run.stdout, '');
    const event = events().find((candidate) => candidate.session_id === 'codex:' + session);
    assert.match(event.summary, /^Approval in Codex/);
    assert.equal(event.kind, 'activity');
    assert.equal(event.expires_at, null);
    assert.equal(event.detail, '');
    assert.doesNotMatch(JSON.stringify(event), /private-(?:target|token)/);
  }
});
