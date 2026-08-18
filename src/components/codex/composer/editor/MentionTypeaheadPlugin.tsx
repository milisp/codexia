import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  LexicalTypeaheadMenuPlugin,
  MenuOption,
  useBasicTypeaheadTriggerMatch,
} from '@lexical/react/LexicalTypeaheadMenuPlugin';
import { $createTextNode, COMMAND_PRIORITY_CRITICAL, type TextNode } from 'lexical';
import { useCallback, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { type MentionItem, matchesMention } from '../mentions';
import { $createMentionChipNode } from './MentionChipNode';

class MentionOption extends MenuOption {
  item: MentionItem;

  constructor(item: MentionItem) {
    super(item.key);
    this.item = item;
  }
}

/** `$` typeahead that inserts an atomic mention chip. */
export function MentionTypeaheadPlugin({ items }: { items: MentionItem[] }) {
  const [editor] = useLexicalComposerContext();
  const [query, setQuery] = useState<string | null>(null);

  const triggerFn = useBasicTypeaheadTriggerMatch('$', { minLength: 0 });

  const options = useMemo(
    () =>
      items.filter((item) => matchesMention(item, query ?? '')).map((i) => new MentionOption(i)),
    [items, query]
  );

  const onSelectOption = useCallback(
    (option: MentionOption, nodeToReplace: TextNode | null, closeMenu: () => void) => {
      editor.update(() => {
        const chip = $createMentionChipNode({
          insertText: option.item.insertText,
          displayName: option.item.displayName,
          iconSrc: option.item.iconSrc,
          brandColor: option.item.brandColor,
        });
        const space = $createTextNode(' ');
        if (nodeToReplace) {
          nodeToReplace.replace(chip);
        }
        chip.insertAfter(space);
        space.select();
        closeMenu();
      });
    },
    [editor]
  );

  return (
    <LexicalTypeaheadMenuPlugin<MentionOption>
      onQueryChange={setQuery}
      onSelectOption={onSelectOption}
      triggerFn={triggerFn}
      options={options}
      commandPriority={COMMAND_PRIORITY_CRITICAL}
      menuRenderFn={(
        anchorElementRef,
        { selectedIndex, selectOptionAndCleanUp, setHighlightedIndex }
      ) => {
        if (!anchorElementRef.current || options.length === 0) {
          return null;
        }
        return createPortal(
          <div className="z-[9999] w-96 max-w-[600px] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
            <div className="max-h-72 overflow-y-auto p-1">
              {options.map((option, index) => (
                <button
                  key={option.key}
                  type="button"
                  ref={option.setRefElement}
                  data-selected={index === selectedIndex}
                  className="flex w-full cursor-pointer flex-col items-start gap-0.5 rounded-sm px-2 py-1.5 text-left data-[selected=true]:bg-accent"
                  onMouseEnter={() => setHighlightedIndex(index)}
                  // Keep the editor focused: a blur would drop the selection the
                  // typeahead needs to replace with the chip.
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectOptionAndCleanUp(option)}
                >
                  <div className="flex w-full items-center gap-2">
                    {option.item.iconSrc && (
                      <img
                        src={option.item.iconSrc}
                        alt=""
                        className="h-4 w-4 shrink-0 rounded-sm object-contain"
                      />
                    )}
                    <span className="font-medium text-sm">{option.item.displayName}</span>
                    <span className="text-xs text-muted-foreground">{option.item.categoryTag}</span>
                  </div>
                  {option.item.description && (
                    <div className="line-clamp-2 text-xs text-muted-foreground">
                      {option.item.description}
                    </div>
                  )}
                </button>
              ))}
            </div>
            <div className="border-t border-border bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
              <span>↑↓ navigate</span>
              <span className="ml-3">↵ select</span>
              <span className="ml-3">Esc close</span>
            </div>
          </div>,
          anchorElementRef.current
        );
      }}
    />
  );
}
