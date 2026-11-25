# Queueglow Hub 0.1.5 Linux smoke test

Verified on Ubuntu x86-64 in a Wayland desktop session. Executed the packaged AppImage directly with a temporary profile and data directory. The test used a loopback Chromium DevTools port to inspect the packaged renderers and call their normal preload APIs. The normal Electron sandbox and AppImage mount were used.

| Check | Observed result |
|---|---|
| Direct launch | Passed. Electron loaded from the mounted AppImage. |
| Island | Passed. The React renderer displayed the clock. |
| Notes | Passed. Saved a test note and read it back through IPC. |
| Settings | Passed. A separate renderer loaded and exposed its preload API. |
| Quit | The smoke test requested quit through IPC and the test process exited successfully. |
| Media, volume, brightness, Wi-Fi and Bluetooth | Each call returned `Windows media controls are unavailable`. |
| In-app updates | Runtime reported `supported: false`. |
| Launch on login | Settings returned `canLaunchOnLogin: false`. |

Source inspection found that agent hook registration generates a `powershell.exe` command and wallpaper accent detection returns null on non-Windows platforms. These were source-verified only. The Windows system-settings shortcuts use `ms-settings:` URLs and have no Linux implementation. The smoke test did not register hooks or modify system preferences.

Chromium logged `'--ozone-platform=wayland' is not compatible with Vulkan`. The renderer and IPC checks above passed with the default launch settings.

## Linux desktop integration retest

The rebuilt AppImage passed the renderer, note, and settings checks on Ubuntu GNOME Wayland. The packaged UI read this device's PipeWire volume, GNOME brightness, UPower battery, NetworkManager Wi-Fi and BlueZ Bluetooth state. GNOME wallpaper sync returned a valid accent color. A local D-Bus MPRIS test player supplied metadata and accepted pause and absolute seek through the packaged UI. The app reported launch-on-login support and its autostart entry was created and removed in a temporary XDG configuration directory.

Hardware writes and login after a full logout were not exercised. PowerShell agent hooks and GitHub in-app updates still require Linux implementations. MPRIS artwork is supported for local image files. The recurring Wayland Vulkan diagnostic did not stop launch.

The desktop shortcut build passed an isolated packaged check. Settings saved a Linux `.desktop` entry through the preload API. The island opened the shortcut through GIO, and the entry's test command created its expected marker file. The store test also verified persistence and invalid path rejection.

AppImage update verification passed in two parts. The executable from the normal GitHub-configured build reported that manual in-app updates are supported. A separate unpacked release build, with its metadata pointed at a temporary loopback server, discovered a test update, downloaded it, verified its checksum, and reached the restart-to-install state. Installation of a newer version from GitHub remains unverified. The production release needs both `latest-linux.yml` and the AppImage asset named exactly as listed in that file.

The loopback updater also passed installation using a disposable 0.1.5 copy and a separately built 0.1.6 AppImage. The installed bytes matched the 0.1.6 build, the isolated launch-on-login entry followed the renamed artifact, and launching that artifact reported version 0.1.6. The fixture's HTTP server does not implement Range requests, so the updater used a full download. A GitHub-hosted Linux release remains untested.

The connectivity adapter returned the connected headset name from a controlled BlueZ command fixture. The host had a powered Bluetooth adapter and no connected devices at the time of testing. PipeWire volume and GNOME brightness both accepted a write of their existing value and returned that value. The local build's Gmail client ID is empty, so Gmail sign-in still requires publisher OAuth setup.

GNOME launcher integration passed. The desktop entry validated and GIO launched it while the existing service stayed active. In an isolated packaged test, a second AppImage invocation exited and expanded the existing island without creating a second renderer.

A packaged run in a disposable profile started and stopped a one-minute Focus timer, added and removed an Agenda event, and accepted and removed a four-byte file through the Tray drop API. Wi-Fi and Bluetooth turned off and back on through the packaged IPC handlers against isolated NetworkManager and BlueZ command fixtures. Neither physical radio was switched during this test.

Linux Connections reports that the current agent hooks require Windows. A packaged smoke test checked that both hook registration IPC routes reject the operation and leave the isolated Codex and Claude configuration paths untouched. Removal of an existing Queueglow hook remains available.

The live Ubuntu radio test passed using the Linux adapter. Bluetooth and Wi-Fi each read back as off after disabling and on after restoring. Wi-Fi reassociated, both radios ended in their original enabled state, and the regular AppImage service stayed running.

The GitHub-hosted update passed on the fork. A disposable packaged 0.1.5 client found release `0.1.6`, downloaded and checksum-verified the AppImage, then installed it. The installed bytes matched the published asset, the isolated autostart entry followed the new filename, and the installed app reported 0.1.6 at launch. The regular 0.1.5 service remained running.

Echo Music and Queueglow were tested separately and together. The packaged Music pane displayed an Echo track and routed transport and visibility commands against a local socket fixture. A real Echo build restored two local WAVs from a disposable queue and played them without a window. Next, pause, show, hide while playing, and quit passed over the same bridge. The installed Echo Music instance reports its window hidden, and both desktop processes are active.
