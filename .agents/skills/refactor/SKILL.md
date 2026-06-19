---
name: 'refactor'
description: 'Analyze selected code or entire codebase for refactoring opportunities at small, medium, and large scales'
user-invocable: true
disable-model-invocation: true
---

Analyze the codebase (or the selected code/files) for structural improvements and refactoring opportunities. Categorize findings into three tiers:

## Small (~10–30 lines saved)

Focus on obvious duplication you can eliminate:

- Duplicated constants, inline SVGs, or literal strings
- Repeated one-liners (e.g., same DOM creation pattern)
- Single-use utility functions that already exist elsewhere

## Medium (~30–60 lines saved)

Focus on behavioral duplication across modules:

- Repeated function patterns (e.g., the same action-button setup in every puzzle)
- Nearly identical lifecycle or callback structures
- Boilerplate that could be replaced with a shared helper

## Large (~60–100+ lines saved)

Focus on structural lifecycle patterns:

- Same procedural skeleton repeated across similar modules (e.g., "play chime → animate → increment score → show overlay → generate new → reset state")
- State-management patterns that could be abstracted
- Cross-cutting concerns (e.g., error handling, completion flows, reset logic)

For each refactor, provide:

1. **What** — the concrete change
2. **Files affected** — which files change and how
3. **Lines saved** — approximate reduction
4. **Key benefit** — DRY, maintainability, consistency, etc.

If the user requests implementation, apply all agreed refactors. Run format, lint, and tests afterward to verify nothing is broken.

Look for patterns across the whole project — not just within single files. The best refactors are ones that eliminate duplication across many files simultaneously.
