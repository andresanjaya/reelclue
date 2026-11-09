# RC-026: Spoiler-Free Result Sharing

## 1. Overview and Privacy Boundaries

The **Spoiler-Free Result Sharing** feature allows ReelClue players to share their game session outcomes with friends and on social platforms without spoiling movie solutions for others:
- **Zero Answer / Movie Leaks**: Movie titles, director names, cast lists, synopses, and poster image paths are strictly excluded from the shared payload.
- **No Private IDs / No Ownership Tokens**: Session IDs (e.g. `/results/[uuid]`, `/play/[uuid]`) and player authentication tokens are never included in shared text or links. Owned session URLs remain private to the device.
- **Generic Link**: The shared payload points to the generic game homepage or entry points (`https://reelclue.vercel.app/play` or `https://reelclue.vercel.app/daily`).
- **No Forced Accounts**: Anyone receiving the shared text can click the link and immediately play without signing in or encountering a paywall.

---

## 2. Shared Payload Specification

The shared message is formatted cleanly in plain text:

```text
ReelClue — Synopsis (Medium)
Score: 850/1500 (8/10 correct)

🟩🟨🟨🟩🟩
🟥🟩🟨🟩🟩

Outcome breakdown:
Round 1: Solved (0 hints, 0 wrong)
Round 2: Solved (1 hint, 0 wrong)
Round 3: Solved (2 hints, 1 wrong)
Round 4: Solved (0 hints, 0 wrong)
Round 5: Solved (0 hints, 0 wrong)
Round 6: Missed (Exhausted)
Round 7: Solved (0 hints, 0 wrong)
Round 8: Solved (1 hint, 0 wrong)
Round 9: Solved (0 hints, 0 wrong)
Round 10: Solved (0 hints, 0 wrong)

Play ReelClue: https://reelclue.vercel.app/play
```

For the Daily Challenge:
```text
ReelClue Daily (2026-11-09)
Score: 850/1500 (8/10 correct)
...
Play ReelClue: https://reelclue.vercel.app/daily
```

---

## 3. Emoji & Color Accessibility

The outcome grid maps each round's state to emoji symbols:
| Symbol | State | Meaning |
| :---: | :--- | :--- |
| 🟩 | Solved Clean | Answered correctly with 0 hints and 0 wrong guesses |
| 🟨 | Solved Assisted | Answered correctly after using hints or multiple attempts |
| 🟥 | Exhausted | All 3 wrong guesses spent (0 points) |
| ⬜ | Skipped | Round skipped without guessing |

### Non-Color-Dependent Alternative
To satisfy WCAG 2.1 Success Criterion 1.4.1 (Use of Color), the shared text always includes the **Outcome breakdown** section with readable text (`Round X: Solved (N hints, N wrong)`). Furthermore, on-screen outcome tiles feature explicit `aria-label`s and screen-reader-only accessible text.

---

## 4. Progressive Enhancement Strategy

The client-side sharing utility (`src/lib/client/sharing.ts`) implements progressive enhancement:
1. **Web Share API (`navigator.share`)**:
   - Triggers the operating system's native share sheet (iOS, Android, and supported desktop browsers).
   - If the user cancels the share sheet (`AbortError`), it is caught gracefully without displaying an error message.
2. **Clipboard API Fallback (`navigator.clipboard.writeText`)**:
   - If Web Share is unsupported or fails, automatically copies the spoiler-free text to the system clipboard.
   - Displays polite feedback (`aria-live="polite"`): *"Results copied to clipboard (spoiler-free)!"*.
3. **Manual Copy Fallback**:
   - If clipboard permissions are denied, an accessible, read-only `<textarea>` appears alongside a "Copy Text" button so the user can easily copy the text manually.

---

## 5. UI UX Guidelines Alignment

- Adheres to [`design-system/reelclue/MASTER.md`](../design-system/reelclue/MASTER.md):
  - 44px min hit target on the "Share Results" button (`min-h-11`).
  - Solid 2px amber focus outlines with 3px offset (`focus-visible:outline-2 focus-visible:outline-ring`).
  - Dark theme palette (`#10131A` canvas, `#1A2030` card surfaces, `#F4C95D` amber primary).
  - Polite ARIA live regions for screen reader status updates.

