# Linux AppImage handoff

Milestone 1 passed on `linux-build`. The checkout is from the user's fork. Node 24.22.3 and npm 11.19.1 ran `npm ci` successfully (329 packages added, 330 audited, six moderate audit findings). The lockfile was kept as-is. Skill evaluation is in [SKILL-REVIEW.md](SKILL-REVIEW.md).

Use `export PATH="/tmp/queueglow-node.CurLap/node-v24.22.3-linux-x64/bin:$PATH"` while the verified local runtime is available.

Next step is to run the baseline `npm test` and `npm run build`.

Milestone 2 passed. The baseline test assumed a Windows path separator and failed with `false !== true`. The test now checks the full platform-native path. `npm test` reported 22 passes, four skips, and zero failures. `npm run build` completed with two existing lucide-react module-directive warnings. Next step is to add the Linux x64 AppImage target.

Milestone 3 passed. The package configuration declares an x64 AppImage. `npm test` reported 22 passes, four skips, and zero failures. Next step is the specified electron-builder invocation with publishing disabled.

Milestone 4 passed. Electron Builder 26.18.0 reported `building target=AppImage arch=x64` and built the embedded block map. The artifact is `release/installer/Queueglow Hub-0.1.5.AppImage` (SHA-256 `fc5f850ef6483c53c92f26c98258208b6c80cd293a44d9c388c0cbc0f855f83c`). Packaging used the default Electron icon and Utility category, and warned that desktop environments may not associate the window with its desktop entry. Next step is to launch the artifact in an isolated test profile.

Milestone 5 passed. Direct AppImage launch on Ubuntu Wayland rendered the island clock and Settings and passed a notes IPC round trip. See [SMOKE-TEST.md](SMOKE-TEST.md) for the Linux limitations and Wayland warning. Required milestones are complete. The optional untangle and lean-code passes require user approval of the shortlist.

Linux desktop integration follow-up. PipeWire, GNOME, NetworkManager, BlueZ, UPower, and MPRIS adapters now feed the existing UI. GNOME wallpaper accents and XDG autostart are available from the AppImage. Tests reported 22 passes, four skips and zero failures. A staged AppImage passed the packaged checks before replacing the previous build. See the retest in SMOKE-TEST.md. The PowerShell hooks and in-app updater remain open for full parity.

Desktop app shortcuts now accept Linux `.desktop` entries and launch them via GIO. The rebuilt AppImage passed the packaged shortcut check, and the suite reported 22 passes, four skips and zero failures. Remaining full-parity items include agent hooks, in-app updates, and physical integration checks.

Linux manual in-app updates are wired through the existing updater. The current AppImage SHA-256 is `953cf8f3b7b7150b5c16951d512cea56ca46688d65baff0e5776033ab266e681`. The built AppImage reports support and a separate loopback release fixture passed update discovery and download. No GitHub release was published. A real newer Linux release with matching AppImage metadata is needed for end-to-end update installation. The hook decision is pending.

Updater installation retest passed with temporary builds: a loopback feed served version 0.1.6, which replaced the disposable 0.1.5 AppImage, migrated its isolated autostart entry, and reported 0.1.6 on launch. No GitHub release or real application data was used. Remaining gates are the agent-hook scope decision, live GitHub release verification, and hardware or login checks that would disrupt the current session.

Connected BlueZ device names now reach the Bluetooth tile. Package SHA-256 is `64f81cab966b7b738bcafeede8cff0e1212b9b56e17bbf4896ead079bd5bef4c`. Tests reported 22 passes, four skips and zero failures. The current build also needs a configured public Gmail OAuth client ID. Keep the full parity goal open for remaining integration gates.

Registered Queueglow Hub in this device's application menu. The Linux AppImage reuses the running instance, and the updater migrates the local launcher path if it renames its target during installation. The current AppImage SHA-256 is `ffb85315025356f1650cba47e4ea501c6d96dfca81f56af88b2fd46ac49e8389`. Tests reported 22 passes, four skips and zero failures. The isolated second-launch smoke test passed.

The local tag workflow now stages Linux and Windows assets in separate jobs and creates one GitHub release after both jobs succeed. Linux asset staging was verified against the real AppImage and its SHA-512 metadata. Windows staging used a file fixture. A real GitHub Actions run and release remain pending. No changes were pushed and no tag was created.

Expanded the packaged smoke check to cover Focus, Agenda, Tray, and both radio state transitions against isolated command fixtures. Live radio toggles, interactive Gmail authorization, login after logout, and a GitHub-hosted release remain external verification steps. The Linux agent hook decision is still pending.

Linux Connections now prevents registering the existing Windows-only hook. A packaged test verified the UI and both IPC routes without creating either provider configuration file. AppImage SHA-256 is `c7034104e6b4f82cb2470b6f4ec2740f17486a465fcfe69cb1d4695828ff1aa5`. Native Linux hooks remain gated on the scope decision.

