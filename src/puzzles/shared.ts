import type { ActionButton, PuzzleContext } from '../types';

export const UMBRELLA_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%">
  <path d="M50,50 L90,50 Q70.48,58.48 78.28,78.28 Z" fill="#cc0000" stroke="#000" stroke-width="1.2"/>
  <path d="M50,50 L78.28,78.28 Q58.48,70.48 50,90 Z" fill="#fff" stroke="#000" stroke-width="1.2"/>
  <path d="M50,50 L50,90 Q41.52,70.48 21.72,78.28 Z" fill="#cc0000" stroke="#000" stroke-width="1.2"/>
  <path d="M50,50 L21.72,78.28 Q29.52,58.48 10,50 Z" fill="#fff" stroke="#000" stroke-width="1.2"/>
  <path d="M50,50 L10,50 Q29.52,41.52 21.72,21.72 Z" fill="#cc0000" stroke="#000" stroke-width="1.2"/>
  <path d="M50,50 L21.72,21.72 Q41.52,29.52 50,10 Z" fill="#fff" stroke="#000" stroke-width="1.2"/>
  <path d="M50,50 L50,10 Q58.48,29.52 78.28,21.72 Z" fill="#cc0000" stroke="#000" stroke-width="1.2"/>
  <path d="M50,50 L78.28,21.72 Q70.48,41.52 90,50 Z" fill="#fff" stroke="#000" stroke-width="1.2"/>
</svg>`;

export function makeActions(
  playingRef: { value: boolean },
  generate: () => void,
  reset: () => void,
): ActionButton[] {
  return [
    {
      label: 'New Puzzle',
      handler: () => {
        if (!playingRef.value) generate();
      },
    },
    {
      label: 'Reset',
      handler: () => {
        if (!playingRef.value) reset();
      },
    },
  ];
}

export async function completePuzzle(
  ctx: PuzzleContext | null,
  playingRef: { value: boolean },
  animate: () => Promise<void>,
  generate: () => void,
  reset: () => void,
  playChime = true,
): Promise<void> {
  if (!ctx) return;
  playingRef.value = true;
  ctx.setActions([]);
  if (playChime) ctx.playChime();

  await animate();

  const nextMod = ctx.score.increment();
  if (nextMod) {
    await ctx.showOverlay(nextMod);
    return;
  }

  await ctx.showOverlay();
  generate();
  ctx.setActions(makeActions(playingRef, generate, reset));
  playingRef.value = false;
}
