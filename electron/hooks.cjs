const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const EVENTS = ['SessionStart', 'PreToolUse', 'PermissionRequest', 'Stop'];
const paths = () => ({
  codex:
    process.env.QUEUEGLOW_CODEX_HOOKS ||
    path.join(process.env.CODEX_HOME || path.join(os.homedir(), '.codex'), 'hooks.json'),
  claude:
    process.env.QUEUEGLOW_CLAUDE_SETTINGS || path.join(os.homedir(), '.claude', 'settings.json'),
});
function removeOurs(config) {
  const hooks = config.hooks;
  if (!hooks || typeof hooks !== 'object') return config;
  for (const [event, groups] of Object.entries(hooks)) {
    if (!Array.isArray(groups)) continue;
    hooks[event] = groups
      .map((group) => {
        if (!Array.isArray(group?.hooks)) return group;
        return {
          ...group,
          hooks: group.hooks.filter(
            (item) =>
              !/queueglowhook\.exe|agent_hook\.ps1/i.test(
                `${item.command || ''} ${item.args || ''}`,
              ),
          ),
        };
      })
      .filter((group) => !Array.isArray(group?.hooks) || group.hooks.length);
  }
  return config;
}
function plan(config, provider, action, executable) {
  const next = removeOurs(structuredClone(config));
  if (action === 'remove') return next;
  if (action !== 'connect') throw new Error('Unknown hook action');
  if (!fs.existsSync(executable)) throw new Error('Companion hook script is missing');
  if (!next.hooks) next.hooks = {};
  if (typeof next.hooks !== 'object' || Array.isArray(next.hooks))
    throw new Error('Invalid existing hooks');
  for (const event of EVENTS) {
    const command = `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${executable}" -Provider ${provider}`;
    const item =
      provider === 'claude'
        ? {
            type: 'command',
            command,
            timeout: event === 'PermissionRequest' ? 58 : 5,
            onFailure: 'continue',
          }
        : {
            type: 'command',
            command,
            timeout: event === 'PermissionRequest' ? 58 : 5,
            statusMessage: 'Queueglow',
          };
    if (!Array.isArray(next.hooks[event])) next.hooks[event] = [];
    next.hooks[event].push({ hooks: [item] });
  }
  return next;
}
function change(provider, action, executable) {
  if (!['codex', 'claude'].includes(provider)) throw new Error('Unknown provider');
  const configPath = paths()[provider];
  const before = fs.existsSync(configPath)
    ? JSON.parse(fs.readFileSync(configPath, 'utf8').replace(/^\uFEFF/, ''))
    : {};
  const after = plan(before, provider, action, executable);
  if (JSON.stringify(before) === JSON.stringify(after)) return { changed: false, path: configPath };
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  let backup = null;
  if (fs.existsSync(configPath)) {
    backup = `${configPath}.queueglow-${Date.now()}.bak`;
    fs.copyFileSync(configPath, backup);
  }
  const temp = `${configPath}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(after, null, 2)}\n`);
  fs.renameSync(temp, configPath);
  return { changed: true, path: configPath, backup };
}
module.exports = { change, plan, removeOurs };
