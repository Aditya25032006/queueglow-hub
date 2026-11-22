# Queueglow Hub

A small, always-on-top Windows desktop companion that folds to a pair of eyes at the top of the screen. Hover over the eyes to open it. Queueglow stays out of the taskbar and has a tray menu for opening or quitting it.

Queueglow is an independent project inspired by a desktop workflow. It is not affiliated with TwoCode. The repository contains original UI code and no reference screenshots or music artwork.

## Features

- Home clock, current track, focus timer, and coding-agent activity
- Windows media artwork and playback controls; local audio fallback
- Wi-Fi and Bluetooth on/off controls, network and device links, volume, brightness, and battery status
- Local notes, agenda, file tray, and optional clipboard history
- Codex and Claude Code hook events with one-time approval controls
- Robo questions with an optional, explicitly selected screen or window image

The app stores local data in `%LOCALAPPDATA%\Queueglow`. Clipboard capture starts off. Robo needs your own OpenAI API key, stored with Windows encryption. It sends the selected image and prompt only when you submit a question. Queueglow has no telemetry.

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

GUI smoke tests run with `node e2e/smoke.cjs`, `node e2e/music.cjs`, and `node e2e/agent.cjs`. They move the Windows cursor and exercise live OS features, so run them on a disposable desktop session. The music test needs an active Windows media session with artwork.

## Current limits

This Electron preview uses a single renderer window, but it is still much heavier than a native Windows utility. On the test PC, its Electron processes used about 520 MB of working set during a full UI smoke test. `QUEUEGLOW_SOFTWARE_RENDER=1` reduced that to about 450 MB in the same test, but may make animation less smooth. Gmail, Google Calendar, microphone input, and enforced focus blocking are not implemented.

## Contributing

Please use an issue for reproducible bugs and include Windows version, display scale, and the steps that caused the problem. Avoid posting API keys, private agent output, clipboard contents, or screenshots containing personal information.

## License

MIT. See [LICENSE](LICENSE).
