# ReelClue — About & Attribution Page Baseline

Source: PRD §17, §18, Issue #21, and design-system/reelclue/MASTER.md.

## Purpose
Informational page detailing ReelClue's purpose, official TMDB metadata attribution, non-commercial playground status, explanation of familiarity proxies, clue spoiler advisory, and anonymous privacy/data lifecycle.

## Hierarchy & Layout
- Mobile-first, single-column reading layout (`max-w-280` container, article width `max-w-3xl`).
- Global header with ReelClue logo and direct links to Stats and Play Now.
- Clear vertical rhythm (16/24/32px section gaps) following the 4px Tailwind spacing token system.
- Cards (`bg-card`, border `border-border/50`, radius `rounded-xl`) grouping distinct topical areas:
  1. TMDB attribution and required non-endorsement notice.
  2. Movie familiarity tiers & metrics explanation.
  3. Clues, synopses, and spoiler expectations.
  4. Privacy, cookies, and data retention schedules.
  5. Non-commercial hobby scope and intellectual property acknowledgment.
- Footer with sitewide navigation and attribution summary.

## Component & Asset Rules
- **ReelClue Branding**: Primary heading and hero identity.
- **TMDB Logo**: Official vector asset (pill mark + letters in official `#90cea1` → `#3cbec9` → `#00b3e5` gradient, aspect ratio preserved 273.42:35.52), visibly subordinate to ReelClue branding (contained within the attribution card at `max-w-36`).
- **Required Notice**: Verbatim text: *"This product uses the TMDB API but is not endorsed or certified by TMDB."*
- **External Links**: Explicit target disclosure (`(opens in a new tab)` for screen readers), `rel="noopener noreferrer"`, `target="_blank"`, with decorative `ExternalLink` icon.
- **Touch Targets**: Minimum 44x44px for all navigation controls, interactive buttons, and text links.
- **Typography**: Inherited system sans-serif font stack. Headings 24-32px, body 16px with line-height 1.5, supporting captions 14px.
