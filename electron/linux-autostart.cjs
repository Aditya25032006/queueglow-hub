const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function entryPath() {
  const config = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(config, 'autostart', 'com.kausthub.queueglowhub.desktop');
}

function desktopExec(executable) {
  if (!path.isAbsolute(executable) || /[\x00-\x1f\x7f]/.test(executable))
    throw new Error('Invalid AppImage location');
  // Escape the Exec argument, then escape backslashes for the desktop file parser.
  const argument = executable
    .replace(/["`$\\]/g, '\\$&')
    .replace(/%/g, '%%')
    .replace(/\\/g, '\\\\');
  return `Exec="${argument}"`;
}

function linuxLaunchOnLogin(executable) {
  if (!fs.existsSync(entryPath())) return false;
  return (
    !executable ||
    fs.readFileSync(entryPath(), 'utf8').split('\n').includes(desktopExec(executable))
  );
}

function setLinuxLaunchOnLogin(enabled, executable) {
  const entry = entryPath();
  if (!enabled) {
    fs.rmSync(entry, { force: true });
    return;
  }
  fs.mkdirSync(path.dirname(entry), { recursive: true });
  fs.writeFileSync(
    entry,
    [
      '[Desktop Entry]',
      'Type=Application',
      'Name=Queueglow Hub',
      desktopExec(executable),
      'Terminal=false',
      '',
    ].join('\n'),
  );
}

function updateLinuxApplicationEntry(previous, destination) {
  const data = process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
  const entry = path.join(data, 'applications', 'com.kausthub.queueglowhub.desktop');
  if (!fs.existsSync(entry)) return;
  const original = desktopExec(previous);
  const lines = fs.readFileSync(entry, 'utf8').split('\n');
  const index = lines.indexOf(original);
  if (index === -1) return;
  lines[index] = desktopExec(destination);
  fs.writeFileSync(entry, lines.join('\n'));
}

module.exports = { linuxLaunchOnLogin, setLinuxLaunchOnLogin, updateLinuxApplicationEntry };
