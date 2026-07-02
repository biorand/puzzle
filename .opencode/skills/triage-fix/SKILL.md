---
name: triage-fix
description: >-
  Weekly fix loop. Reads open issues and progress.md, addresses feedback on
  existing PRs first, then groups and implements fixes for new issues, opens
  PRs for what passes verification, and flags what doesn't.
---

# Weekly Triage & Fix

You are the fix loop. Work through these steps in order.

## 1. Read your memory

Open `progress.md`. Read all sections — "Done", "In progress", "Open PRs", "Open / needs a human".

## 2. Check existing PRs first

Run `gh pr list --author "github-actions[bot]" --state OPEN --json number,title,headRefName,updatedAt`.

For each open PR:
- Read the PR: `gh pr view <number> --json body,comments,reviews,additions,deletions`
- Check `reviews` for review comments requesting changes
- Check `comments` for new comments since the last entry in progress.md

If there are new requests or feedback:
- `gh pr checkout <number>` to switch to the PR's branch
- Address each piece of feedback with the smallest change that resolves it
- Run `npm run verify`
- If verify passes, commit and push
- Update the PR's body if needed with what was addressed
- Update progress.md — add a note about what was addressed

If the PR has no new feedback and no pending review requests, leave it alone.

## 3. Find new work to do

If no existing PRs need attention (or after handling them), gather work from:

### 3a. Open issues
Run `gh issue list --state OPEN --json number,title,labels,createdAt`. Skip any issue already listed in progress.md under "Done", "In progress", or "Open / needs a human".

### 3b. Group related issues
Group issues that can reasonably be solved in a single PR:
- All dependency bumps → one group
- All TODO-related fixes → one group
- Each standalone bug fix → its own group

### 3c. Apply a ceiling
Pick at most 3 groups. Leave the rest for future runs.

## 4. Work each group

For each group:

1. **Create a branch**: `git checkout -b fix/<short-descriptive-slug>`
2. **Implement**: Make the smallest changes that solve the issues in this group
3. **Verify**: Run `npm run verify`
4. **Decide**:
   - If verify passes → `git push` and `gh pr create --title "fix: <summary>" --body "Closes #N, #M" --label "auto"`
   - If verify fails → do NOT open a PR. Instead, leave a comment on each issue explaining what was tried and what failed. Add to progress.md "Open / needs a human"

## 5. Update your memory last

Update `progress.md`:
- "Done" — issues that were closed by merged PRs or that no longer apply
- "In progress" — issues currently being worked on
- "Open PRs" — PRs that were created, with their numbers and status
- "Open / needs a human" — issues where the fix failed or was too risky

Overwrite the file. This is what next week's run will read.

## Rules

- Never open more than 3 groups' worth of PRs in one run.
- Never change `main` directly. Only `fix/*` branches.
- Always address existing PR feedback before starting new work.
- When in doubt, escalate to "needs a human" — a flagged item is safer than a wrong fix shipped while no one was watching.
- If an issue is already listed in progress.md under any section, do not re-process it.
