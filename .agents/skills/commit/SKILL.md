---
name: commit
description: Use this skill whenever the user wants to commit changes to a git repository. Triggers include any mention of "git commit", "commit my changes", "save to git", "stage and commit", or similar phrasing. Also use when the user asks to commit after completing a coding or file editing task. Do NOT use for git push, pull, merge, or other git operations unrelated to committing.
---

# Git Commit Guide

## Overview

This skill covers staging and committing changes in a git repository. Run all commands from the repository root unless otherwise specified.

## Basic Workflow

```bash
# Check what has changed
git status

# Stage all changes
git add .

# Or stage specific files
git add path/to/file.txt

# Commit with a message
git commit -m "your commit message here"
```

## Commit Message Conventions

Write commit messages in the imperative mood, present tense. Describe what the commit does, not what you did.

Good title examples:

- `Add keypad puzzle`
- `Fix toolbar safe area inset on mobile`

In the message, for a bug, explain the cause and fix.

DO NOT author any commit messages.
