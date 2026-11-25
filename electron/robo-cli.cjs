const { execFile } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ANSWER_LIMIT = 8000;
const PROCESS_LIMIT = 256 * 1024;
const TIMEOUT = 45000;
const NAMES = { codex: 'Codex', claude: 'Claude Code' };

function pathDirectories(environment) {
  const entries = (environment.PATH || environment.Path || '').split(path.delimiter);
  const home = environment.USERPROFILE || environment.HOME;
  if (home) entries.push(path.join(home, '.local', 'bin'));
  return entries.map((entry) => entry.trim().replace(/^"(.*)"$/, '$1')).filter(path.isAbsolute);
}

function discoverCli(environment = process.env) {
  const directories = pathDirectories(environment);
  const suffix = process.platform === 'win32' ? '.exe' : '';
  return Object.fromEntries(
    Object.keys(NAMES).map((provider) => {
      const candidates = directories.map((directory) => path.join(directory, provider + suffix));
      if (process.platform === 'linux' && provider === 'codex')
        candidates.push('/usr/lib/chatgpt/resources/codex');
      if (process.platform === 'win32' && provider === 'codex' && environment.APPDATA) {
        const arch =
          process.arch === 'arm64' ? 'aarch64-pc-windows-msvc' : 'x86_64-pc-windows-msvc';
        candidates.push(
          path.join(
            environment.APPDATA,
            'npm',
            'node_modules',
            '@openai',
            'codex',
            'node_modules',
            process.arch === 'arm64' ? '@openai/codex-win32-arm64' : '@openai/codex-win32-x64',
            'vendor',
            arch,
            'bin',
            'codex.exe',
          ),
        );
      }
      const found = candidates.find((candidate) => {
        try {
          fs.accessSync(candidate, fs.constants.X_OK);
          return fs.statSync(candidate).isFile();
        } catch {
          return false;
        }
      });
      return [provider, found || null];
    }),
  );
}

function chooseProvider(preference, available) {
  if (preference !== 'auto') return available[preference] ? preference : null;
  return ['codex', 'claude', 'openai'].find((provider) => available[provider]) || null;
}

function cliArguments(provider, { resultFile, imageFile, mcpFile }) {
  if (provider === 'codex') {
    return [
      '--ask-for-approval',
      'never',
      'exec',
      '--ignore-user-config',
      '--ignore-rules',
      '--skip-git-repo-check',
      '--ephemeral',
      '--sandbox',
      'read-only',
      '--color',
      'never',
      '--disable',
      'shell_tool',
      '--disable',
      'hooks',
      '--disable',
      'plugins',
      '--disable',
      'apps',
      '--disable',
      'browser_use',
      '--disable',
      'computer_use',
      '--disable',
      'multi_agent',
      '--disable',
      'view_image',
      '--disable',
      'image_generation',
      '-c',
      'web_search="disabled"',
      '--output-last-message',
      resultFile,
      ...(imageFile ? ['--image', imageFile] : []),
      '--',
      '-',
    ];
  }
  if (provider === 'claude') {
    return [
      '--print',
      '--output-format',
      'json',
      '--max-turns',
      '1',
      '--no-session-persistence',
      '--no-chrome',
      '--disable-slash-commands',
      '--setting-sources',
      '',
      '--settings',
      '{"disableAllHooks":true}',
      '--tools',
      '',
      '--disallowed-tools',
      'mcp__*',
      '--strict-mcp-config',
      '--mcp-config',
      mcpFile,
    ];
  }
  throw new Error('Invalid Robo CLI provider');
}

function execute(executable, args, options, input) {
  return new Promise((resolve, reject) => {
    const child = execFile(executable, args, options, (error, stdout) => {
      if (error) reject(error);
      else resolve(stdout);
    });
    child.stdin.on('error', () => {});
    child.stdin.end(input);
  });
}

function clipAnswer(text) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('Robo received an empty answer');
  const clean = text.trim();
  if (clean.length <= ANSWER_LIMIT) return clean;
  const limit = clean.charCodeAt(ANSWER_LIMIT - 4);
  const safeEnd = limit >= 0xd800 && limit <= 0xdbff ? ANSWER_LIMIT - 4 : ANSWER_LIMIT - 3;
  return clean.slice(0, safeEnd) + '...';
}

async function readAnswer(file) {
  const response = await fs.promises.open(file, 'r');
  try {
    const buffer = Buffer.alloc(ANSWER_LIMIT * 4 + 1);
    const { bytesRead } = await response.read(buffer, 0, buffer.length, 0);
    return buffer.toString('utf8', 0, bytesRead);
  } finally {
    await response.close();
  }
}

async function askCli(provider, executable, prompt, screenshot, launch = execute) {
  const name = NAMES[provider];
  if (!name || !executable || !path.isAbsolute(executable))
    throw new Error('Robo CLI is unavailable');
  if (screenshot && provider !== 'codex')
    throw new Error('Claude Code in Robo supports text questions only');
  const cwd = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'queueglow-robo-'));
  try {
    const resultFile = path.join(cwd, 'answer.txt');
    const mcpFile = path.join(cwd, 'mcp.json');
    const imageFile = screenshot ? path.join(cwd, 'capture.png') : null;
    if (imageFile) await fs.promises.writeFile(imageFile, screenshot, { flag: 'wx', mode: 0o600 });
    if (provider === 'claude')
      await fs.promises.writeFile(mcpFile, '{"mcpServers":{}}', { flag: 'wx', mode: 0o600 });
    const args = cliArguments(provider, { resultFile, imageFile, mcpFile });
    const question =
      'You are Robo, a concise question-and-answer assistant. Use only the question and any attached image. Do not run commands, open files, use tools, or modify anything. Keep your answer brief.\n\nQuestion:\n' +
      prompt;
    let stdout;
    try {
      stdout = await launch(
        executable,
        args,
        {
          cwd,
          windowsHide: true,
          shell: false,
          encoding: 'utf8',
          timeout: TIMEOUT,
          maxBuffer: PROCESS_LIMIT,
        },
        question,
      );
    } catch (error) {
      if (error.killed) throw new Error(name + ' did not respond within 45 seconds');
      if (error.code === 'ENOENT') throw new Error(name + ' CLI executable is unavailable');
      throw new Error(name + ' could not answer. Check its CLI version and sign-in status.');
    }
    if (provider === 'codex') return clipAnswer(await readAnswer(resultFile).catch(() => ''));
    let result;
    try {
      result = JSON.parse(stdout);
    } catch {}
    if (result?.type !== 'result' || result.is_error || typeof result.result !== 'string')
      throw new Error('Claude Code did not return a completed answer');
    return clipAnswer(result.result);
  } finally {
    await fs.promises.rm(cwd, { recursive: true, force: true });
  }
}

module.exports = { discoverCli, chooseProvider, askCli, clipAnswer };
