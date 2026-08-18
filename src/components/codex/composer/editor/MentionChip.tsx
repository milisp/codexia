import { Sparkles } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { MentionChipPayload } from './MentionChipNode';

/** Atomic pill rendered inside the composer for a `$mention`. */
export function MentionChip({ displayName, iconSrc, brandColor }: MentionChipPayload) {
  // Tint borrows the brand color at low opacity so the chip still reads in both themes.
  const style: CSSProperties | undefined = brandColor
    ? {
        borderColor: brandColor,
        backgroundColor: `color-mix(in srgb, ${brandColor} 12%, transparent)`,
      }
    : undefined;

  return (
    <span
      style={style}
      className="inline-flex select-none items-center gap-1 rounded-full border bg-muted px-1.5 py-0.5 align-middle text-xs font-medium text-foreground"
    >
      {iconSrc ? (
        <img src={iconSrc} alt="" className="h-3.5 w-3.5 shrink-0 rounded-sm object-contain" />
      ) : (
        <Sparkles className="h-3 w-3 shrink-0 text-muted-foreground" />
      )}
      <span className="truncate">{displayName}</span>
    </span>
  );
}
