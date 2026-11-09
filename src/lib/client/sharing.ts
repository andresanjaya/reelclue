export interface ShareRoundSummary {
  ordinal: number;
  outcome: string; // "correct" | "exhausted" | "skipped"
  hintsUsed: number;
  wrongAttempts: number;
}

export interface SharePayloadOptions {
  mode: string;
  level: string;
  score: number;
  maxScore: number;
  correctCount: number;
  totalRounds: number;
  rounds: ShareRoundSummary[];
  origin?: string;
  isDaily?: boolean;
  dailyDate?: string;
}

export interface FormattedSharePayload {
  title: string;
  text: string;
  url: string;
  fullMessage: string;
}

export type ShareExecutionResult =
  | { type: "shared" }
  | { type: "copied" }
  | { type: "cancelled" }
  | { type: "error"; message: string };

/**
 * Maps round outcome to emoji representation:
 * - 🟩 Correct without hints (pure deduction)
 * - 🟨 Correct with hints or multiple attempts
 * - 🟥 Exhausted / all attempts spent
 * - ⬜ Skipped
 */
export function getRoundOutcomeEmoji(round: ShareRoundSummary): string {
  if (round.outcome === "correct") {
    return round.hintsUsed === 0 && round.wrongAttempts === 0 ? "🟩" : "🟨";
  }
  if (round.outcome === "exhausted") {
    return "🟥";
  }
  return "⬜";
}

/**
 * Provides a readable, non-color-dependent text description for each round outcome.
 * Fulfills accessibility requirements for screen readers and plain-text output.
 */
export function getRoundOutcomeText(round: ShareRoundSummary): string {
  if (round.outcome === "correct") {
    const hintWord = round.hintsUsed === 1 ? "1 hint" : `${round.hintsUsed} hints`;
    const wrongWord = round.wrongAttempts === 1 ? "1 wrong" : `${round.wrongAttempts} wrong`;
    return `Round ${round.ordinal}: Solved (${hintWord}, ${wrongWord})`;
  }
  if (round.outcome === "exhausted") {
    return `Round ${round.ordinal}: Missed (Exhausted)`;
  }
  return `Round ${round.ordinal}: Skipped`;
}

/**
 * Generates an emoji grid (e.g. 2 rows of 5 for 10 rounds).
 */
export function formatEmojiGrid(rounds: ShareRoundSummary[]): string {
  if (rounds.length === 0) return "";
  const emojis = rounds.map(getRoundOutcomeEmoji);

  // Group into rows of 5 for clean mobile display
  const rows: string[] = [];
  for (let i = 0; i < emojis.length; i += 5) {
    rows.push(emojis.slice(i, i + 5).join(""));
  }
  return rows.join("\n");
}

/**
 * Generates a clean, spoiler-free share payload without leaking movie titles,
 * posters, aliases, private session IDs, or secret tokens.
 */
export function generateSpoilerFreeSharePayload(
  opts: SharePayloadOptions
): FormattedSharePayload {
  const modeLabel = opts.mode.charAt(0).toUpperCase() + opts.mode.slice(1);
  const levelLabel = opts.level.charAt(0).toUpperCase() + opts.level.slice(1);

  // Generic public URL without session IDs or private routes
  const base = opts.origin?.replace(/\/+$/, "") || "https://reelclue.vercel.app";
  const genericUrl = opts.isDaily ? `${base}/daily` : `${base}/play`;

  const headerTitle = opts.isDaily
    ? `ReelClue Daily (${opts.dailyDate || "Today"})`
    : `ReelClue — ${modeLabel} (${levelLabel})`;

  const scoreSummary = `Score: ${opts.score}/${opts.maxScore} (${opts.correctCount}/${opts.totalRounds} correct)`;

  const emojiGrid = formatEmojiGrid(opts.rounds);

  // Textual alternative for accessibility (does not rely on color)
  const textDetails = opts.rounds.map(getRoundOutcomeText).join("\n");

  const fullMessage = [
    headerTitle,
    scoreSummary,
    "",
    emojiGrid,
    "",
    "Outcome breakdown:",
    textDetails,
    "",
    `Play ReelClue: ${genericUrl}`,
  ].join("\n");

  return {
    title: headerTitle,
    text: `${headerTitle}\n${scoreSummary}\n\n${emojiGrid}`,
    url: genericUrl,
    fullMessage,
  };
}

/**
 * Executes sharing with progressive enhancement:
 * 1. Web Share API (native sheet on iOS / Android / supported desktop)
 * 2. Clipboard API fallback
 * 3. Handles user cancellation (AbortError) gracefully without error state
 */
export async function executeShare(payload: FormattedSharePayload): Promise<ShareExecutionResult> {
  // 1. Try Web Share API if supported
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({
        title: payload.title,
        text: payload.fullMessage,
      });
      return { type: "shared" };
    } catch (err) {
      // User cancelled share dialog
      if (err instanceof Error && err.name === "AbortError") {
        return { type: "cancelled" };
      }
      // If Web Share failed for non-cancellation reason, fall through to clipboard
    }
  }

  // 2. Clipboard write fallback
  if (
    typeof navigator !== "undefined" &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === "function"
  ) {
    try {
      await navigator.clipboard.writeText(payload.fullMessage);
      return { type: "copied" };
    } catch {
      return {
        type: "error",
        message: "Unable to copy to clipboard automatically. Please copy the text below.",
      };
    }
  }

  return {
    type: "error",
    message: "Sharing is not supported on this browser. Please copy the text below.",
  };
}

