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
    thumbnail: string;
    unlocked: boolean;
    requirementLabel?: string;
}

export interface PuzzleModule {
    id: string;
    slug: string;
    sourceGame: string;
    name: string;
    thumbnail: string;
    create(container: HTMLElement, ctx: PuzzleContext): { destroy(): void };
}

// ── Puzzle Lit Component Protocol ──

export const PUZZLE_STATUS = 'puzzle-status';
export const PUZZLE_ACTIONS = 'puzzle-actions';
export const PUZZLE_COMPLETE = 'puzzle-complete';
export const PUZZLE_REGENERATE = 'puzzle-regenerate';

export interface PuzzleLitElement {
    regenerate(): void;
}

declare global {
    interface HTMLElementEventMap {
        [PUZZLE_STATUS]: CustomEvent<StatusInfo>;
        [PUZZLE_ACTIONS]: CustomEvent<ActionButton[]>;
        [PUZZLE_COMPLETE]: CustomEvent<void>;
        [PUZZLE_REGENERATE]: CustomEvent<void>;
    }
}
