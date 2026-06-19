export interface StatusInfo {
  moves: number;
  optimal?: number;
  custom?: string;
}

export interface ActionButton {
  label: string;
  handler: () => void;
}

export interface PuzzleContext {
  setStatus(info: StatusInfo): void;
  setActions(buttons: ActionButton[]): void;
  showOverlay(nextMod?: PuzzleModule): Promise<void>;
  hideOverlay(): void;
  playTone(progress: number): void;
  playChime(): void;
  playMelody(notes: string): Promise<void>;
  score: {
    count: number;
    increment(): PuzzleModule | null;
  };

  // Puzzle unlock / progression system
  forceDifficulty?: number;
  tutorialStep?: number;
  tutorialTotal?: number;
  onCheatUnlockAll?: (playMelodyFn?: () => Promise<void>) => void;
}

export interface MenuEntry {
  id: string;
  name: string;
  unlocked: boolean;
  requirementLabel?: string;
}

export interface PuzzleModule {
  id: string;
  slug: string;
  sourceGame: string;
  name: string;
  create(container: HTMLElement, ctx: PuzzleContext): { destroy(): void };
}
