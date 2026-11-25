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
