const { _electron: electron } = require('@playwright/test');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { mainPage, hoverNotch, moveSystemCursor } = require('./window.cjs');

(async () => {
  const project = path.resolve(__dirname, '..');
  const root = path.resolve(project, '..', '..', 'work', 'hub-e2e-agent');
  fs.mkdirSync(root, { recursive: true });
  const helper = path.join(project, 'electron', 'agent_hook.ps1');
  moveSystemCursor(20, 400);
  const app = await electron.launch({
    args: ['.'],
    cwd: project,
    env: { ...process.env, QUEUEGLOW_HOME: root },
  });
  try {
    await app.firstWindow();

    const win = await mainPage(app);
    await hoverNotch(app);
    await win.waitForSelector('.shell.motion-idle');
    await win.getByRole('button', { name: 'Codex', exact: true }).click();
    for (const provider of ['codex', 'claude']) {
      const hook = spawn(
        'powershell.exe',
        [
          '-NoProfile',
          '-NonInteractive',
          '-ExecutionPolicy',
          'Bypass',
          '-File',
          helper,
          '-Provider',
          provider,
        ],
        { env: { ...process.env, QUEUEGLOW_HOME: root }, windowsHide: true },
      );
      let output = '';
      hook.stdout.on('data', (chunk) => (output += chunk));
      hook.stdin.end(
        JSON.stringify({
          hook_event_name: 'PermissionRequest',
          session_id: `e2e-${provider}`,
          tool_name: 'Bash',
          tool_input: {
            description: `Run a harmless ${provider} test command`,
            command: 'Write-Output Queueglow-test',
          },
        }),
      );
      await win
        .locator('.permission p')
        .getByText(`Run a harmless ${provider} test command`)
        .waitFor({ timeout: 10000 });
      await win.getByRole('button', { name: 'Allow once' }).click();
      await new Promise((resolve, reject) => {
        hook.on('exit', (code) =>
          code === 0 ? resolve() : reject(new Error(`Hook exited ${code}`)),
        );
        hook.on('error', reject);
      });
      assert.equal(JSON.parse(output).hookSpecificOutput.decision.behavior, 'allow');
    }
    console.log(
      'Agent E2E passed: Codex and Claude hook events, live cards, one-time approval relays',
    );
  } finally {
    await app.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
