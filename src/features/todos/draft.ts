/**
 * Parsing of what's typed in the todo input bar. A leading `#tag` files the
 * todo into a category; `# some name` on its own creates a category.
 *
 * Pure and separate from the component so it can be tested directly — the
 * component only decides what to do with the result.
 */
export type ParsedDraft = {
  /** The todo text, with any `#tag` prefix removed. */
  text: string;
  /** Category named by the `#tag` prefix, if there was one. */
  categoryName: string | null;
};

export function parseDraft(raw: string): ParsedDraft {
  const trimmed = raw.trim();

  if (/^#\s/.test(trimmed)) {
    return { text: '', categoryName: trimmed.slice(1).trim() || null };
  }

  const match = trimmed.match(/^#(\S+)\s*/);
  if (match) {
    return {
      text: trimmed.slice(match[0].length).trim(),
      categoryName: match[1],
    };
  }

  return { text: trimmed, categoryName: null };
}

/**
 * What the draft should filter the list by as it's typed. The `#tag` prefix
 * is a routing instruction, not something to search for — leaving it in
 * meant typing "#work buy milk" searched for the literal "#work".
 */
export function searchQueryFromDraft(raw: string): string {
  return parseDraft(raw).text;
}
