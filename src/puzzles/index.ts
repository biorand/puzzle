import type { PuzzleModule } from '../types';
import { graveyard } from './graveyard';
import { keypad } from './keypad';
import { portableSafe } from './portableSafe';
import { slidingBlock } from './slidingBlock';
import { stagla } from './stagla';

export const puzzles = new Map<string, PuzzleModule>([
  [keypad.id, keypad],
  [portableSafe.id, portableSafe],
  [stagla.id, stagla],
  [graveyard.id, graveyard],
  [slidingBlock.id, slidingBlock],
]);

export const puzzleOrder = ['keypad', 'portableSafe', 'stagla', 'graveyard', 'slidingBlock'];

export const puzzlesByPath = new Map<string, PuzzleModule>();
for (const p of puzzles.values()) {
  puzzlesByPath.set(`${p.sourceGame}/${p.slug}`, p);
}
