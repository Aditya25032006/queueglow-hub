const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const asar = require('@electron/asar');

if (process.platform !== 'win32') throw new Error('Windows packaging requires Windows');

const project = path.resolve(__dirname, '..');
const release = path.join(project, 'release');
const destination = path.join(release, 'QueueglowHub-win32-x64');
const runtime = path.join(project, 'node_modules', 'electron', 'dist');
const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'queueglow-package-'));

function removeWithin(base, target) {
  const relative = path.relative(path.resolve(base), path.resolve(target));
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative))
    throw new Error(`Unsafe delete: ${target}`);
  fs.rmSync(target, { recursive: true, force: true });
}

async function main() {
  if (!fs.existsSync(path.join(runtime, 'electron.exe')))
    throw new Error('Electron runtime is missing. Run npm ci.');
  fs.mkdirSync(release, { recursive: true });
  removeWithin(project, destination);
  fs.cpSync(runtime, destination, { recursive: true });
  fs.renameSync(path.join(destination, 'electron.exe'), path.join(destination, 'QueueglowHub.exe'));
  fs.copyFileSync(path.join(project, 'README.md'), path.join(destination, 'README.md'));

  for (const directory of ['dist', 'electron', 'assets']) {
    fs.cpSync(path.join(project, directory), path.join(stage, directory), { recursive: true });
  }
  for (const filename of ['package.json', 'README.md', 'LICENSE']) {
    fs.copyFileSync(path.join(project, filename), path.join(stage, filename));
  }
  const resources = path.join(destination, 'resources');
  await asar.createPackage(stage, path.join(resources, 'app.asar'));
  for (const filename of ['agent_hook.ps1', 'media_bridge.ps1', 'volume.cs']) {
    fs.copyFileSync(path.join(project, 'electron', filename), path.join(resources, filename));
  }
  fs.rmSync(path.join(resources, 'default_app.asar'), { force: true });
  console.log(`Portable Windows build: ${destination}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => removeWithin(os.tmpdir(), stage));
