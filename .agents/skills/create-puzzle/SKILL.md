---
name: create-puzzle
description: >
    Guide the user through creating a new Resident Evil puzzle for the BioRand Puzzles
    web app. Researches the puzzle from the web, asks clarifying questions until
    every detail is understood, then generates all files (Lit component,
    registration, styles, unit tests, e2e tests), and verifies with Playwright.
    Lit-only — no legacy imperative modules. e2e tests written after real
    browser verification. Use when user says "create a new puzzle", "add a
    puzzle", "make a puzzle", "new puzzle", or similar.
---

# Create a Puzzle

## Workflow

```
User describes puzzle
  ↓
Research game + puzzle from web (walkthroughs, images, wiki, videos)
  ↓
Ask clarifying questions until all details are understood
  ↓
Design implementation (DOM, algorithm, animation, tests — model's job)
  ↓
Implement: Lit component → register → styles → unit tests
  ↓
npm run verify (format → lint → unit)
  ↓
Interactive Playwright browser test (validate puzzle in real browser)
  ↓
Write e2e tests (based on real selectors/flows discovered above)
  ↓
npm run verify (full suite including e2e)
```

---

## PHASE 1: Research & Clarify

### Step 1 — User provides initial description

The user will say something like "I want the shadow projector puzzle from RE7" or "create a water jug puzzle like RE2 remake's plant 43 but from Code Veronica".

### Step 2 — Web research

Search the web for the game and puzzle. Find:

- **Walkthroughs**: Fandom wiki, IGN, GameFAQs — exact mechanics, rules, solution steps
- **Images**: Layout, UI elements, screen layout
- **Videos**: YouTube walkthroughs to see the puzzle in action (timing, animations, audio cues)
- **Mechanics**: How does the player interact? What is the goal? What are fail states?
- **Solution**: Is there an algorithm? BFS? Deterministic? Randomizable?

Use multiple searches. Research thoroughly — the more you find, the fewer questions you need to ask.

### Step 3 — Ask clarifying questions

After research, identify what you still don't know. Ask questions **as many as needed** until you have a complete mental model. You must know the answer to every question before Phase 2.

**Research tends to answer:**

- What the puzzle looks like (images/wiki)
- The basic rules and goal (walkthroughs)
- The game it's from

**You may need to ask the user about:**

- How to adapt the puzzle for web (e.g., replacing precise aiming with clicks)
- Difficulty tuning (how many moves, how complex)
- Whether to simplify or expand certain mechanics
- Per-session randomization details
- Audio feedback preferences (tone mapping, melody notes)
- Completion animation preferences
- Any gameplay nuance the research missed
- Whether the solution uses BFS, brute-force, or domain-specific logic
- How to ensure uniqueness across sessions

**Do NOT ask about:**

- DOM structure, CSS classes, IDs — you decide these
- Test scenarios — you plan these
- Responsive design — you implement this
- File naming conventions — they are fixed by the project pattern

### Step 4 — Confirm understanding

Summarize your understanding to the user before proceeding:

```
I understand the {Name} puzzle from {Game}. Here's my plan:

Mechanics: [summary of how it works]
Solution algorithm: [BFS / brute-force / domain logic]
Layout: [brief element list]
Audio: [good/bad/neutral tone pattern, completion melody]
Animation: [completion visual effect]
Uniqueness: [how each session differs]
Tests: [key unit + e2e scenarios]

Does this match your intent?
```

Only proceed to Phase 2 after user confirms.

---

## PHASE 2: Design (model's decision)

Design all technical details without user input:

### Puzzle state model

- Define TypeScript interfaces for puzzle state
- Define constants (grid size, counts, limits)

### Puzzle generation algorithm

- Implement `generatePuzzleState()` producing a unique random puzzle
- Must guarantee solvability (BFS precompute, backtracking, or mathematical guarantee)
- Static `_lastHash` to ensure each session is different from the previous

### Solution algorithm

- BFS precompute (for puzzles with small state space)
- Brute-force search (for puzzles with small branching)
- Domain-specific logic (for puzzles with known solutions)
- Store `_optimal` moves count

### DOM structure

- Root element: `<div id="{id}-layout">`
- Sub-elements with `#{id}-*` IDs and `.{id}-*` classes
- Responsive: CSS grid/flexbox, mobile-first
- All elements in light DOM (no shadow DOM)

### Audio feedback

- `playTone(progress)` mapping for actions (0=fail, ~0.5=neutral, ~1.0=good)
- `playChime()` at completion animation start
- `playMelody(notes)` for completion fanfare (use extended syntax)
- Optional: custom fail sound via raw AudioContext (sawtooth, low frequency)

### Completion animation

