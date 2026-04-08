---
globs: ["apps/frontend/**"]
---

# Frontend Components & Hooks

## Components
- MUI `sx` prop for all styling — no inline `style`, no CSS modules
- Small, focused components — extract sub-components when render body > ~80 lines
- Pass data down, callbacks up — avoid prop drilling beyond 2 levels (use context)

## Custom hooks
- `use` prefix, return plain objects (not arrays unless it's a tuple-by-convention)
- Keep side-effects in hooks, not components
- Controlled component pattern: lift state up when multiple siblings share it

## State
- Prefer derived state over duplicated state
- `useState` for local UI state, React Query for server state
- Never mix server cache state with local UI state

## CV-specific
- CVs always written in third person — if generating content, recommend this to user
- AI reasoning must follow UI locale, not CV content language
