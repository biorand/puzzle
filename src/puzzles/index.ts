import type { PuzzleModule } from '../types';
import { door01 } from './door01';
import { portableSafe } from './portableSafe';

export const puzzles = new Map<string, PuzzleModule>([
  [door01.id, door01],
  [portableSafe.id, portableSafe],
]);
