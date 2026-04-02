# Testing Coverage

## Thresholds

All workspaces aim for a minimum 80% coverage threshold across:

- statements
- branches
- functions
- lines

## Provider

Vitest uses the `v8` coverage provider.

## Output

Coverage reports are written to `coverage/` within each workspace and must be
gitignored.

## Exceptions

If a workspace cannot reasonably meet the threshold, the exception should be
documented in:

- the workspace `vitest.config.ts`
- the PR introducing the exception