The approved live Bluetooth and Wi-Fi cycle passed and both radios were restored. The GitHub test release is approved for the fork, but the local Git push dry run failed with `fatal: could not read Username for 'https://github.com': terminal prompts disabled`. The connected Codex GitHub toolset has no release creation or asset upload action. A release-capable authenticated GitHub session is needed.

Fork updater test assets are staged locally under `/tmp/queueglow-fork-release.Vqv1Hx`. The `upload/` folder contains the normalized 0.1.6 AppImage and matching `latest-linux.yml`, and `client/` contains a disposable 0.1.5 AppImage. Both embed the fork as their update source. Use tag `0.1.6` for this Linux-only test so it does not trigger the production `v*` tag workflow. The running 0.1.5 app and its feed were not changed. Publication is waiting for an authenticated release-capable GitHub session.

Published and verified [the fork's Linux updater test release](https://github.com/Aditya25032006/queueglow-hub/releases/tag/0.1.6). Its source branch is `linux-updater-test-0.1.6` at `3adc7bf`. The full `linux-build` push was rejected because the CLI OAuth authorization does not include workflow editing. The test branch uses identical app source and the fork's original workflow. A disposable fork-configured AppImage completed the real GitHub download, install, autostart migration, and launch.

Fixed island anchoring and mouse input on this GNOME Wayland device via XWayland. The local service and desktop entry pass `--ozone-platform=x11`, and AppImage desktop integration advertises the same flag. For direct shell launches on Wayland with XWayland available, pass that flag explicitly. The rebuilt AppImage verified hover and click expansion in an isolated renderer and native X11 geometry at the top horizontal midpoint. Gmail accepts `QUEUEGLOW_GOOGLE_CLIENT_ID` at runtime, but the local app still has no publisher client ID.

Fixed a native X11 regression found after renderer expansion tests passed. An empty shape after unfolding produced a zero-sized native window. The Linux X11 path now explicitly restores the full window rect. A desktop X11 click verified the visible expanded 660×300 window on this device.

Gmail and Outlook now accept separate public OAuth client IDs from the Mail view and use browser PKCE flows. The packaged test verified local client setup and a Codex event through the registered Linux hook. The Microsoft authorization URL and callback passed an isolated test. Live mail access still requires provider registration and interactive sign-in. The local Codex lifecycle hooks were registered. Trust is managed by Codex in a fresh CLI session.

Robo recognizes the Linux Codex executable bundled with the desktop app even with a minimal desktop PATH. The installed CLI is signed in with ChatGPT, and the packaged Robo IPC returned a real test answer with Codex selected. Connected Gmail and Outlook inboxes now refresh every minute and can notify through the desktop notification center. A fixture verified baseline suppression, deduplication, private notification text, and routing to the right Mail view. Neither mailbox has authorized a session on this device. GNOME pop-up banners are disabled globally.

Google rejected the locally saved Gmail OAuth client with `redirect_uri_mismatch`. At the user's request, removed Gmail from the UI, renderer bridge, OAuth backend, polling, release configuration, and local profile. The rebuilt AppImage passed the Outlook-only Mail smoke test, with 22 passing tests and four skips. Outlook still requires its own sign-in. No Gmail session existed.

Removed the Mail pane and Outlook integration. Music now discovers a compatible local Echo Music instance and displays its track, playback and background state. The tray menu can start, show, control or quit Echo Music. The packaged Queueglow test passed against a local socket fixture. Queueglow tests reported 20 passes, four skips and zero failures.

Built Echo Music's desktop JAR offline and updated the existing local installation. The real audio smoke test passed with two silent WAV fixtures in an isolated queue, including playback progress while hidden, transport, and quit. Echo Music was started with `--tray` and is running hidden. The Echo source changes are in the separate local Echo Music checkout and were not pushed.

The Echo controls moved beside the cover so the title and transport buttons have room. The native Echo bridge now supplies the cover URL, and Queueglow accepts HTTPS artwork from the supported YouTube image hosts. Packaged testing verified image loading, title updates, and visible Next and Previous buttons against a local Echo fixture. The Queueglow suite reported 20 passes and four skips.

Queueglow Hub 0.1.7 is the final Linux AppImage for the requested scope. The packaged Music smoke test verified the Echo track title, cover image, and both transport buttons. The unit suite reported 20 passes, four skips, and zero failures. The AppImage is in `release/installer/Queueglow-Hub-0.1.7.AppImage`, with matching `latest-linux.yml`. The package is configured to check the user's fork for updates. Echo Music background playback depends on the separately installed, compatible Echo Music desktop build. Gmail and Outlook were removed at the user's request.
