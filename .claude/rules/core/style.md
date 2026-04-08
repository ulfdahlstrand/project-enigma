# Coding Style

## Immutability (CRITICAL)
Never mutate — always return new objects via spread or equivalent.

## File size
200–400 lines typical, 800 max. High cohesion, low coupling. Organize by feature/domain.

## Functions
< 50 lines. No deep nesting (> 4 levels). No hardcoded values.

## Don't add
- Error handling for impossible cases
- Helpers for one-time use
- Backwards-compat shims for removed code
- Comments where logic is self-evident
- Features not explicitly requested
