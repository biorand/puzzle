import type { PuzzleModule } from '../types';
import { door01 } from './door01';

export const puzzles = new Map<string, PuzzleModule>([
  [door01.id, door01],
]);
