---
alwaysApply: false
---

# Development Workflow

## Before writing any new code
1. `gh search repos` and `gh search code` for existing implementations
2. Check npm for libraries solving 80%+ of the problem
3. Use **planner** agent to produce structured implementation plan

## TDD cycle (mandatory)
1. Write test → RED
2. Implement minimal code → GREEN
3. Refactor → IMPROVE
4. Verify 80%+ coverage

## After writing code
- **code-reviewer** agent immediately
- Address CRITICAL + HIGH issues; fix MEDIUM when possible
