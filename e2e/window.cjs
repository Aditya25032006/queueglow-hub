async function mainPage(app) {
  for (let i = 0; i < 60; i++) {
    const page = app.windows().find((candidate) => candidate.url().endsWith('/index.html'));
    if (page) {
      await page.waitForSelector('.shell', { state: 'attached' });
      return page;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('Main island did not open');
}

const { execFileSync } = require('node:child_process');

function moveSystemCursor(x, y) {
  const script = `Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class Cursor { [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y); }'; [Cursor]::SetCursorPos(${x},${y})`;
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
    windowsHide: true,
  });
}

async function hoverNotch(app) {
  const bounds = await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].getBounds(),
  );
  const x = Math.round(bounds.x + bounds.width / 2);
  const y = bounds.y + 17;
  moveSystemCursor(x, y);
}

module.exports = { mainPage, hoverNotch, moveSystemCursor };
