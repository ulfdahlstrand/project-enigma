# Agents — when to use

| Agent | Trigger |
|-------|---------|
| **planner** | Complex feature or refactor — plan before coding |
| **tdd-guide** | New feature or bug fix — write tests first |
| **code-reviewer** | Immediately after writing/modifying code |
| **security-reviewer** | Code touches auth, user input, API, or secrets |
| **build-error-resolver** | Build or TypeScript errors |
| **e2e-runner** | Critical user flow changes |
| **refactor-cleaner** | Dead code or consolidation |

Run independent agents **in parallel** — never sequentially when tasks don't depend on each other.