- Call `playChime()` first
- Use `flashElements()` or custom sequential animation
- Duration: ~1-3 seconds
- End with `PUZZLE_COMPLETE` dispatch

### Test plan

**Unit tests** (vitest + happy-dom, written before browser test):

1. Custom element definition check
2. DOM structure — verify key elements render
3. Status dispatch — verify PUZZLE_STATUS event on init
4. Actions dispatch — verify PUZZLE_ACTIONS event on init
5. Interaction — click something, verify moves increment
6. Regenerate — verify PUZZLE_REGENERATE resets state to moves=0
7. Solve regression — simulate full solve, verify completion fires

**E2e tests** (Playwright, written AFTER interactive browser test):
Based on real selectors, timing, and interaction patterns discovered during live testing.

---

## PHASE 3: Implementation

Implement in this exact order:

### Step 1 — Create puzzle Lit component

File: `src/puzzles/puzzle-{id}.ts`

Lit-only. Exports both the component class and metadata for registration.

```typescript
import { html, LitElement } from 'lit';
import { state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { playChime, playTone, playMelody } from '../audio';
import type { ActionButton, PuzzleLitElement } from '../types';
import { PUZZLE_ACTIONS, PUZZLE_COMPLETE, PUZZLE_REGENERATE, PUZZLE_STATUS } from '../types';
import { sleep /*, flashElements, shuffle */ } from './shared';

// ── Constants ──

// ── Types ──

// ── Puzzle generation helpers ──

function hashPuzzle(state: PuzzleState): string {
    return JSON.stringify(state);
}

function generatePuzzleState(): PuzzleState | null {
    // Loop with static _lastHash to ensure uniqueness
}

// ── Component ──

export class Puzzle{Id} extends LitElement implements PuzzleLitElement {
    private static _lastHash = '';

    @state() private _moves = 0;
    @state() private _optimal = 0;
    @state() private _playing = false;
    // puzzle-specific @state vars

    createRenderRoot() {
        return this;
    }

    connectedCallback(): void {
        super.connectedCallback();
        this.addEventListener(PUZZLE_REGENERATE, this._onRegenerate as EventListener);
        this._generatePuzzle();
        this._dispatchActions();
    }

    disconnectedCallback(): void {
        super.disconnectedCallback();
        this.removeEventListener(PUZZLE_REGENERATE, this._onRegenerate as EventListener);
    }

    regenerate(): void {
        this._generatePuzzle();
        this._dispatchActions();
    }

    private _onRegenerate(): void {
        this.regenerate();
    }

    private _generatePuzzle(): void {
        // Must produce unique puzzle from last (use static _lastHash)
        // Reset all state vars
        // Set _optimal
        // Set _playing = false
        this._dispatchStatus();
    }

    private _resetState(): void {
        // Reset to starting state — same puzzle, fresh start
        // Do NOT regenerate
        this._dispatchStatus();
    }

    // ── Interaction ──

    private _onAction(e: Event): void {
        if (this._playing) return;
        // Handle interaction
        // playTone(progress) for feedback
        // Check win condition
    }

    // ── Completion ──

    private async _completePuzzle(): Promise<void> {
        this._playing = true;
        this._dispatchActions();
        playChime();
        // Optional: await playMelody('C4/4 E4/4 G4/4 C5/4');
        // Run completion animation
        this.dispatchEvent(
            new CustomEvent(PUZZLE_COMPLETE, { bubbles: true, composed: true }),
        );
    }

    // ── Dispatch ──

    private _dispatchStatus(): void {
        this.dispatchEvent(
            new CustomEvent(PUZZLE_STATUS, {
                detail: { moves: this._moves, optimal: this._optimal },
                bubbles: true,
                composed: true,
            }),
        );
    }

    private _dispatchActions(): void {
        const buttons: ActionButton[] = this._playing
            ? []
            : [
                  {
                      label: 'New Puzzle',
                      handler: () => {
                          if (!this._playing) this._generatePuzzle();
                      },
                  },
                  {
                      label: 'Reset',
                      handler: () => {
                          if (!this._playing) this._resetState();
                      },
                  },
              ];
        this.dispatchEvent(
            new CustomEvent(PUZZLE_ACTIONS, {
                detail: buttons,
                bubbles: true,
                composed: true,
            }),
        );
    }

    // ── Render ──

    render() {
        return html`<div id="{id}-layout">
            <!-- Puzzle specific markup -->
        </div>`;
    }
}

customElements.define('puzzle-{id}', Puzzle{Id});

declare global {
    interface HTMLElementTagNameMap {
        'puzzle-{id}': Puzzle{Id};
    }
}
```

**CRITICAL RULES:**

