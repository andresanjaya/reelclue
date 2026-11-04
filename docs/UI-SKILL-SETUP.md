# ReelClue — UI UX Pro Max setup and UI workflow

Updated 4 November 2026. Required for OpenCode UI work in ReelClue.

## Sources and installation status

- Website: https://www.uupm.cc/
- Official repository / installation guide: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill#installation
- OpenCode integration definition: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/blob/main/src/ui-ux-pro-max/templates/platforms/opencode.json

This change documents the required setup. It does not install the tool on Andre's computer, run the design generator, or claim that a design system already exists. RC-002 performs and records setup; RC-003 generates the reviewable design baseline. Later UI tickets reuse the approved baseline. Backend-only work need not run design searches.

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
npm install -g ui-ux-pro-max-cli
# Change into your actual ReelClue repository root before initialization.
uipro init --ai opencode --dry-run
uipro init --ai opencode
```

The global command installs the development CLI, while `--ai opencode` creates the repository's OpenCode integration. It does not add a browser library to ReelClue. Use the installed CLI's help/current official README if an option differs at implementation time; record the actual installed version and do not guess a published npm version from a repository source file. Inspect the dry-run and preserve existing project rules. The instructions here authorize documentation only; actual installation belongs to RC-002/local owner setup.

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

If OpenCode is already open, reload/restart its project session if needed to discover the new local skill. Confirm discovery from the actual OpenCode session rather than assuming a folder alone proves activation. Record version, paths and verification in RC-002/its PR. Commit only intentional project-scoped integration/configuration needed for reproducibility, retain applicable upstream license notices when redistributing assets, and exclude caches/machine-specific files. Do not vendor the whole upstream repository into the application.

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
