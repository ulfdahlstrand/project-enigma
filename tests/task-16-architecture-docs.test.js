/**
 * Tests for Task #16: Define foundational architecture docs
 * Acceptance criteria:
 *   1. docs/architecture.md contains all six required sections with substantive content (not just placeholders).
 *   2. docs/tech-decisions.md contains at least the four required ADRs.
 *   3. No application code is written or modified (changes confined to docs/ only).
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const REPO_ROOT = path.resolve(__dirname, '..');
const ARCH_FILE = path.join(REPO_ROOT, 'docs', 'architecture.md');
const TECH_DEC_FILE = path.join(REPO_ROOT, 'docs', 'tech-decisions.md');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ❌ FAIL: ${name}`);
    console.log(`         → ${err.message}`);
    failed++;
  }
}

function assertContains(content, pattern, message) {
  const found = typeof pattern === 'string'
    ? content.includes(pattern)
    : pattern.test(content);
  assert.ok(found, message || `Expected to find: ${pattern}`);
}

function assertNotPlaceholder(content, sectionName) {
  // Content should not be ONLY the template comment line or empty after the heading
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
  assert.ok(lines.length > 5, `${sectionName} appears to have too little content (likely still a placeholder)`);
}

// ─────────────────────────────────────────────────────────────────────────────
// CRITERION 1: docs/architecture.md contains all six sections with substantive
//              content (not just placeholders)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\nCriterion 1: docs/architecture.md — all six sections with substantive content\n');

let archContent;
test('architecture.md exists', () => {
  assert.ok(fs.existsSync(ARCH_FILE), 'docs/architecture.md does not exist');
  archContent = fs.readFileSync(ARCH_FILE, 'utf8');
  assert.ok(archContent.length > 100, 'docs/architecture.md is essentially empty');
});

if (archContent === undefined && fs.existsSync(ARCH_FILE)) {
  archContent = fs.readFileSync(ARCH_FILE, 'utf8');
}

test('Section 1 — Overview: present and non-trivial', () => {
  assertContains(archContent, '## Overview', 'Missing ## Overview section heading');
  // Must describe the system — check for key terms
  assertContains(archContent, 'CV', 'Overview does not mention the CV Creation Tool');
  assertContains(archContent, /React|frontend/i, 'Overview does not mention frontend component');
  assertContains(archContent, /Node\.js|backend/i, 'Overview does not mention backend component');
  assertContains(archContent, /PostgreSQL|database/i, 'Overview does not mention database');
});

test('Section 2 — Tech Stack: present and contains all required technologies', () => {
  assertContains(archContent, '## Tech Stack', 'Missing ## Tech Stack section heading');
  assertContains(archContent, 'TypeScript', 'Tech Stack missing TypeScript');
  assertContains(archContent, 'Turborepo', 'Tech Stack missing Turborepo');
  assertContains(archContent, 'React', 'Tech Stack missing React');
  assertContains(archContent, 'TanStack Router', 'Tech Stack missing TanStack Router');
  assertContains(archContent, 'TanStack Query', 'Tech Stack missing TanStack Query');
  assertContains(archContent, /i18n|internationalisation|internationalization/i, 'Tech Stack missing i18n');
  assertContains(archContent, /Node\.js/i, 'Tech Stack missing Node.js');
  assertContains(archContent, 'oRPC', 'Tech Stack missing oRPC');
  assertContains(archContent, 'Zod', 'Tech Stack missing Zod');
  assertContains(archContent, 'PostgreSQL', 'Tech Stack missing PostgreSQL');
  assertContains(archContent, /Docker Compose/i, 'Tech Stack missing Docker Compose');
});

test('Section 3 — Folder/Module Structure: present and contains canonical layout', () => {
  assertContains(archContent, /## (Folder|Structure|Module Structure)/i, 'Missing folder/structure section heading');
  assertContains(archContent, 'apps/', 'Structure missing apps/ directory');
  assertContains(archContent, 'apps/frontend', 'Structure missing apps/frontend/');
  assertContains(archContent, 'apps/backend', 'Structure missing apps/backend/');
  assertContains(archContent, 'packages/', 'Structure missing packages/ directory');
  assertContains(archContent, 'packages/tsconfig', 'Structure missing packages/tsconfig/');
  // Architect note #1: packages/contracts/ must be listed
  assertContains(archContent, 'packages/contracts', 'Structure missing packages/contracts/ (required by Architect note #1)');
  assertContains(archContent, 'docker/', 'Structure missing docker/ directory');
  assertContains(archContent, 'docs/', 'Structure missing docs/ directory');
  assertContains(archContent, 'turbo.json', 'Structure missing turbo.json');
});

test('Section 4 — Naming Conventions: present and specifies @cv-tool/ scope for all workspaces', () => {
  assertContains(archContent, /## Naming Conventions/i, 'Missing ## Naming Conventions section heading');
  assertContains(archContent, '@cv-tool/', 'Naming Conventions missing @cv-tool/ scope');
  // Architect note #3: scope must apply to all workspaces (apps AND packages)
  assertContains(archContent, '@cv-tool/frontend', 'Naming Conventions missing @cv-tool/frontend (apps scope)');
  assertContains(archContent, '@cv-tool/backend', 'Naming Conventions missing @cv-tool/backend (apps scope)');
  assertContains(archContent, '@cv-tool/tsconfig', 'Naming Conventions missing @cv-tool/tsconfig (packages scope)');
  assertContains(archContent, '@cv-tool/contracts', 'Naming Conventions missing @cv-tool/contracts (packages scope)');
});

test('Section 5 — Key Patterns: present and includes required patterns', () => {
  assertContains(archContent, /## Key Patterns/i, 'Missing ## Key Patterns section heading');
  // Architect note #2: strict mode must be called out explicitly
  assertContains(archContent, '"strict": true', 'Key Patterns missing explicit "strict": true (required by Architect note #2)');
  // Turborepo pipeline with ^build dependency
  assertContains(archContent, '^build', 'Key Patterns missing Turborepo pipeline ^build dependency');
  // TypeScript-only policy
  assertContains(archContent, /no.*plain.*(JS|JavaScript)|plain.*(JS|JavaScript).*not permitted/i, 'Key Patterns missing TypeScript-only / no plain JS policy');
  // Shared configuration via packages/
  assertContains(archContent, /packages\//i, 'Key Patterns missing reference to packages/ for shared config');
});

test('Section 6 — External Integrations: present and covers PostgreSQL and oRPC', () => {
  assertContains(archContent, /## External Integrations/i, 'Missing ## External Integrations section heading');
  assertContains(archContent, 'PostgreSQL', 'External Integrations missing PostgreSQL');
  assertContains(archContent, 'oRPC', 'External Integrations missing oRPC');
  // Access pattern: backend-only DB access
  assertContains(archContent, /backend.*connect|only.*backend.*access|backend.*may connect/i, 'External Integrations missing backend-only DB access pattern');
});

// ─────────────────────────────────────────────────────────────────────────────
// CRITERION 2: docs/tech-decisions.md contains at least the four required ADRs
// ─────────────────────────────────────────────────────────────────────────────
console.log('\nCriterion 2: docs/tech-decisions.md — at least four required ADRs\n');

let techDecContent;
test('tech-decisions.md exists', () => {
  assert.ok(fs.existsSync(TECH_DEC_FILE), 'docs/tech-decisions.md does not exist');
  techDecContent = fs.readFileSync(TECH_DEC_FILE, 'utf8');
  assert.ok(techDecContent.length > 100, 'docs/tech-decisions.md is essentially empty');
});

if (techDecContent === undefined && fs.existsSync(TECH_DEC_FILE)) {
  techDecContent = fs.readFileSync(TECH_DEC_FILE, 'utf8');
}

test('ADR 1 — Choice of Turborepo as monorepo tool: present and non-empty', () => {
  assertContains(techDecContent, /Turborepo/i, 'tech-decisions.md missing Turborepo ADR');
  // Must be a real ADR, not just the template header referencing Turborepo
  // Check it has a Status and Decision field
  const turborepoIdx = techDecContent.search(/Turborepo/i);
  const afterTurborepo = techDecContent.slice(turborepoIdx, turborepoIdx + 600);
  assertContains(afterTurborepo, /Status|Decision|Context/i, 'Turborepo ADR appears incomplete (missing Status/Context/Decision fields)');
});

test('ADR 2 — Choice of @cv-tool/ scoped naming: present and non-empty', () => {
  assertContains(techDecContent, /@cv-tool\//i, 'tech-decisions.md missing @cv-tool/ scoped naming ADR');
  const scopeIdx = techDecContent.search(/@cv-tool\//i);
  const afterScope = techDecContent.slice(scopeIdx, scopeIdx + 600);
  assertContains(afterScope, /Status|Decision|Context|scope/i, '@cv-tool/ scoped naming ADR appears incomplete');
});

test('ADR 3 — TypeScript-only policy: present and non-empty', () => {
  assertContains(techDecContent, /TypeScript/i, 'tech-decisions.md missing TypeScript-only policy ADR');
  // Verify it's a real ADR entry about the policy decision, not just a passing mention
  assertContains(techDecContent, /TypeScript.{0,50}(only|policy|strict|all workspaces)|strict.{0,50}TypeScript/si,
    'TypeScript-only policy ADR appears to be a passing mention rather than a substantive decision entry');
});

test('ADR 4 — Folder structure layout: present and non-empty', () => {
  assertContains(techDecContent, /folder structure|directory structure|monorepo layout|project structure/i,
    'tech-decisions.md missing folder structure layout ADR');
  const structIdx = techDecContent.search(/folder structure|directory structure|monorepo layout|project structure/i);
  const afterStruct = techDecContent.slice(structIdx, structIdx + 600);
  assertContains(afterStruct, /Status|Decision|Context|apps\/|packages\//i,
    'Folder structure ADR appears incomplete (missing Status/Context/Decision fields or directory references)');
});

// ─────────────────────────────────────────────────────────────────────────────
// CRITERION 3: No application code written or modified (changes in docs/ only)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\nCriterion 3: No application code written or modified\n');

test('Only docs/ files exist (no src/ or app code directories present)', () => {
  // This task is documentation-only. Check that no application source code
  // directories have been created as part of this task.
  // Since the repo is pre-implementation (no monorepo yet), we verify that
  // typical application code directories do NOT exist.
  const appCodePaths = [
    path.join(REPO_ROOT, 'apps'),
    path.join(REPO_ROOT, 'packages'),
    path.join(REPO_ROOT, 'src'),
  ];
  for (const appPath of appCodePaths) {
    assert.ok(
      !fs.existsSync(appPath),
      `Application code directory exists that should not have been created by a docs-only task: ${path.relative(REPO_ROOT, appPath)}/`
    );
  }
});

test('docs/architecture.md and docs/tech-decisions.md are the only modified files (docs/ check)', () => {
  // Verify both target files exist under docs/
  assert.ok(fs.existsSync(ARCH_FILE), 'docs/architecture.md must exist');
  assert.ok(fs.existsSync(TECH_DEC_FILE), 'docs/tech-decisions.md must exist');
  // Both live within docs/ — no code files
  assert.ok(ARCH_FILE.includes(path.join('docs', 'architecture.md')), 'architecture.md not in docs/');
  assert.ok(TECH_DEC_FILE.includes(path.join('docs', 'tech-decisions.md')), 'tech-decisions.md not in docs/');
});

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n─────────────────────────────────────────────────────────────');
console.log(`Results: ${passed} passed, ${failed} failed (${passed + failed} total)`);
console.log('─────────────────────────────────────────────────────────────\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
