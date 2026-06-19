---
name: commit
description: Use this skill whenever the user wants to commit changes to a git repository. Triggers include any mention of "git commit", "commit my changes", "save to git", "stage and commit", or similar phrasing. Also use when the user asks to commit after completing a coding or file editing task. Do NOT use for git push, pull, merge, or other git operations unrelated to committing.
---

# Git Commit Guide

## Overview

This skill covers staging and committing changes in a git repository. Run all commands from the repository root unless otherwise specified.

## Required Pre-Commit Step

**Before staging any changes, always run `npm run verify`.**

If verify fails, report the failure to the USER and ask whether to:
1. Fix the issues first (recommended)
2. Proceed with the commit anyway (user must explicitly choose this)

Do NOT skip or proceed past verify failures without user consent.

## Basic Workflow

```bash
# 1. Run verify first
npm run verify

# 2. Check what has changed
git status

# 3. Stage all changes
git add .

# 4. Or stage specific files
git add path/to/file.txt

# 5. Commit with a message
git commit -m "your commit message here"
```

## Commit Message Conventions

Write commit messages in the imperative mood, present tense. Describe what the commit does, not what you did.

Good title examples:

- `Add keypad puzzle`
- `Fix toolbar safe area inset on mobile`

In the message, for a bug, explain the cause and fix.

DO NOT author any commit messages.
DO NOT ask user for the commit message.
DO NOT push or pull changes. Only stage and commit changes.
