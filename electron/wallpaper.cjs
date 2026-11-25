const { execFile } = require('node:child_process');
const { fileURLToPath } = require('node:url');
const { promisify } = require('node:util');

const run = promisify(execFile);
async function linuxWallpaperAccent() {
  try {
    const { stdout: scheme } = await run(
      'gsettings',
      ['get', 'org.gnome.desktop.interface', 'color-scheme'],
      { timeout: 2000 },
    );
    const key = scheme.trim() === "'prefer-dark'" ? 'picture-uri-dark' : 'picture-uri';
    const { stdout } = await run('gsettings', ['get', 'org.gnome.desktop.background', key], {
      timeout: 2000,
    });
    const uri = stdout.trim().match(/^'(file:\/\/.*)'$/)?.[1];
    if (!uri) return null;
    const { nativeImage } = require('electron');
    const image = nativeImage.createFromPath(fileURLToPath(uri));
    if (image.isEmpty()) return null;
    const pixels = image.resize({ width: 16, height: 16 }).toBitmap();
    const totals = [0, 0, 0];
    for (let i = 0; i < pixels.length; i += 4) {
      totals[0] += pixels[i + 2];
      totals[1] += pixels[i + 1];
      totals[2] += pixels[i];
    }
    return (
      '#' +
      totals
        .map((value) =>
          Math.round(value / (pixels.length / 4))
            .toString(16)
            .padStart(2, '0'),
        )
        .join('')
    );
  } catch {
    return null;
  }
}

function wallpaperAccent() {
  if (process.platform === 'linux') return linuxWallpaperAccent();
  if (process.platform !== 'win32') return Promise.resolve(null);
  const script = [
    "$ErrorActionPreference='Stop'",
    "$path=(Get-ItemPropertyValue -Path 'HKCU:\\Control Panel\\Desktop' -Name WallPaper)",
    'if (-not $path -or -not (Test-Path -LiteralPath $path)) { exit 2 }',
    'Add-Type -AssemblyName System.Drawing',
    '$image=[System.Drawing.Bitmap]::FromFile($path)',
    'try {',
    '  $r=0; $g=0; $b=0; $n=0',
    '  for ($y=0; $y -lt 16; $y++) { for ($x=0; $x -lt 16; $x++) {',
    '    $c=$image.GetPixel([int](($x*($image.Width-1))/15),[int](($y*($image.Height-1))/15))',
    '    $r+=$c.R; $g+=$c.G; $b+=$c.B; $n++',
    '  } }',
    "  '#{0:X2}{1:X2}{2:X2}' -f [int]($r/$n),[int]($g/$n),[int]($b/$n)",
    '} finally { $image.Dispose() }',
  ].join('; ');
  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { windowsHide: true, timeout: 8000, encoding: 'utf8' },
      (error, stdout) => {
        const color = stdout.trim().match(/^#[0-9A-Fa-f]{6}$/)?.[0] || null;
        resolve(error ? null : color);
      },
    );
  });
}

module.exports = { wallpaperAccent };
