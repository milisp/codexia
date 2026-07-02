import { version } from '../../package.json';

const GITHUB_URL = 'https://github.com/milisp/codexia';

import { open } from '@tauri-apps/plugin-shell';

export default function AboutView() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-background text-foreground p-8 select-none">
      <img src="/icons/128x128.png" alt="Codexia" className="w-16 h-16 rounded-xl" />
      <div className="text-center">
        <h1 className="text-xl font-semibold">Codexia</h1>
        <p className="text-sm text-muted-foreground mt-1">Version {version}</p>
      </div>
      <p className="text-sm text-center text-muted-foreground max-w-xs">
        Agent OS and Toolkit for Codex CLI + Claude Code
      </p>
      <button
        className="text-sm text-blue-500 hover:underline cursor-pointer"
        onClick={() => open(GITHUB_URL)}
      >
        github.com/milisp/codexia
      </button>
      <p className="text-xs text-muted-foreground mt-2">© 2026 Milisp. All rights reserved.</p>
    </div>
  );
}
