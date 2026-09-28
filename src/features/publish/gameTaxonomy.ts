// Fixed game taxonomy of productship.lol (lib/games.ts GENRES / DIMENSIONS there).

export const GENRE_OPTIONS = [
  { value: 'action', label: 'Action' },
  { value: 'arcade', label: 'Arcade' },
  { value: 'puzzle', label: 'Puzzle' },
  { value: 'platformer', label: 'Platformer' },
  { value: 'racing', label: 'Racing' },
  { value: 'shooter', label: 'Shooter' },
  { value: 'simulation', label: 'Simulation' },
  { value: 'strategy', label: 'Strategy' },
  { value: 'casual', label: 'Casual' },
  { value: 'experimental', label: 'Experimental' },
];

export const DIMENSION_OPTIONS = [
  { value: '2d', label: '2D' },
  { value: '3d', label: '3D' },
];

const DEPS_3D = [
  'three',
  '@react-three/fiber',
  '@babylonjs/core',
  'babylonjs',
  'playcanvas',
  '@dimforge/rapier3d-compat',
  'cannon-es',
  'aframe',
];

const DEPS_2D = [
  'phaser',
  'pixi.js',
  'kaboom',
  'kaplay',
  'excalibur',
  'littlejsengine',
  'matter-js',
];

/** '3d' / '2d' from the engine in the dependencies, or '' when unclear. */
export function guessDimension(deps: Record<string, unknown>): string {
  if (DEPS_3D.some((dep) => dep in deps)) return '3d';
  if (DEPS_2D.some((dep) => dep in deps)) return '2d';
  return '';
}
