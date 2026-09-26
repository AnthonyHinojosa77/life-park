# Validation Record

Validated September 2, 2026 Central / September 3 UTC on this MacBook.

## Current installation

| Check | Result |
| --- | --- |
| Canonical skill structure | Pass: all 15 skills returned `Skill is valid!` from the bundled Codex validator, run with PyYAML in an isolated `uv` environment. |
| Supplied sources | Pass: all 11 archived sources match the original files byte for byte; all eight newly supplied skill bodies are unchanged. |
| Runtime adaptation | Pass: Claude-only manual activation fields were translated into Codex metadata; Claude installs retain manual activation. The ADHD YAML description was quoted without changing its text. |
| Python syntax | Pass: the installer and bundled creator Python files compile. |
| Managed-file integrity | Pass: `python3 scripts/manage.py verify` confirms all 81 deployed files match their canonical bytes or runtime render. |
| Installer idempotence | Pass: a second dry run reported no `UPDATE` operations. |
| Fresh Codex discovery | Pass: a new `codex app-server` process force-reloaded `skills/list` and returned all 15 managed skills from `~/.agents/skills/`, enabled, with no duplicate managed names. |
| Creator name collision | Resolved: the supplied workflow is `claude-skill-creator`; Codex's built-in `skill-creator` remains available. |
| Earlier dependency gap | Resolved: `test-protocol` is now installed alongside `show-your-work`. |
| Creator resources | Pass: 17 referenced resources from the matching installed official Claude plugin are bundled and deployed to both runtimes. |
| Claude Code discovery | Filesystem installation verified. Interactive `/skills` discovery and a behavioral invocation were not run in a separate Claude session. |

These checks prove local installation, file integrity, and fresh Codex discovery. They do not establish skill performance on every future task.

## Cloud copies

The toolkit was moved to the dedicated OneDrive folder listed in `CLOUD_LOCATIONS.md`. A complete 78-file mirror was placed in the mounted Google Drive `My Drive` folder. A fresh inventory matched every relative path and SHA-256 byte for byte. Google Drive assigned an item ID to all 78 files, and connector metadata readback confirmed the `AI Agent System` folder in My Drive.

The Google Drive connector's create-folder action returned `ACCESS_TOKEN_SCOPE_INSUFFICIENT`. The existing Google Drive for desktop mount provides a separately authorized filesystem sync path; no connector permissions were changed.

## Computer History review provenance

The original review synthesized 11 six-hour summaries, screened 131 ten-minute summaries, inventoried 6,065 pre-task events across 46 retained segments, and checked targeted raw evidence. That research and its coverage limits remain in `history/`. This skill-import turn did not repeat or expand the history review.

## GitHub repository copy (2026-09-03)

The repository at `AnthonyHinojosa77/tony-harness` was checked against the package above after the Google Drive import.

| Check | Result |
| --- | --- |
| Installer syntax | Pass: `scripts/manage.py` compiles. |
| Skill names | Pass: all 15 `skills/*/SKILL.md` frontmatter names match their folder names. |
| Supplied `.skill` archives | Fail: `repo-review.skill` and `show-your-work.skill` arrived with their binary bytes replaced by text-decoding artifacts and cannot be opened. They were removed from the repository. The working copies in `skills/repo-review/` and `skills/show-your-work/` are intact, and the original archives remain in the OneDrive package. |
| Stale duplicates | Removed: older single-file variants of `file-pr`, `babysit-pr`, and `html-communication` under `skills/` and `.agents/skills/` that referenced a checklist no longer present in `AGENTS.md`. The folder versions under `skills/<name>/SKILL.md` are canonical. |
| License | Added the `LICENSE` file the README already referenced. |
| Integrity list | `artifacts.sha256` regenerated for the repository's current contents. Verify with `sha256sum -c artifacts.sha256`. |

Runtime installation on the MacBook (`~/.codex`, `~/.claude`) was not re-verified from the repository; run `python3 scripts/manage.py verify` locally for that.

The integrity list covers the toolkit only. The `app/` directory (the LifePark web app) is excluded from `artifacts.sha256`; its own checks are `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` inside `app/`.
