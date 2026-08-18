import {
  $createLineBreakNode,
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  type ParagraphNode,
} from 'lexical';
import type { MentionItem } from '../mentions';
import { $createMentionChipNode } from './MentionChipNode';

/** Escape a literal string for use inside a RegExp. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Regex matching any known `insertText` on word boundaries only, so `$docs`
 * never matches inside `$docsearch`.
 */
function buildMentionRegExp(items: MentionItem[]): RegExp | null {
  const texts = [...new Set(items.map((item) => item.insertText))]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  if (texts.length === 0) {
    return null;
  }
  return new RegExp(`(?<![\\w$])(${texts.map(escapeRegExp).join('|')})(?![\\w-])`, 'g');
}

function appendLine(
  paragraph: ParagraphNode,
  line: string,
  pattern: RegExp | null,
  byInsertText: Map<string, MentionItem>
): void {
  if (!pattern) {
    if (line) {
      paragraph.append($createTextNode(line));
    }
    return;
  }

  pattern.lastIndex = 0;
  let cursor = 0;
  let match = pattern.exec(line);
  while (match !== null) {
    const item = byInsertText.get(match[1]);
    if (item) {
      if (match.index > cursor) {
        paragraph.append($createTextNode(line.slice(cursor, match.index)));
      }
      paragraph.append(
        $createMentionChipNode({
          insertText: item.insertText,
          displayName: item.displayName,
          iconSrc: item.iconSrc,
          brandColor: item.brandColor,
        })
      );
      cursor = match.index + match[1].length;
    }
    match = pattern.exec(line);
  }
  if (cursor < line.length) {
    paragraph.append($createTextNode(line.slice(cursor)));
  }
}

/**
 * Replace the whole editor content with `value`, turning any known mention
 * text into an atomic chip. Must be called inside `editor.update()`.
 *
 * Everything lands in a single paragraph separated by line breaks, matching how
 * PlainTextPlugin handles Shift+Enter, so `getTextContent()` round-trips `\n`.
 */
export function $setEditorFromString(value: string, items: MentionItem[]): void {
  const root = $getRoot();
  root.clear();

  const byInsertText = new Map(items.map((item) => [item.insertText, item]));
  const pattern = buildMentionRegExp(items);
  const paragraph = $createParagraphNode();
  const lines = value.split('\n');

  lines.forEach((line, index) => {
    if (index > 0) {
      paragraph.append($createLineBreakNode());
    }
    appendLine(paragraph, line, pattern, byInsertText);
  });

  root.append(paragraph);
  root.selectEnd();
}
