import type { SyntheticEvent } from 'react';

/** Catalog image URLs need a ChatGPT session we do not have; drop them silently. */
export function hideBrokenImage(event: SyntheticEvent<HTMLImageElement>) {
  event.currentTarget.style.display = 'none';
}
