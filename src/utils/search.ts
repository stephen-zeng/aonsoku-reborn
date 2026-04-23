/**
 * Normalize text for search matching:
 * - Decompose diacritics (é → e, ü → u, etc.)
 * - Convert to lowercase
 * - Collapse whitespace
 */
export function normalizeSearchText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Tokenize a search query into individual terms for matching.
 * Empty terms are filtered out.
 */
export function tokenizeQuery(query: string): string[] {
  return normalizeSearchText(query)
    .split(" ")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

/**
 * Check if any single query token is found in a set of target strings.
 * Uses normalized comparison for diacritic-insensitive matching.
 */
export function matchesAnyToken(
  tokens: string[],
  targets: (string | undefined | null)[],
): boolean {
  const normalizedTargets = targets
    .filter(Boolean)
    .map((t) => normalizeSearchText(t!));
  for (const token of tokens) {
    for (const target of normalizedTargets) {
      if (target.includes(token)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Check if all query tokens are found in a set of target strings.
 * Each token must match at least one target, but not every token
 * needs to match the same target.
 */
export function matchesAllTokens(
  tokens: string[],
  targets: (string | undefined | null)[],
): boolean {
  if (tokens.length === 0) return false;
  const normalizedTargets = targets
    .filter(Boolean)
    .map((t) => normalizeSearchText(t!));
  for (const token of tokens) {
    const found = normalizedTargets.some((target) => target.includes(token));
    if (!found) return false;
  }
  return true;
}