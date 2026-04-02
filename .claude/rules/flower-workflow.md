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

### Parallelisation & Delegation

Claude implements tasks directly by default — do not idle waiting for delegation when the work can be done now.

When a feature breaks down into **independent sub-tasks**, consider running them in parallel rather than sequentially:

| Worker | Use when |
|--------|----------|
| **Claude sub-agent** (`Agent` tool) | Sub-task needs codebase exploration, multi-file reasoning, or context from this conversation. Spin up via the `Agent` tool with `subagent_type: "general-purpose"` or a specialist agent. |
| **Codex** (`/codex:rescue`) | Sub-task is self-contained, mechanical, and can be fully specified in 2–5 sentences (e.g. refactoring, type fixes, adding tests, i18n keys, schema changes touching 1–3 files). |

**Rules:**
- Implement directly in Claude first if the task is small or sequential — no need to delegate.
- Spawn multiple workers **in the same message** to parallelise (multiple `Agent` calls, or multiple `/codex:rescue` calls).
- After any worker completes, review the diff, run `npm run typecheck && npm test -- --run`, and integrate before merging the results.
- Never spawn a worker just to avoid doing the work — only when there is a genuine parallelism benefit or the sub-task is a better fit for a specialist.

**While waiting for background agents — do NOT go silent:**
After spawning background agents, actively keep the session alive by polling their output files every ~30 seconds using Bash. Report status to the user without being asked:
```bash
# Check if an agent's output file contains a result line
grep -c '"type":"result"' <output_file> 2>/dev/null && echo "done" || echo "still running"
# Or check for created files directly
ls -la <expected_output_file> 2>/dev/null || echo "not yet"
```
- Poll and post a brief status update ("Agent A done ✅, Agent B still running ⏳") every ~30s.
- Use the wait time to do independent work (e.g. write the orchestrating file while workers produce sub-files).
- Only stop polling when all agents have completed or errored.

**Example Codex prompt pattern:**
```
File: apps/frontend/src/locales/en/common.json (and sv/common.json)
Task: Add i18n keys for the new DeleteConfirmDialog component.
Keys needed under resume.edit:
  - deleteConfirmTitle: "Delete resume?"
  - deleteConfirmBody: "This action cannot be undone."
  - deleteConfirmButton: "Yes, delete"
Acceptance: Both locale files parse as valid JSON and contain the new keys.
```

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
