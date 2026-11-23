# Queueglow Hub

A compact, always-on-top Windows desktop companion that folds to a pair of eyes at the top of the screen. Hover over the eyes to open it, or choose click opening in Settings. Queueglow stays out of the taskbar and has a tray menu for opening or quitting it.

Queueglow is an independent project inspired by a desktop workflow. It is not affiliated with TwoCode. The repository contains original UI code and no reference screenshots or music artwork.

## Features

- Home clock, current track, focus timer, and coding-agent activity
- Windows media artwork and playback controls; local audio fallback and optional synced lyrics
- Wi-Fi and Bluetooth on/off controls, network and device links, volume, brightness, and battery status
- Local notes, agenda, file tray, and optional clipboard history
- Codex and Claude Code hook events with one-time approval controls
- Robo questions through the installed Codex or Claude Code CLI, with an optional OpenAI API key. Explicit screen attachments are supported by Codex and OpenAI.
- A separate Settings window for providers, shortcuts, notifications, island appearance, and startup

Every island tab fits without vertical scrolling. Longer lists and Robo answers use page buttons. Click the Wi-Fi and Bluetooth icons at the top left, then click a tile to switch that radio on or off; the tile shows the confirmed state.

The app stores local data in `%LOCALAPPDATA%\Queueglow`. Clipboard capture and online lyrics start off. When you enable lyrics in Island settings, Queueglow sends the current track title and artist to [LRCLIB](https://lrclib.net/docs) and caches the result for the session. Robo sends a question to your selected provider only when you submit it. If you explicitly attach a screen or window, that image goes to the provider with the question. An optional OpenAI key is stored with Windows encryption. Queueglow has no telemetry.

## Download and run

Download the portable ZIP from [Releases](../../releases) when a release is available. Extract the whole folder and run `QueueglowHub.exe`. Windows may warn because the preview is unsigned. Use the tray icon to reopen the island or quit. Closing the window leaves the tray process running.

Windows 10 or 11 is required. Wi-Fi, Bluetooth, brightness, battery, and media information depend on the PC's hardware, active apps, and Windows permissions. A radio toggle may be refused by Windows policy; the app reports that error.

## Build from source

Install Node.js 24 and npm on Windows, then run:

```powershell
npm ci
npm run build
npm test
npm run desktop
```

To create a portable app folder, run `npm run package:win`. Output goes to `release/QueueglowHub-win32-x64`. The source checkout does not need a Python environment or a prebuilt hook executable; the coding-agent hook is `electron/agent_hook.ps1`.

GUI smoke tests run with `node e2e/smoke.cjs`, `node e2e/music.cjs`, `node e2e/agent.cjs`, `node e2e/settings.cjs`, and `node e2e/layout.cjs`. `node e2e/robo.cjs` submits one short question through an installed, signed-in Codex CLI. `node e2e/radios.cjs` checks radio status; set `QUEUEGLOW_TEST_RADIO_TOGGLE=1` to switch Bluetooth off and back on during the test. These tests move the Windows cursor and exercise live OS features, so run them on a disposable desktop session. The music test needs an active Windows media session with artwork.

## Current limits

This Electron build uses one island renderer and opens the Settings renderer only when requested. It remains heavier than a native Windows utility: a full island smoke test measured about 507 MB of combined process working set and 304 MB of private bytes on the test PC. `QUEUEGLOW_SOFTWARE_RENDER=1` can lower GPU memory but may make animation less smooth. Gmail, Google Calendar, microphone input, and enforced app or site blocking are not implemented. Robo image attachments are implemented but have not completed a live provider test.

## Contributing

Please use an issue for reproducible bugs and include Windows version, display scale, and the steps that caused the problem. Avoid posting API keys, private agent output, clipboard contents, or screenshots containing personal information.

## License

MIT. See [LICENSE](LICENSE).
