import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $getSelection,
  $isElementNode,
  $isNodeSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_HIGH,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
  type LexicalNode,
} from 'lexical';
import { useEffect } from 'react';
import { $isMentionChipNode } from './MentionChipNode';

/** The node immediately behind (or ahead of) a collapsed caret, if any. */
function $nodeAtCaret(backwards: boolean): LexicalNode | null {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
    return null;
  }

  const { anchor } = selection;
  const anchorNode = anchor.getNode();

  // An element anchor addresses a child slot; a text anchor only borders a
  // sibling when the caret sits at the very start or end of that text.
  if ($isElementNode(anchorNode) && anchor.type === 'element') {
    return anchorNode.getChildAtIndex(backwards ? anchor.offset - 1 : anchor.offset);
  }

  const atEdge = backwards
    ? anchor.offset === 0
    : anchor.offset === anchorNode.getTextContentSize();
  if (!atEdge) {
    return null;
  }

  return backwards ? anchorNode.getPreviousSibling() : anchorNode.getNextSibling();
}

/**
 * Makes Backspace / Delete remove a whole mention chip.
 *
 * A DecoratorNode is not a text node, so the default delete handlers never
 * touch it: with the caret directly after a chip Lexical finds no character to
 * remove and does nothing. This resolves the chip adjacent to the caret (or the
 * chips held by a node selection) and removes them as single units.
 */
export function MentionChipDeletePlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const removeChips = (backwards: boolean) => (event: KeyboardEvent | null) => {
      const selection = $getSelection();

      if ($isNodeSelection(selection)) {
        const chips = selection.getNodes().filter($isMentionChipNode);
        if (chips.length === 0) {
          return false;
        }
        event?.preventDefault();
        for (const chip of chips) {
          chip.remove();
        }
        return true;
      }

      const candidate = $nodeAtCaret(backwards);
      if (!$isMentionChipNode(candidate)) {
        return false;
      }

      event?.preventDefault();
      candidate.remove();
      return true;
    };

    const unregisterBackspace = editor.registerCommand(
      KEY_BACKSPACE_COMMAND,
      removeChips(true),
      COMMAND_PRIORITY_HIGH
    );
    const unregisterDelete = editor.registerCommand(
      KEY_DELETE_COMMAND,
      removeChips(false),
      COMMAND_PRIORITY_HIGH
    );

    return () => {
      unregisterBackspace();
      unregisterDelete();
    };
  }, [editor]);

  return null;
}
