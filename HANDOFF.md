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
