# QueueGlow skill review

Commit dates come from GitHub commit metadata, shallow checkouts, or the default branch's commit feed. Compatibility reflects maintainer documentation and the skill files. The tools have not been installed or benchmarked here.

| Candidate | Purpose | Codex compatibility | Latest observed commit | License | Documented install or use | Risk and recommendation |
|---|---|---|---|---|---|---|
| [caldoai/skills](https://github.com/caldoai/skills) | Untangle coupled code | Documents Codex support and ships an `untangle-codebase/SKILL.md` | 2026-11-18 | MIT | `npx skills add caldoai/skills --skill untangle-codebase` | Shortlist the single skill for the optional pass. Prefer reviewing and copying the pinned skill files to avoid running the installer. |
| [Graphify](https://github.com/Graphify-Labs/graphify) | Build a repository knowledge graph | Explicit Codex installer and `$graphify` invocation | 2026-11-24 | Apache-2.0 | `uv tool install graphifyy`, then `graphify install --platform codex` | Python dependencies and generated index add setup and maintenance. Defer until targeted searches become a bottleneck. The vendor's token claim is unverified here. |
| [Ponytail](https://github.com/DietrichGebert/ponytail) | Enforce lean implementation and review | Native Codex plugin and optional instruction-only materials | 2026-11-22 | MIT | `codex plugin marketplace add DietrichGebert/ponytail`, then `codex plugin add ponytail@ponytail` | Full plugin asks users to trust two lifecycle hooks. Shortlist the instruction-only workflow for the optional lean-code pass. Vendor benchmark claims are unverified here. |
| [code-review-graph](https://github.com/tirth8205/code-review-graph) | MCP dependency and impact analysis | Codex MCP and skill documented | 2026-11-12 | MIT | `uv tool install code-review-graph`, then `code-review-graph install` | Installer configures MCP and can register hooks. Defer until the repo needs repeatable impact analysis. |
| [Anthropic skills](https://github.com/anthropics/skills) | Skill format and examples | Portable as a format reference. Marketplace setup targets Claude Code. | 2026-11-16 | Mixed. Check each skill's license. | Read the standard and individual examples in place. | Use as a reference. Check licensing and host-specific scripts before reusing individual examples. |
| [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) | Engineering verification and review checklists | Native Codex plugin and individual skills documented | 2026-11-23 | MIT | `npx skills add addyosmani/agent-skills --skill code-review-and-quality` | Shortlist one checklist for reviewing an optional cleanup. Bulk installation adds overlapping guidance. |
| [Karpathy guidelines](https://github.com/forrestchang/andrej-karpathy-skills) | Assumptions, surgical changes, and verification | Portable Markdown. The documented plugin path targets Claude Code. | 2026-04-20 | MIT, per README | Read the guidelines in place or copy the relevant text into agent instructions. | Low runtime risk as text. The current goal already specifies these behaviors. |
| [Everything Claude Code](https://github.com/affaan-m/everything-claude-code) | Cross-harness workflows, sessions, and cost controls | Native Codex plugin and setup documented, with platform-specific coverage | 2026-11-20 (commit feed) | MIT | `npx ecc-universal@2.2.3 setup` or native plugin path | Broad footprint across commands, hooks, and configuration. Skip for this port. |

## Additional GitHub candidates

- [Impeccable for Codex](https://github.com/byronwall/codex-skills/blob/main/impeccable/SKILL.md) for visual hierarchy, accessibility, and responsive UI review after launch verification.
- [Codex PR Body](https://github.com/openai/codex/blob/main/.codex/skills/codex-pr-body/SKILL.md) as a reference for keeping a future PR description and verification checklist current. Its workflow uses `gh`.

The shortlist is for optional follow-up after the AppImage smoke test. Installer internals still need review before any script execution or installation.
