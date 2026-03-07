# Developer Playbook

> Maintained by Developer Agents. Each entry is a reusable implementation recipe distilled from a completed task.
> Agents: check this index before writing any code — a matching recipe may already exist.

## How to Use

1. Find a matching row in the index below.
2. Read the linked recipe file **before** writing any code.
3. Follow the steps. Deviate only when the task explicitly requires it, and note the deviation.

## How to Add an Entry

Use this template for each new playbook file:

```markdown
# Recipe: <Title>

## When to Use
One or two sentences describing when this recipe applies.

## Context / Background
Why this pattern exists; relevant ADR numbers, constraints, or gotchas discovered
during the original task.

## Steps
1. Step one
2. Step two
3. ...

## Gotchas
- Bullet-list of pitfalls discovered during the original implementation.

## Acceptance Checklist
- [ ] Criterion one
- [ ] Criterion two

## Reference Tasks
- #<issue-number> — <task title>
```

---

## Index

| Recipe | File | Applies When |
|--------|------|--------------|
| Adopting a new frontend library — architecture documentation | [`architecture-doc-update.md`](./architecture-doc-update.md) | Adding a new technology to the frontend stack requires updating `architecture.md`, `tech-decisions.md`, and the relevant `docs/arch/` sub-document |
| Installing a UI library and wiring its providers | [`mui-provider-setup.md`](./mui-provider-setup.md) | Installing Material UI (or similar) into `@cv-tool/frontend` and wrapping the app tree with `ThemeProvider`, `CssBaseline`, and a bare `theme.ts` config file |
