import { readDirectory, readTextFile } from '@/services';

export type RunKind = 'dev' | 'test' | 'build' | 'preview';

export type ProjectCommands = Partial<Record<RunKind, string>>;

function detectPackageManagerRunner(fileNames: Set<string>): string {
  if (fileNames.has('bun.lock') || fileNames.has('bun.lockb')) return 'bun run';
  if (fileNames.has('pnpm-lock.yaml')) return 'pnpm';
  if (fileNames.has('yarn.lock')) return 'yarn';
  return 'npm run';
}

/**
 * Detect reasonable default dev/test/build/preview commands for a project
 * directory. Never throws — any read failure just yields fewer/no defaults.
 */
export async function detectProjectCommands(cwd: string): Promise<ProjectCommands> {
  if (!cwd) return {};

  try {
    const entries = await readDirectory(cwd, { suppressToast: true });
    const fileNames = new Set(entries.filter((e) => !e.is_dir).map((e) => e.name));

    if (fileNames.has('package.json')) {
      try {
        const raw = await readTextFile(`${cwd}/package.json`, { suppressToast: true });
        const pkg = JSON.parse(raw);
        const scripts: Record<string, string> = pkg.scripts || {};
        const runner = detectPackageManagerRunner(fileNames);

        const commands: ProjectCommands = {};
        if (scripts.dev) commands.dev = `${runner} dev`;
        else if (scripts.start) commands.dev = `${runner} start`;
        if (scripts.test) commands.test = `${runner} test`;
        if (scripts.build) commands.build = `${runner} build`;
        if (scripts.preview) commands.preview = `${runner} preview`;
        return commands;
      } catch {
        return {};
      }
    }

    if (fileNames.has('Cargo.toml')) {
      return {
        dev: 'cargo run',
        test: 'cargo test',
        build: 'cargo build --release',
      };
    }

    if (fileNames.has('index.html')) {
      return { preview: 'bunx serve .' };
    }

    return {};
  } catch {
    return {};
  }
}
