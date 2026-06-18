import type { PuzzleModule } from '../types';
import { door01 } from './door01';
import { graveyard } from './graveyard';
import { portableSafe } from './portableSafe';
import { slidingBlock } from './slidingBlock';
import { stagla } from './stagla';

export const puzzles = new Map<string, PuzzleModule>([
  [door01.id, door01],
  [portableSafe.id, portableSafe],
  [stagla.id, stagla],
  [graveyard.id, graveyard],
  [slidingBlock.id, slidingBlock],
]);

export const puzzlesByPath = new Map<string, PuzzleModule>();
for (const p of puzzles.values()) {
  puzzlesByPath.set(`${p.sourceGame}/${p.slug}`, p);
}
