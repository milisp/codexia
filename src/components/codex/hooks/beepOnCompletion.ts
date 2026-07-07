// Pure helper: decide whether the completion beep should play based on
// beep mode setting and whether the codex thread view is currently active.
export function shouldPlayCompletionBeep(
  mode: 'never' | 'unfocused' | 'always',
  isCodexThreadActive: boolean
) {
  if (mode === 'never') {
    return false;
  } else if (mode === 'always') {
    return true;
  }
  return document.hidden || !document.hasFocus() || !isCodexThreadActive;
}
