import type { PuzzleModule } from '../types';
import { graveyard } from './graveyard';
import { keypad } from './keypad';
import { labPuzzle } from './labPuzzle';
import { plant43 } from './plant43';
import { portableSafe } from './portableSafe';
import { powerPanel } from './powerPanel';
import { slidingBlock } from './slidingBlock';
import { stagla } from './stagla';
import { vjolt } from './vjolt';

export const puzzles = new Map<string, PuzzleModule>([
    [keypad.id, keypad],
    [vjolt.id, vjolt],
    [portableSafe.id, portableSafe],
    [powerPanel.id, powerPanel],
    [stagla.id, stagla],
    [graveyard.id, graveyard],
    [slidingBlock.id, slidingBlock],
    [labPuzzle.id, labPuzzle],
    [plant43.id, plant43],
]);

export const puzzleOrder = [
    'keypad',
    'vjolt',
    'portableSafe',
    'powerPanel',
    'stagla',
    'graveyard',
    'slidingBlock',
    'labPuzzle',
    'plant43',
];

export const puzzlesByPath = new Map<string, PuzzleModule>();
for (const p of puzzles.values()) {
    puzzlesByPath.set(`${p.sourceGame}/${p.slug}`, p);
}
