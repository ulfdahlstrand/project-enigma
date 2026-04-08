---
alwaysApply: true
---

# Git

## Commit format
`<type>: <description>` — types: feat, fix, refactor, docs, test, chore, perf, ci

## Rules
- One commit per task (GitHub issue), one PR per feature branch
- PR targets `dev` (never `main`); rebase on dev conflicts, never merge
- Push after every completed feature
- Attribution disabled globally — no Co-Authored-By trailer needed
