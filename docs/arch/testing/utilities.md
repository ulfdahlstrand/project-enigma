# Testing Utilities

## Shared Test Utilities

Each workspace with tests may contain a `src/test-utils/` directory for shared
helpers.

## Frontend

Frontend custom render helpers should wrap the providers required by the app,
such as:

- QueryClientProvider
- RouterProvider
- ThemeProvider + CssBaseline
- I18nextProvider

Approved frontend test dependencies:

- `@testing-library/react`
- `@testing-library/jest-dom`
- `@testing-library/user-event`

## Backend

Backend shared helpers typically cover:

- database mocking
- integration DB setup
- request/procedure helpers
