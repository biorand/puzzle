import type { PuzzleModule } from '../types';
import { graveyard } from './graveyard';
import { keypad } from './keypad';
import { plant43 } from './plant43';
import { portableSafe } from './portableSafe';
import { powerPanel } from './powerPanel';
import { slidingBlock } from './slidingBlock';
import { stagla } from './stagla';

export const puzzles = new Map<string, PuzzleModule>([
  [keypad.id, keypad],
  [portableSafe.id, portableSafe],
  [powerPanel.id, powerPanel],
  [stagla.id, stagla],
  [graveyard.id, graveyard],
  [slidingBlock.id, slidingBlock],
  [plant43.id, plant43],
]);

export const puzzleOrder = [
  'keypad',
  'portableSafe',
  'powerPanel',
  'stagla',
  'graveyard',
  'slidingBlock',
  'plant43',
];

export const puzzlesByPath = new Map<string, PuzzleModule>();
for (const p of puzzles.values()) {
  puzzlesByPath.set(`${p.sourceGame}/${p.slug}`, p);
}
