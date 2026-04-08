# Security

- Never hardcode secrets — always use env vars; fail fast if missing
- Validate all user input at system boundaries (Zod preferred)
- Parameterized queries only — no string-interpolated SQL
- No `console.log` in production — use the project logger
- On any security issue: stop, use **security-reviewer** agent, fix before continuing
