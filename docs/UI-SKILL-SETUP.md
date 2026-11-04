# ReelClue — UI UX Pro Max setup and UI workflow

Updated 4 November 2026. Required for OpenCode UI work in ReelClue.

## Sources and installation status

- Website: https://www.uupm.cc/
- Official repository / installation guide: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill#installation
- OpenCode integration definition: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/blob/main/src/ui-ux-pro-max/templates/platforms/opencode.json

RC-002 installed and verified CLI **2.15.0**, Node **22.23.3**, npm **10.9.9**, and Python **3.12.0**. OpenCode successfully loaded `ui-ux-pro-max` through its skill tool. Search help and a focused Next.js query ran successfully. No design system generated; RC-003 owns that deliverable. Backend-only work need not run design searches.

## 1. Prerequisites

Check Node.js/npm and Python 3 on the implementation machine:

```bash
node --version
npm --version
python3 --version
```

On Windows, Python may instead be `py -3` or `python`; check `py -3 --version` or `python --version` and use that verified interpreter for later commands. If a prerequisite is unavailable, report it and give the owner the setup steps. Do not silently modify the owner's OS or global environment.

## 2. Official OpenCode setup

The official npm package is **ui-ux-pro-max-cli**; its executable is **uipro**. Do not substitute the older `uipro-cli` package.

Owner/local setup commands, run from the intended ReelClue checkout:

```bash
npm install -g ui-ux-pro-max-cli@2.15.0
# Change into your actual ReelClue repository root before initialization.
uipro init --help
uipro init --ai opencode
```

The global command installs development tooling, not a browser library. CLI 2.15.0 **does not support `--dry-run`** (verified unknown-option error). Preview `uipro init --ai opencode` in a fresh temporary directory, inspect generated paths, then run in the project without `--force`. In this version it also generates six unrelated skill directories; RC-002 removed only those newly generated directories and retained `ui-ux-pro-max` with its required scripts/data. Existing agent rules were unchanged. For a fresh clone, committed integration already exists; do not rerun the installer unless intentionally updating it. Preserve upstream notices and record changed CLI versions.

Expected integration files include:

```text
.opencode/skills/ui-ux-pro-max/SKILL.md
.opencode/skills/ui-ux-pro-max/scripts/search.py
.opencode/skills/ui-ux-pro-max/data/
```

Verify the actual generated paths, open the installed `SKILL.md`, and confirm the script runs. macOS/Linux example from the repository root:

```bash
uipro --version
python3 "$PWD/.opencode/skills/ui-ux-pro-max/scripts/search.py" --help
```

Windows PowerShell example, also from the repository root:

```powershell
uipro --version
py -3 "$PWD/.opencode/skills/ui-ux-pro-max/scripts/search.py" --help
```

OpenCode V2 watches local skills; discovery worked in the existing session without restart. Use `/reload` only if needed. Verify by loading skill ID `ui-ux-pro-max`, not merely checking folders. RC-002 did so successfully. Only required project-scoped integration is committed, with upstream MIT license; Python caches are ignored. Do not vendor the whole upstream repository into the application.

## 3. Generate ReelClue's design baseline in RC-003

Read existing design-system files before writing anything. Initial brief: a playful, mobile-first cinema quiz with a dark canvas, warm amber emphasis, readable clues, one-thumb controls, restrained motion, and the Next.js + Tailwind + shadcn/ui stack. This tool supplies recommendations; Andre reviews the synthesized result in the RC-003 PR.

From the repository root, preview a product-focused recommendation:

```bash
python3 "$PWD/.opencode/skills/ui-ux-pro-max/scripts/search.py" "movie quiz playful cinema" --design-system -p "ReelClue" -f markdown
```

Inspect relevance before persistence. If results target an unrelated product, narrow the query once; record an unresolved match instead of pretending it succeeded. After checking fit, persist the reviewed candidate with the output directory explicitly set to the project root:

```bash
python3 "$PWD/.opencode/skills/ui-ux-pro-max/scripts/search.py" "movie quiz playful cinema" --design-system -p "ReelClue" -f markdown --persist --output-dir "$PWD"
```

For PowerShell use the same one-line commands with `py -3` instead of `python3`. The resulting project baseline is expected at:

```text
design-system/reelclue/MASTER.md
design-system/reelclue/pages/
```

Do not add `--force` over an existing Master or page override without explicit authorization for that replacement. Existing decisions must be read first; edit a reviewed proposal within the current ticket's scope. Do not persist irrelevant or empty search results. Record selected styles, colors, typography, spacing, radii, states, rationale, mobile rules and anti-patterns; reconcile proposed colors with PRD section 13 rather than silently replacing the brief.

For implementation details, use a separate focused query matching the actual installed versions/stack, for example:

```bash
python3 "$PWD/.opencode/skills/ui-ux-pro-max/scripts/search.py" "responsive game layout" --stack nextjs
python3 "$PWD/.opencode/skills/ui-ux-pro-max/scripts/search.py" "accessible answer combobox" --stack shadcn
python3 "$PWD/.opencode/skills/ui-ux-pro-max/scripts/search.py" "responsive clue card" --stack html-tailwind
```

These are starting examples, not a requirement to repeat all searches on every small edit. Use the smallest relevant query for the task, keep private data out of queries, and report actual outputs. The examples have not been executed as part of this documentation change.

## 4. Required behavior on every UI ticket

1. Read the installed skill instructions, the approved Master, and the relevant page override if one exists.
2. Inspect the existing route, semantic tokens and installed framework versions before changing UI.
3. Use product-wide design guidance for a new visual direction; use focused domain/stack guidance for a component or interaction issue. Reuse approved decisions across pages rather than resetting the theme for each ticket.
4. Map recommendations into the existing Tailwind/shadcn semantic variables. Avoid hardcoded per-page palettes or a second styling system. Keep the planned stack; recommendations do not authorize unrelated libraries, GSAP, subscriptions, or a different frontend framework.
5. For a page-specific exception, document the rationale in `design-system/reelclue/pages/<page>.md` and include it in that ticket's PR.
6. Validate the real UI and include query/rationale summary, design-system changes, phone/desktop screenshots and manual review steps. Generated guidance is not proof of accessibility or usability.
7. Stop for Andre's review before merge, following the existing one-ticket rule.

## 5. UI acceptance checklist

- Shared semantic color/typography/spacing/state tokens; one coherent game identity.
- Reflow at 320px and verification at 360/390/768/1440px; no horizontal scroll or clipped titles, names, genre chips and labels.
- Touch controls at least 44px, readable 16px inputs, usable virtual-keyboard and safe-area behavior.
- Keyboard-operable autocomplete/dialogs, visible unoccluded focus, useful accessible names and feedback.
- Contrast checked on actual chosen colors; semantic feedback includes text/icons, not only color.
- Clear loading, error, disabled, submitting, reveal and recovery states; no misleading success after failed writes.
- Motion follows reduced-motion preferences and does not compromise focus or final state.
- No hidden answer in alt text, metadata, DOM or unrevealed poster source; preserve all gameplay/API/ownership requirements.
- SVG icon set remains consistent with Lucide/shadcn conventions.

RC-023 checks these criteria across all implemented pages. Tool recommendations support the existing PRD requirements and cannot change scoring, difficulty, data privacy, provider attribution or the mandatory review/merge gate.
