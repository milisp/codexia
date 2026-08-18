import type {
  DOMExportOutput,
  EditorConfig,
  LexicalEditor,
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
  Spread,
} from 'lexical';
import { DecoratorNode } from 'lexical';
import type { ReactNode } from 'react';
import { createElement } from 'react';
import { MentionChip } from './MentionChip';

/** Payload carried by a `$mention` chip. */
export interface MentionChipPayload {
  /** Exact text codex must receive, e.g. `$spreadsheets`. */
  insertText: string;
  displayName: string;
  iconSrc: string | null;
  brandColor: string | null;
}

export type SerializedMentionChipNode = Spread<MentionChipPayload, SerializedLexicalNode>;

/**
 * Atomic, inline, isolated node rendering a `$mention` as a chip.
 *
 * `getTextContent()` returns `insertText` because the send path is
 * `$getRoot().getTextContent()` — that string is what codex actually receives.
 */
export class MentionChipNode extends DecoratorNode<ReactNode> {
  __insertText: string;
  __displayName: string;
  __iconSrc: string | null;
  __brandColor: string | null;

  static getType(): string {
    return 'mention-chip';
  }

  static clone(node: MentionChipNode): MentionChipNode {
    return new MentionChipNode(
      {
        insertText: node.__insertText,
        displayName: node.__displayName,
        iconSrc: node.__iconSrc,
        brandColor: node.__brandColor,
      },
      node.__key
    );
  }

  constructor(payload: MentionChipPayload, key?: NodeKey) {
    super(key);
    this.__insertText = payload.insertText;
    this.__displayName = payload.displayName;
    this.__iconSrc = payload.iconSrc;
    this.__brandColor = payload.brandColor;
  }

  static importJSON(node: SerializedLexicalNode & Record<string, unknown>): MentionChipNode {
    const serialized = node as unknown as SerializedMentionChipNode;
    return $createMentionChipNode({
      insertText: serialized.insertText,
      displayName: serialized.displayName,
      iconSrc: serialized.iconSrc,
      brandColor: serialized.brandColor,
    });
  }

  exportJSON(): SerializedMentionChipNode {
    return {
      ...super.exportJSON(),
      insertText: this.__insertText,
      displayName: this.__displayName,
      iconSrc: this.__iconSrc,
      brandColor: this.__brandColor,
    };
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement('span');
    element.textContent = this.__insertText;
    return { element };
  }

  createDOM(_config: EditorConfig, _editor: LexicalEditor): HTMLElement {
    const span = document.createElement('span');
    span.className = 'inline-block align-middle';
    return span;
  }

  updateDOM(): false {
    return false;
  }

  isInline(): true {
    return true;
  }

  // Not isolated: an isolated decorator cannot take part in a selection, which
  // stops Backspace from ever reaching it. Deletion is handled explicitly by
  // MentionChipDeletePlugin instead.
  isIsolated(): false {
    return false;
  }

  isKeyboardSelectable(): boolean {
    return true;
  }

  getTextContent(): string {
    return this.__insertText;
  }

  getPayload(): MentionChipPayload {
    const self = this.getLatest();
    return {
      insertText: self.__insertText,
      displayName: self.__displayName,
      iconSrc: self.__iconSrc,
      brandColor: self.__brandColor,
    };
  }

  decorate(): ReactNode {
    return createElement(MentionChip, this.getPayload());
  }
}

export function $createMentionChipNode(payload: MentionChipPayload): MentionChipNode {
  return new MentionChipNode(payload);
}

export function $isMentionChipNode(node: LexicalNode | null | undefined): node is MentionChipNode {
  return node instanceof MentionChipNode;
}