1. **Light DOM**: `createRenderRoot() { return this; }` — no shadow DOM
2. **Events**: Every custom event must have `{ bubbles: true, composed: true }`
3. **`_playing` guard**: All user actions, New, and Reset check `if (this._playing) return`
4. **`_completePuzzle()` order**:
    1. `this._playing = true`
    2. `this._dispatchActions()` — dispatches `[]`, hides buttons
    3. `playChime()`
    4. `await playMelody('...')` if desired
    5. Animation
    6. Dispatch `PUZZLE_COMPLETE`
5. **Puzzle uniqueness**:
    ```typescript
    private static _lastHash = '';
    private _generatePuzzle(): void {
        do { /* generate */ } while (hashState(state) === PuzzleId._lastHash);
        PuzzleId._lastHash = hashState(state);
    }
    ```
6. **`_resetState()`** keeps the same puzzle, `_generatePuzzle()` creates a new one
7. **`_dispatchActions()`** dispatches empty array `[]` when `_playing` is true

### Step 2 — Register in puzzle index

Edit `src/puzzles/index.ts`:

1. Import metadata from the Lit file: `import { {id}Meta } from './puzzle-{id}';`
2. Add to `puzzles` Map: `[{id}Meta.id, {id}Meta],`
3. Add to `puzzleOrder` array at appropriate position

### Step 3 — Register in repuzzles-app

Edit `src/components/repuzzles-app.ts`:

1. Import Lit component: `import '../puzzles/puzzle-{id}';`
2. Add to `_convertedIds` set: `'{id}',`
3. Add case to `_renderLitPuzzle()` switch:

```typescript
case '{id}':
    return html`<puzzle-{id}
        @puzzle-status=${this._onPuzzleStatus}
        @puzzle-actions=${this._onPuzzleActions}
        @puzzle-complete=${this._onPuzzleComplete}
    ></puzzle-{id}>`;
```

### Step 4 — Add styles

Edit `style.css`. Add all CSS using `#{id}-` prefix for IDs and `.{id}-` prefix for classes. Follow existing patterns. Mobile-first responsive.

### Step 5 — Create unit tests

File: `test/puzzles/puzzle-{id}.test.ts`

```typescript
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Puzzle{Id} } from '../../src/puzzles/puzzle-{id}';

vi.mock('../../src/audio', () => ({
    playTone: vi.fn(),
    playChime: vi.fn(),
    playMelody: vi.fn().mockResolvedValue(undefined),
    initAudioOnFirstClick: vi.fn(),
}));

describe('puzzle-{id}', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    it('custom element is defined', () => {
        const el = document.createElement('puzzle-{id}');
        expect(el).toBeInstanceOf(Puzzle{Id});
    });

    it('renders expected DOM structure', async () => {
        const el = document.createElement('puzzle-{id}') as Puzzle{Id};
        document.body.appendChild(el);
        await el.updateComplete;
        // Assert key elements in light DOM
        document.body.removeChild(el);
    });

    it('dispatches puzzle-status on creation', async () => {
        const el = document.createElement('puzzle-{id}') as Puzzle{Id};
        const spy = vi.fn();
        el.addEventListener('puzzle-status', spy);
        document.body.appendChild(el);
        await el.updateComplete;
        expect(spy).toHaveBeenCalledWith(
            expect.objectContaining({ detail: expect.objectContaining({ moves: 0 }) }),
        );
        document.body.removeChild(el);
    });

    it('dispatches puzzle-actions on creation', async () => {
        const el = document.createElement('puzzle-{id}') as Puzzle{Id};
        const spy = vi.fn();
        el.addEventListener('puzzle-actions', spy);
        document.body.appendChild(el);
        await el.updateComplete;
        expect(spy).toHaveBeenCalled();
        document.body.removeChild(el);
    });

    it('interaction increments moves', async () => {
        // Click an interactive element, verify moves increments
    });

    it('regenerate event resets puzzle', async () => {
        const el = document.createElement('puzzle-{id}') as Puzzle{Id};
        document.body.appendChild(el);
        await el.updateComplete;
        el.dispatchEvent(new CustomEvent('puzzle-regenerate'));
        await el.updateComplete;
        const spy = vi.fn();
        el.addEventListener('puzzle-status', spy);
        // verify moves reset to 0
        document.body.removeChild(el);
    });

    it('solve completes puzzle', async () => {
        // Read puzzle state, compute solution, execute, verify completion
        // Call _completePuzzle or simulate solution
    });
});
```

### Step 6 — Run initial verification

```bash
npm run verify
```

