# Testing Mocking

## Built-in Only

Use Vitest built-ins for mocking:

- `vi.mock()`
- `vi.fn()`
- `vi.spyOn()`

No extra mocking libraries are permitted without a dedicated ADR.

## Database Client Mocking

Prefer dependency injection for database access in testable backend code.

Good pattern:

- service/function accepts a DB client parameter

Avoid:

- importing and hard-binding a global DB singleton inside logic that should be
  unit-testable

## External API Mocking

No network interception library is approved by default. Mock external API calls
at the module boundary instead.
