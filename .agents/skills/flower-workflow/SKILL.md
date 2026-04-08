---
name: flower-workflow
description: End-to-end task flow for this project — from GitHub issue discovery through implementation to merged PR with correct labels.
origin: project
---

# Flower Workflow

End-to-end task flow from discovery to merge.

## Step 0 — Check for a GitHub Issue

```bash
gh issue list
```

If no issue exists → research, plan, then create issues with hierarchy:
- `type:epic` → `type:feature` → `type:task`
- Apply `status:ready-for-dev` to new tasks

## Step 1 — Start the Task

```bash
gh issue edit <number> --remove-label "status:ready-for-dev" --add-label "status:in-progress"
git checkout -b feat/<short-description>
```

Update parent feature/epic to `status:in-progress` too.

## Step 2 — Implement (TDD)

- Write tests first (RED → GREEN → refactor)
- One commit per task; format: `<type>: <description>`
- 80%+ coverage

## Step 3 — Code Review & Verify

- Run **code-reviewer** agent
- `npm run test` and `npm run typecheck` must pass

## Step 4 — Create PR

```bash
git push -u origin <branch>
gh pr create --base dev --title "..." --body "..."
gh issue edit <number> --remove-label "status:in-progress" --add-label "status:in-review"
```

PR targets `dev`, never `main`.

## Step 5 — After Merge

```bash
gh issue close <number>
git checkout dev && git pull origin dev
```

Update labels to `status:done`.
