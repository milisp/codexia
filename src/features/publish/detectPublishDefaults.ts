import { detectProjectCommands } from '@/features/project-run/detectProjectCommands';
import { readDirectory, readTextFile } from '@/services';
import { guessDimension } from './gameTaxonomy';
import type { PublishSettings } from './usePublishStore';

export type PublishDefaults = PublishSettings & {
  /** Uses a web game engine (three.js, Phaser, ...), so Publish is worth highlighting. */
  looksLikeGame: boolean;
};

const GAME_DEPENDENCIES = [
  'three',
  '@react-three/fiber',
  'phaser',
  'pixi.js',
  '@babylonjs/core',
  'babylonjs',
  'playcanvas',
  'kaboom',
  'kaplay',
  'excalibur',
  'matter-js',
  'cannon-es',
  '@dimforge/rapier3d-compat',
  'littlejsengine',
];

const COVER_RE =
  /^(cover|thumbnail|thumb|og-image|og|screenshot|banner)[^/]*\.(png|jpe?g|webp|gif)$/i;
const COVER_DIRS = ['', 'release', 'public', 'assets', 'docs', 'media'];

export function toSlug(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
  return slug.length >= 3 ? slug : `${slug || 'game'}-${Math.random().toString(36).slice(2, 6)}`;
}

function toTitle(name: string): string {
  return name
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ');
}

async function findCover(cwd: string): Promise<string> {
  for (const dir of COVER_DIRS) {
    const path = dir ? `${cwd}/${dir}` : cwd;
    const entries = await readDirectory(path, { suppressToast: true }).catch(() => []);
    const matches = entries
      .filter((entry) => !entry.is_dir && COVER_RE.test(entry.name))
      .sort((a, b) => Number(!a.name.startsWith('cover')) - Number(!b.name.startsWith('cover')));
    if (matches[0]) return matches[0].path;
  }
  return '';
}

function guessOutputDir(deps: Record<string, unknown>): string {
  if (deps.next) return 'out';
  if (deps['react-scripts'] || deps['@sveltejs/kit']) return 'build';
  return 'dist';
}

/** Best-effort publish defaults for a project folder. Never throws. */
export async function detectPublishDefaults(cwd: string): Promise<PublishDefaults> {
  const folder = cwd.split(/[\\/]/).filter(Boolean).pop() ?? 'game';
  const defaults: PublishDefaults = {
    slug: toSlug(folder),
    title: toTitle(folder),
    tagline: '',
    description: '',
    genre: '',
    dimension: '',
    buildCommand: '',
    outputDir: 'dist',
    coverPath: '',
    looksLikeGame: false,
  };

  const entries = await readDirectory(cwd, { suppressToast: true }).catch(() => []);
  const names = new Set(entries.filter((entry) => !entry.is_dir).map((entry) => entry.name));
  defaults.coverPath = await findCover(cwd);

  if (names.has('package.json')) {
    try {
      const pkg = JSON.parse(await readTextFile(`${cwd}/package.json`, { suppressToast: true }));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      defaults.looksLikeGame = GAME_DEPENDENCIES.some((dep) => dep in deps);
      defaults.dimension = guessDimension(deps);
      defaults.buildCommand = (await detectProjectCommands(cwd)).build ?? '';
      defaults.outputDir = defaults.buildCommand ? guessOutputDir(deps) : '.';
      if (typeof pkg.description === 'string') defaults.tagline = pkg.description.slice(0, 140);
    } catch {
      // Keep folder-based defaults.
    }
  } else if (names.has('index.html')) {
    defaults.outputDir = '.';
    defaults.looksLikeGame = true;
  }
  return defaults;
}
