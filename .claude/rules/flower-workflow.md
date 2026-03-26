# Flower Workflow

This is the mandatory end-to-end task flow for every piece of work, from discovery to merge.

## Step 0 — Check for a GitHub Issue

Before doing anything else:
- Run `gh issue list` to find an existing issue for the task.
- If one exists, confirm it has the correct label (`type:task`) and is linked to a parent feature/epic.
- If **no issue exists**, continue with Step 0b before proceeding.

### Step 0b — Research, Plan & Create Issues _(only when no issue exists)_

1. **Research & Reuse** — before writing anything new:
   - Run `gh search repos` and `gh search code` to find existing implementations and patterns.
   - Check npm before writing utility code. Prefer battle-tested libraries.
   - Search for open-source projects that solve 80%+ of the problem and can be adapted.
2. **Plan** — run `/everything-claude-code:plan` to produce a structured implementation plan.
3. **Create GitHub issues** using `gh issue create`, following the hierarchy:
   - `type:epic` — large body of work (if not already present)
   - `type:feature` — mid-level feature, part of an epic
   - `type:task` — single implementable unit, part of a feature
   - Apply `status:ready-for-dev` to new issues.
   - See `CLAUDE.md` for label definitions and phase assignments.

## Step 1 — Start the Task

1. Update the task issue **and its parent feature/epic** to `status:in-progress`:
   ```bash
   gh issue edit <number> --remove-label "status:ready-for-dev" --add-label "status:in-progress"
   ```
2. Create a branch named after the **feature** (not the individual task):
   ```bash
   git checkout -b feat/<short-description>
   ```

## Step 2 — Implement (TDD)

1. Run `/everything-claude-code:tdd` to drive implementation test-first:
   - Write tests first (RED)
   - Implement to pass tests (GREEN)
   - Refactor (IMPROVE)
   - Verify 80%+ coverage
2. Commit strategy:
   - One commit per task (GitHub issue) within the feature branch.
   - Split into multiple commits only when the content is logically distinct — do not create unnecessary commits.
   - Follow the commit message format in [git-workflow.md](./git-workflow.md).
3. Keep the task's status label current as work progresses.

## Step 3 — Code Review & Verify

1. Run the **code-reviewer** agent immediately after writing code. Address CRITICAL and HIGH issues; fix MEDIUM issues when possible.
2. Before creating a PR, verify:
   - All tests pass: `npm run test` (from repo root or relevant workspace)
   - TypeScript type check passes: `npm run typecheck`
   - Implementation matches the task requirements

## Step 4 — Create PR

1. Push the branch:
   ```bash
   git push -u origin <branch>
   ```
2. If there are conflicts with `dev`, **rebase** — never merge:
   ```bash
   git fetch origin
   git rebase origin/dev
   ```
3. Create the PR targeting `dev` (never `main`):
   ```bash
   gh pr create --base dev --title "..." --body "..."
   ```
4. Update the task to `status:in-review`.

## Step 5 — After Merge

When the PR has been confirmed merged:
1. Close the related task issue(s) and update labels to `status:done`:
   ```bash
   gh issue close <number>
   ```
2. Check out and pull the latest `dev` from origin:
   ```bash
   git checkout dev
   git pull origin dev
   ```