Fix any format, lint, or unit test failures. Do NOT run e2e yet (no e2e tests exist yet — that's next).

### Step 7 — Interactive browser test

Start the dev server and test the puzzle live using Playwright browser tools:

```bash
npx http-server . -p 8000 -c-1 &
```

Then use Playwright tools:

1. **Navigate** to `http://localhost:8000`
2. **Unlock all**: `browser_evaluate` → `localStorage.setItem('repuzzles-progress', '99')`
3. **Navigate** to puzzle: `http://localhost:8000/#/{sourceGame}/{slug}`
4. **Take snapshot** — verify all elements render
5. **Check console** — no errors
6. **Interact** — click buttons, verify visual changes via snapshot
7. **Test Reset** — click Reset, verify state restored
8. **Test New Puzzle** — click New, verify state changed
9. **Solve the puzzle** — read data from DOM, compute solution, execute clicks
10. **Verify COMPLETED overlay** — appears after solve
11. **Verify post-solve** — overlay dismisses, puzzle regenerates
12. **Edge cases** — click during animation, rapid clicks, out-of-bounds

Note all the selectors, button patterns, and timing observed. These will inform e2e test writing.

```bash
kill %1 || true
```

### Step 8 — Write e2e tests

File: `e2e/{slug}.spec.ts`

Based on real selectors and timing discovered during interactive testing:

```typescript
import { expect, test } from '@playwright/test';

test.describe('{Name} Puzzle', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.clear();
            localStorage.setItem('repuzzles-progress', '99');
        });
        await page.goto('/#{sourceGame}/{slug}');
        await page.waitForSelector('#{id}-layout');
        await page.waitForTimeout(200);
    });

    test('renders all puzzle elements', async ({ page }) => {
        // Verify key elements visible — selectors from real browser testing
    });

    test('action updates visual state', async ({ page }) => {
        // Click something, verify class change or content change
    });

    test('reset restores initial state', async ({ page }) => {
        // Perform action, click reset, verify state back to initial
    });

    test('new puzzle changes state', async ({ page }) => {
        // Read state, click New, verify state hash or content changed
    });

    test('solving shows COMPLETED overlay', async ({ page }) => {
        // Read puzzle data from DOM, compute solution, execute clicks
        // Wait for overlay: page.locator('#complete-overlay:not(.hidden)')
        // Verify text: 'COMPLETED'
    });
});
```

### Step 9 — Final verification

```bash
npm run verify
```

Full suite: format → lint → unit tests → e2e tests. Fix any failures.

---

## Reference

### sourceGame values

| Game           | sourceGame |
| -------------- | ---------- |
| RE0            | `re0`      |
| RE1 (original) | `re1`      |
| RE1 (remake)   | `re1r`     |
| RE2 (original) | `re2`      |
| RE2 (remake)   | `re2r`     |
| RE3 (original) | `re3`      |
| RE3 (remake)   | `re3r`     |
| Code: Veronica | `recv`     |
| RE4 (original) | `re4`      |
| RE4 (remake)   | `re4r`     |
| RE5            | `re5`      |
| RE7            | `re7`      |
| RE8 (Village)  | `re8`      |
| Revelations    | `rev1`     |
| Revelations 2  | `rev2`     |

### Audio API

```typescript
playTone(progress: number): void       // 0=fail, ~0.5=neutral, ~1.0=good
playChime(): void                      // C-E-G triad — call at completion start
playMelody(notes: string): Promise<void> // Extended syntax: "D5/4 E5/4 G4/4 Z/4"
```

### Shared helpers (from `./shared`)

```typescript
sleep(ms: number): Promise<void>
shuffle<T>(arr: T[]): T[]
flashElements(els: Element[], loops=3, ms=150, className='flash'): Promise<void>
UMBRELLA_SVG: string
```

### Naming conventions

- `id`: camelCase, e.g. `shadowProjector`
- `slug`: kebab-case, e.g. `shadow-projector`
- Lit tag: `puzzle-{id}`, e.g. `puzzle-shadow-projector`
- CSS IDs: `#{id}-layout`, `#{id}-*`
- CSS classes: `.{id}-*`

### Files to create/modify

| File                               | Action                                      |
| ---------------------------------- | ------------------------------------------- |
| `src/puzzles/puzzle-{id}.ts`       | CREATE — Lit component + metadata export    |
| `src/puzzles/index.ts`             | EDIT — import `{id}Meta`, add to maps/order |
| `src/components/repuzzles-app.ts`  | EDIT — import, `_convertedIds`, switch case |
| `style.css`                        | EDIT — add puzzle styles                    |
| `test/puzzles/puzzle-{id}.test.ts` | CREATE                                      |
| `e2e/{slug}.spec.ts`               | CREATE — after interactive browser test     |

## Boundaries

- Does NOT handle score, progression, or overlay logic (repuzzles-app handles that)
- Does NOT modify existing puzzles or tests
- Does NOT commit changes
- Always run `npm run verify` after each phase
- E2e tests written AFTER interactive browser test, not before
