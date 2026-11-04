/**
 * Normalizes movie titles and guesses per PRD Section 7:
 * - Unicode NFKD
 * - Remove combining diacritical marks
 * - Case-fold (toLowerCase)
 * - Convert & to 'and'
 * - Remove punctuation while preserving letters, numbers, and spaces
 * - Collapse whitespace and trim
 * - Preserve numbers and sequel identifiers; do not strip leading articles
 */
export function normalizeTitle(text: string): string {
  if (!text) return "";
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Validates free text guess length and contents.
 * Returns null if valid, or an error string if invalid.
 */
export function validateGuessInput(text: unknown): { valid: boolean; error?: string; normalized?: string } {
  if (typeof text !== "string") {
    return { valid: false, error: "Guess must be text" };
  }
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: "Guess cannot be blank" };
  }
  if (trimmed.length > 150) {
    return { valid: false, error: "Guess exceeds 150 characters" };
  }
  if (!/[\p{L}\p{N}]/u.test(trimmed)) {
    return { valid: false, error: "Guess contains no letters or digits" };
  }
  const normalized = normalizeTitle(trimmed);
  if (normalized.length === 0) {
    return { valid: false, error: "Guess contains no alphanumeric characters" };
  }
  return { valid: true, normalized };
}
