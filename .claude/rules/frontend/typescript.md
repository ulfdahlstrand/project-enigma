---
globs: ["apps/frontend/**"]
---

# TypeScript — Frontend

## Types
- Explicit types on all exported functions and component props
- `interface` for extendable object shapes, `type` for unions/mapped types
- Prefer string literal unions over `enum`
- `unknown` over `any` — narrow safely before use
- Never use `React.FC`

## React props
- Define props as a named `interface` or `type`, never inline anonymous objects
- Type callback props explicitly: `onSelect: (id: string) => void`

## Immutability
Spread operator for all state updates — never mutate objects or arrays in place.

## Error handling
`async/await` with `try/catch`. Narrow `unknown` errors before accessing `.message`.
