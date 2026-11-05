export function getHintDetails(
  mode: string,
  currentStage: number
): { label: string; effect: string; remaining: number } {
  const remaining = Math.max(0, 3 - currentStage);

  if (currentStage >= 3) {
    return {
      label: "No hints remaining",
      effect: "All 3 hints have been used for this round",
      remaining: 0,
    };
  }

  const hintNumber = currentStage + 1;
  const effects: Record<string, [string, string, string]> = {
    poster: [
      "Sharpen poster (medium blur)",
      "Sharpen poster (slight blur)",
      "Reveal release year & primary genre",
    ],
    title: [
      "Reveal 50% of letters",
      "Reveal 65% of letters",
      "Reveal 80% of letters",
    ],
    synopsis: [
      "Reveal release decade",
      "Reveal primary genre",
      "Reveal director",
    ],
    cast: [
      "Reveal 1st billed cast member",
      "Reveal 2nd billed cast member",
      "Reveal 3rd cast member & release year",
    ],
    genre: [
      "Reveal original language",
      "Reveal director",
      "Reveal lead actor & release year",
    ],
  };

  const modeEffects = effects[mode] ?? effects.poster;
  const effect = modeEffects[currentStage] ?? `Hint ${hintNumber}`;

  return {
    label: `Hint ${hintNumber}: ${effect} (-20 pts)`,
    effect,
    remaining,
  };
}
