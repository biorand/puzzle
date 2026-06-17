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
  showOverlay(text: string, ms?: number): Promise<void>;
  hideOverlay(): void;
  playTone(idx: number): void;
  playChime(): void;
  score: {
    count: number;
    increment(): void;
  };
}

export interface PuzzleModule {
  id: string;
  name: string;
  create(container: HTMLElement, ctx: PuzzleContext): { destroy(): void };
}
