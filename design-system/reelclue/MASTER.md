# ReelClue — design baseline

RC-003 candidate, awaiting Andre's PR review. Source: PRD §13 plus reviewed UI UX Pro Max guidance, 4 November 2026. No pre-existing Master or page override was present. This file is the explicit project-root baseline, not unedited generator output or proof of accessibility compliance.

## Direction and recommendation fit

Small, playful cinema quiz. Dark canvas, warm amber, clear typography and generous space; no dashboard chrome. Initial query `movie quiz playful cinema --design-system -p ReelClue -f markdown` matched Dark Mode (OLED), cinematic gold and readable sans-serif; retain those principles. Reject its conversion funnel, multiple CTAs, booking/trailer advice and purple border palette: wrong product and scope. One narrower retry `casual trivia game dark` produced Claymorphism, pink, handwritten fonts and testimonials; no verified full-product match. Do not persist that output. This manually synthesized baseline keeps PRD choices and relevant recommendations only.

Focused `responsive focus reduced motion --stack html-tailwind` matched reduced-motion and visible-focus guidance; applied. `combobox keyboard selection --stack shadcn` returned Select, unsuitable for editable autocomplete; retry `combobox autocomplete` found no match. Use native radio groups and WAI-ARIA editable combobox behavior rather than pretending Select guidance covers autocomplete. Existing Next.js guidance from RC-002 remains: server components by default, static metadata API. No new design stack or animation library.

## Semantic tokens

One source in `src/app/globals.css`: shadcn CSS variables mapped through Tailwind v4 `@theme inline`. No page-specific palettes. Dark-only MVP; `color-scheme: dark`.

| CSS variable | Value | Use |
| --- | --- | --- |
| `--background` | `#10131A` | Page canvas |
| `--foreground` | `#F6F7FB` | Main text |
| `--card`, `--popover` | `#1A2030` | Panels, suggestion list |
| `--card-foreground`, `--popover-foreground` | `#F6F7FB` | Panel text |
| `--muted`, `--secondary`, `--accent` | `#252D40` | Quiet surfaces / hover / skeleton |
| `--muted-foreground` | `#ADB5C6` | Supporting text, placeholders |
| `--secondary-foreground`, `--accent-foreground` | `#F6F7FB` | Hover / secondary text |
| `--primary`, `--ring` | `#F4C95D` | Primary action, selected indicator, focus |
| `--primary-foreground` | `#171717` | Text on amber |
| `--border`, `--input` | `#6B7892` | Visible control edges (raised after measured 2.92:1 failure on accent) |
| `--success` | `#86E0AC` | Success text/icon |
| `--destructive` | `#FFAAAA` | Error text/icon |

All text pairs target ≥4.5:1; control boundaries/focus ≥3:1. Measure actual tokens in runnable UI tests; never infer pass from recommendations. Semantic feedback always includes icon + words. Do not place pale text on amber.

## Type, space and shape

- One local system sans-serif stack: Arial, Helvetica, sans-serif; no remote font request. Plain, quick to load; revisit licensed self-hosted font only if owner wants new identity.
- Body and inputs 16px, line-height 1.5. Supporting labels 14px only outside inputs. Mobile headings 24–32px; desktop hero up to 48px. No letter-spaced all-caps paragraphs.
- Tailwind spacing unit 4px: 8/12/16/20/24/32/48px. Mobile gutters 16px, panel padding 16–20px, section gaps 24px. Content max 1120px; play column max 640px.
- Control radius 8px, card radius 12px, badges fully rounded. Subtle borders, no glow or heavy glass effects.
- Lucide outline icons 20px (decorative beside text, `aria-hidden`). No emoji navigation, fake TMDB logo or movie artwork.

## Components and interaction

- Minimum hit box 44×44 CSS px including radio cards, level choices, buttons, combobox and options. Long names/titles wrap; `min-width: 0` on grid children.
- Mode card is a labelled native radio with name, icon, description and visible selected indicator. Six modes, one selection. Disabled explains unavailability; selection never creates session.
- Level selector is a labelled native radio group; Easy / Medium / Hard remain movie familiarity, not clue blur strength.
- Game header displays round/count, mode, level, attempts and score as text plus native progress. No timer and no competing navigation.
- Feedback keeps an always-mounted polite status region; success/error icon + message, no forced focus or color-only meaning.
- Loading skeleton reserves clue/answer space, exposes one loading label, decorative shapes hidden. No animated pulse under reduced motion.
- Editable combobox receives safe options from parent; no provider/network logic here. Title + year visible, opaque option handle never treated as answer key. Arrow keys navigate, Enter selects only while list open (even empty/loading); Escape closes; Tab leaves naturally. Input focus remains during selection. Closed-list Enter may submit parent form; IME composition never selects/submits. Editing clears selected identity. Separate Submit button. Pending/error/empty search states accessible. Actual search/debounce/cancellation belongs to RC-010.
- Focus: solid 2px amber outline with 3px offset; selected state also uses check/dot and label, not amber alone. Disabled uses native disabled semantics, no false action.
- Hover changes color/border only; 180ms transitions, no transforms or layout shifts. `prefers-reduced-motion` disables animations/transitions. No confetti, autoplay or mandatory sound.

## Responsive and scope boundaries

Mobile first; normal page scrolling with safe-area padding, no fixed-height viewport lock or sticky overlay. One-column play; wider preview may show samples side by side without changing reading/tab order. Combobox list stays in document flow so keyboard/focus/suggestions are not covered by footer. Validate 320/360/390/768/1440px, long text, keyboard and reduced motion. Physical Safari/iOS input check remains later launch item.

`/ui-preview` is explicitly labelled component demo, with fictional suggestions and local-only interactions; no scoring engine, session creation, game routes or fake working Start. Home remains placeholder until RC-011. UI primitives adapted from shadcn new-york-v4 Input, Button and Skeleton (MIT), retaining only current needs; native platform controls for radio/progress avoid extra primitive dependencies.

Later UI tickets read this Master and `pages/<page>.md` if present. No override yet. Material changes require review; never regenerate with `--force` or replace theme silently.
