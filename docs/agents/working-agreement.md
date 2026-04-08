# Shared Working Agreement

Shared repo-level working rules for any coding agent used in this project.

## Command Strategy

- Prefer `gh` for GitHub issue and PR workflows
- Prefer read-only repo inspection with commands such as `ls`, `pwd`, `rg`, `rg --files`, `cat`, `sed`, `head`, `tail`, `find`, `git status`, `git diff`, `git show`, and `git log`
- Prefer non-destructive Git commands for normal work, such as `git add`, `git commit -m`, `git checkout -b`, `git fetch origin dev`, and `git push -u origin`
- Treat destructive commands, force operations, database changes, and broad shell or network access as higher-risk actions that should be used deliberately
- Keep command approvals narrowly scoped when the environment supports persistent command allowlists

## Issue Workflow

- When creating issue hierarchies, follow the Flower structure: `type:epic` -> `type:feature` -> `type:task`
- New task issues should use `status:ready-for-dev` unless there is a clear reason to use a different status

## Session Strategy

- Prefer a new session for each task issue to keep context isolated and make issue-to-session ownership clearer
