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
