---
name: maintenance
description: >-
  Weekly maintenance audit. Reads the progress file, runs npm audit, scans for
  TODO/FIXME/HACK comments, opens GitHub issues for new findings, and updates
  progress.md. No code changes — read-only audit.
---

# Weekly Maintenance Audit

You are a read-only auditing agent. Work through these steps in order. You do not modify any source files — you only open issues and update `progress.md`.

## 1. Read your memory first

Open `progress.md` from the repo root. Read the "Last run", "Known advisories", and "Tracked TODOs" sections. These tell you what was already reported in previous weeks. Do not re-report anything already listed.

## 2. Gather findings

### 2a. npm audit

Run `npm audit --audit-level=none` to get the full advisory list. Extract:
- Package name, severity, title, CVE (if any), patched-in version
- Ignore advisories already listed in `progress.md` under "Known advisories"

### 2b. TODO / FIXME / HATCH comments

Run `rg -n "TODO|FIXME|HATCH" --type-add 'ts:*.ts' --type-add 'css:*.css' --type ts --type css --type html -g '!node_modules' -g '!dist' -g '!.github' src/` to find all markers. For each:
- File, line number, the full comment text
- Ignore markers already listed in `progress.md` under "Tracked TODOs"
- Ignore markers inside `node_modules/`, `dist/`, or `.github/` (already excluded by glob)

### 2c. Outdated dependencies

Run `npm outdated` (ignore if it exits non-zero — that just means nothing is outdated). For each outdated package:
- Package name, current version, wanted version, latest version
- Ignore packages already listed in `progress.md`

## 3. Open GitHub issues for genuinely new items

For each new finding that is not in `progress.md`, open a single GitHub issue using the tooling available. Use these conventions:

**For npm advisories:**
```
Title: deps: {package} — {advisory title}
Body:
## Advisory

- **Package:** {package}
- **Severity:** {severity}
- **CVE:** {CVE or "none"}
- **Fix:** upgrade to {patched version}

{one-line summary from the advisory}
```

**For TODO/FIXME/HATCH comments:**
```
Title: chore: {filename} — TODO
Body:
## Location

`{file}:{line}`

```
{comment text}
```
```

**For outdated dependencies:**
```
Title: deps: {package} is outdated ({current} → {latest})
Body:
## Outdated dependency

- **Package:** {package}
- **Current:** {current}
- **Latest:** {latest}

Run `npm install {package}@{latest}` to update.
```

## 4. Update progress.md last

When all issues are opened, write the updated `progress.md`:

```markdown
# Maintenance Progress

## Last run
{YYYY-MM-DD}

## Known advisories
{list of advisories reported, one per line with package + CVE + date reported}

## Tracked TODOs
{list of TODOs being tracked, one per line with file:line + date reported}

## Outdated dependencies
{list of outdated packages, one per line}

## Open PRs
{list of open PRs, one per line with number + title + status}

## In progress
{list of items currently being worked on}

## Open / needs a human
{list of items that need human attention}
```

Overwrite the entire file with the new content. This is the file next week's run will read.

## Rules

- Never modify any source code files. This is a read-only audit.
- Never open a duplicate issue — check `progress.md` first.
- If nothing new was found, just update `progress.md`'s "Last run" date.
- When in doubt, skip it. A missed issue is better than a noise issue.
