---
alwaysApply: false
---

# Model Selection

| Model | Use for |
|-------|---------|
| **Haiku 4.5** | Lightweight/frequent agents, worker agents in pipelines |
| **Sonnet 4.6** | Main development, orchestration, complex coding |
| **Opus 4.6** | Complex architectural decisions, maximum reasoning |

## Context window
Avoid last 20% for large refactors, multi-file features, or complex debugging.
Prefer single-file edits, utility creation, and docs at higher context usage.
