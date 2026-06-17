import type { PuzzleModule } from '../types';
import { door01 } from './door01';
import { portableSafe } from './portableSafe';
import { stagla } from './stagla';

export const puzzles = new Map<string, PuzzleModule>([
  [door01.id, door01],
  [portableSafe.id, portableSafe],
  [stagla.id, stagla],
]);

export const puzzlesByPath = new Map<string, PuzzleModule>();
for (const p of puzzles.values()) {
  puzzlesByPath.set(`${p.sourceGame}/${p.slug}`, p);
}
