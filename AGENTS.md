# RE Puzzles — Agent Instructions

## Project Overview

A Resident Evil puzzle collection web app built with:

- **Lit** — UI framework (light DOM mode)
- **TypeScript** — all source
- **esbuild** — bundler
- **Prettier** — code formatting
- **ESLint** — code quality

## Workflow

**After every change, run:**

```bash
npm run verify
```

This runs format + lint + unit tests + e2e tests to ensure nothing is broken.

## Available Scripts

| Script                 | Description                           |
| ---------------------- | ------------------------------------- |
| `npm run build`        | Bundle with esbuild (minified)        |
| `npm run dev`          | Watch mode + http-server on port 8000 |
| `npm run verify`       | Format → lint → unit tests → e2e      |
| `npm run format`       | Format all source files with Prettier |
| `npm run format:check` | Check formatting without writing      |
| `npm run lint`         | Lint TypeScript source with ESLint    |
| `npm run lint:fix`     | Lint and auto-fix issues              |

## Maintenance Loop

A scheduled loop runs every Monday at 6 AM UTC via GitHub Actions (`.github/workflows/maintenance.yml`).
It audits dependencies, scans for TODO/FIXME markers, and opens issues for new findings.
The skill lives at `.opencode/skills/maintenance/SKILL.md`. The spine file `progress.md` tracks
what was reported so it never duplicates.

## Architecture

- **`src/components/repuzzles-app.ts`** — root LitElement, hash router, owns PuzzleContext
- **`src/components/*.ts`** — individual LitElement components (header, menu, footer, etc.)
- **`src/components/puzzle-host.ts`** — Lit wrapper that mounts/destroys imperative puzzle modules
- **`src/puzzles/*.ts`** — imperative puzzle game logic (unchanged, wrapped by PuzzleHost)
- **`src/types.ts`** — shared TypeScript interfaces
- **`src/audio.ts`** — Web Audio API helpers
- **`test/puzzles/*.test.ts`** — per-puzzle Vitest test suites (happy-dom environment)
- **`style.css`** — global styles (light DOM)
