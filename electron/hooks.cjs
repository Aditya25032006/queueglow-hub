const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { randomUUID } = require('node:crypto');

const EVENTS = ['SessionStart', 'PreToolUse', 'PostToolUse', 'PermissionRequest', 'Stop'];
const paths = () => ({
  codex:
    process.env.QUEUEGLOW_CODEX_HOOKS ||
    path.join(process.env.CODEX_HOME || path.join(os.homedir(), '.codex'), 'hooks.json'),
  claude:
    process.env.QUEUEGLOW_CLAUDE_SETTINGS || path.join(os.homedir(), '.claude', 'settings.json'),
});
function hookCommand(executable, provider) {
  return `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${executable}" -Provider ${provider}`;
}

function isOwnedHook(item, commands) {
  return (
    item?.type === 'command' &&
    item.args === undefined &&
    item.commandWindows === undefined &&
    commands.has(item.command)
  );
}

function providerEvents(provider) {
  return provider === 'claude' ? [...EVENTS, 'PostToolUseFailure'] : EVENTS;
}

function removeOurs(config, provider, executable, previouslyRegistered = []) {
  const expected = new Set(
    [...previouslyRegistered, executable]
      .filter(Boolean)
      .map((script) => hookCommand(script, provider)),
  );
  const hooks = config.hooks;
  if (!hooks || typeof hooks !== 'object') return config;
  for (const [event, groups] of Object.entries(hooks)) {
    if (!Array.isArray(groups)) continue;
    hooks[event] = groups.flatMap((group) => {
      if (!Array.isArray(group?.hooks)) return [group];
      const remaining = group.hooks.filter((item) => !isOwnedHook(item, expected));
      if (remaining.length === group.hooks.length) return [group];
      return remaining.length ? [{ ...group, hooks: remaining }] : [];
    });
  }
  return config;
}
function plan(config, provider, action, executable, previouslyRegistered = []) {
  const next = removeOurs(structuredClone(config), provider, executable, previouslyRegistered);
  if (action === 'remove') return next;
  if (action !== 'connect') throw new Error('Unknown hook action');
  if (!fs.existsSync(executable)) throw new Error('Companion hook script is missing');
  if (!next.hooks) next.hooks = {};
  if (typeof next.hooks !== 'object' || Array.isArray(next.hooks))
    throw new Error('Invalid existing hooks');
  const command = hookCommand(executable, provider);
  for (const event of providerEvents(provider)) {
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
function writeJson(file, value) {
  const temporary = file + '.' + randomUUID() + '.tmp';
  try {
    fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
    fs.renameSync(temporary, file);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

function isHookScript(script) {
  return (
    typeof script === 'string' &&
    path.isAbsolute(script) &&
    path.basename(script) === 'agent_hook.ps1' &&
    !/["\r\n]/.test(script)
  );
}

function registeredScripts(file) {
  let contents;
  try {
    contents = fs.readFileSync(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  const scripts = JSON.parse(contents);
  if (!Array.isArray(scripts) || scripts.some((script) => !isHookScript(script)))
    throw new Error('Invalid Queueglow hook registration');
  return scripts;
}

function readProviderConfig(file) {
  try {
    const config = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
    if (!config || typeof config !== 'object' || Array.isArray(config))
      throw new Error('Invalid provider configuration');
    return config;
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
}

function registrationStatus(provider, executable) {
  const config = paths()[provider];
  const registry = config + '.queueglow-' + provider + '-hooks.json';
  const hooks = readProviderConfig(config).hooks;
  if (hooks && (typeof hooks !== 'object' || Array.isArray(hooks)))
    throw new Error('Invalid existing hooks');
  const current = new Set([hookCommand(executable, provider)]);
  const seen = new Set(
    [executable, ...registeredScripts(registry)].map((script) => hookCommand(script, provider)),
  );
  function hasHook(event, commands) {
    return (
      Array.isArray(hooks?.[event]) &&
      hooks[event].some(
        (group) =>
          Array.isArray(group?.hooks) && group.hooks.some((item) => isOwnedHook(item, commands)),
      )
    );
  }
  const events = providerEvents(provider);
  if (events.every((event) => hasHook(event, current))) return 'connected';
  if (events.some((event) => hasHook(event, seen))) return 'update';
  return 'disconnected';
}

function change(provider, action, executable) {
  if (!['codex', 'claude'].includes(provider)) throw new Error('Unknown provider');
  if (action === 'connect' && !isHookScript(executable))
    throw new Error('Invalid Queueglow hook script');
  const configPath = paths()[provider];
  const registry = configPath + '.queueglow-' + provider + '-hooks.json';
  const previous = registeredScripts(registry);
  const before = readProviderConfig(configPath);
  const after = plan(before, provider, action, executable, previous);
  const changed = JSON.stringify(before) !== JSON.stringify(after);
  if (!changed && action === 'remove' && !previous.length)
    return { changed: false, path: configPath };
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  // Record the new script before writing the hook, so a failed migration can be retried.
  if (action === 'connect' && !previous.includes(executable)) {
    writeJson(registry, [...previous, executable]);
  }
  let backup = null;
  if (changed) {
    if (fs.existsSync(configPath)) {
      backup = configPath + '.queueglow-' + Date.now() + '-' + randomUUID() + '.bak';
      fs.copyFileSync(configPath, backup, fs.constants.COPYFILE_EXCL);
    }
    writeJson(configPath, after);
  }
  if (action === 'remove') {
    fs.rmSync(registry, { force: true });
  } else if (previous.some((script) => script !== executable)) {
    writeJson(registry, [executable]);
  }
  return { changed, path: configPath, backup };
}
module.exports = { change, plan, removeOurs, registrationStatus };
