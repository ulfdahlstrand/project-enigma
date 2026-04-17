# Funktionsinventering & UI-gap — project-enigma

## Context

Användaren vill ha en sammanställning av alla funktioner i applikationen samt en lista över funktioner som saknar UI. Detta är en **research-leverans**, inte en kodändring — planfilen är slutprodukten.

Underlag: 68 oRPC-procedurer från [apps/backend/src/router.ts](apps/backend/src/router.ts) + frontend-rutter under [apps/frontend/src/routes/](apps/frontend/src/routes/) + hooks/features som anropar dem.

---

## 1. Komplett funktionsinventering (per domän)

### 🧑 Employee (5 procedurer)
| Procedur | UI-ingång |
|---|---|
| `listEmployees` | [/employees](apps/frontend/src/routes/_authenticated/employees/index.tsx) |
| `getEmployee` | [/employees/$id](apps/frontend/src/routes/_authenticated/employees/$id.tsx) |
| `createEmployee` | [/employees/new](apps/frontend/src/routes/_authenticated/employees/new.tsx) |
| `updateEmployee` | EmployeeIdentityForm |
| `deleteEmployee` | EmployeeDeleteDialog |

### 🎓 Education (4)
`listEducation`, `createEducation`, `updateEducation`, `deleteEducation` — allt via [EmployeeEducationSection](apps/frontend/src/routes/_authenticated/employees/detail/EmployeeEducationSection.tsx).

### 📄 Resume (5)
| Procedur | UI-ingång |
|---|---|
| `listResumes` | [/resumes](apps/frontend/src/routes/_authenticated/resumes/index.tsx) |
| `getResume` | [/resumes/$id](apps/frontend/src/routes/_authenticated/resumes/$id.tsx) |
| `createResume` | [/resumes/new](apps/frontend/src/routes/_authenticated/resumes/new.tsx) |
| `updateResume` | ResumeDetailActions |
| `deleteResume` | ResumeDeleteDialog |

### 🌿 Branch (11)
`getResumeBranch`, `listResumeBranches`, `forkResumeBranch`, `finaliseResumeBranch`, `deleteResumeBranch`, `archiveResumeBranch`, `getResumeBranchHistoryGraph`, `createTranslationBranch`, `createRevisionBranch`, `mergeRevisionIntoSource`, `promoteRevisionToVariant`, `markTranslationCaughtUp` — alla exponerade i [/history](apps/frontend/src/routes/_authenticated/resumes/$id_/history/index.tsx), [/variants](apps/frontend/src/routes/_authenticated/resumes/$id_/variants/index.tsx), [/compare](apps/frontend/src/routes/_authenticated/resumes/$id_/compare/index.tsx), [VariantSwitcher](apps/frontend/src/components/VariantSwitcher.tsx), [RevisionsMenu](apps/frontend/src/components/RevisionsMenu.tsx), [TranslationStaleBanner](apps/frontend/src/components/TranslationStaleBanner.tsx).

### 💾 Commit (4)
`saveResumeVersion`, `getResumeCommit`, `listResumeCommits`, `compareResumeCommits` — [/commit/$commitId](apps/frontend/src/routes/_authenticated/resumes/$id/commit/$commitId.tsx), [SaveVersionButton](apps/frontend/src/components/SaveVersionButton.tsx), HistoryCommitTable.

### ✏️ Branch content & skills (2)
`updateResumeBranchContent`, `updateResumeBranchSkills` — edit-rutter + [SkillsEditor](apps/frontend/src/components/SkillsEditor.tsx).

### 🔗 Branch-assignments (10)
`createAssignment`, `deleteAssignment`, `listBranchAssignments`, `listBranchAssignmentsFull`, `addBranchAssignment`, `addResumeBranchAssignment`, `removeBranchAssignment`, `removeResumeBranchAssignment`, `updateBranchAssignment`, `updateResumeBranchAssignment` — [AssignmentEditor](apps/frontend/src/components/AssignmentEditor.tsx) + [ResumeAssignmentsPage](apps/frontend/src/components/resume-detail/ResumeAssignmentsPage.tsx).

### 🤖 AI (7)
| Procedur | UI-ingång |
|---|---|
| `createAIConversation` | AIAssistantDrawer |
| `sendAIMessage` | AIAssistantChat |
| `getAIConversation` | AIAssistantDrawer |
| `listAIConversations` | ConversationHistoryList |
| `closeAIConversation` | AIAssistantDrawer |
| `resolveRevisionSuggestion` | FinalReview / DiffReviewDialog |
| `improveDescription` | ⚠️ **ej anropad direkt** — UI använder conversation-flödet istället via [ImproveDescriptionButton](apps/frontend/src/components/ImproveDescriptionButton.tsx) |

### 📥 Import / 📤 Export (5)
`importCv`, `parseCvDocx` — [/employees/$id/import](apps/frontend/src/routes/_authenticated/employees/$id_.import.tsx).
`exportResumePdf`, `exportResumeDocx`, `exportResumeMarkdown` — [ResumeDetailActions](apps/frontend/src/components/resume-detail/ResumeDetailActions.tsx).

### 🔑 Auth & External AI OAuth (8)
| Procedur | UI-ingång |
|---|---|
| `getCurrentSession` | auth-context (global) |
| `listExternalAIClients` | ExternalAIConnectionsSection |
| `listExternalAIAuthorizations` | ExternalAIConnectionsSection |
| `createExternalAIAuthorization` | [/oauth/authorize](apps/frontend/src/routes/_authenticated/oauth/authorize.tsx) + ExternalAIConnectionsSection |
| `exchangeExternalAILoginChallenge` | OAuth-callback |
| `revokeExternalAIAuthorization` | ExternalAIConnectionsSection |
| `deleteExternalAIAuthorization` | ExternalAIConnectionsSection |
| `refreshExternalAIAccessToken` | ⚠️ **ej i UI** — konsumeras endast av MCP-klienter |

### ⚙️ System & Admin (5)
| Procedur | UI-ingång |
|---|---|
| `listAIPromptConfigs` | [/admin/assistant/prompts](apps/frontend/src/routes/_admin/admin/assistant/prompts/index.tsx) |
| `updateAIPromptFragment` | [/admin/assistant/prompts/$promptId](apps/frontend/src/routes/_admin/admin/assistant/prompts/$promptId.tsx) |
| `getConsultantAIPreferences` | AssistantPreferencesSection |
| `updateConsultantAIPreferences` | AssistantPreferencesSection |
| `getExternalAIContext` | ⚠️ **ej i UI** — konsumeras endast av MCP-servern |

### 🩺 Infra (1)
`health` — ej användar-UI, endast monitoring.

---

## 2. Funktioner som saknar UI

### 🟡 Backend-procedurer utan direkt UI-anrop (3)
Dessa är avsiktligt server-only / MCP-only och behöver förmodligen inte UI — men värt att bekräfta:

1. **`improveDescription`** — orphan? UI använder conversation-flödet istället. Kandidat för radering om ingen annan klient använder den.
2. **`refreshExternalAIAccessToken`** — OAuth-refresh som bara MCP-klienter ringer. Inget UI behövs.
3. **`getExternalAIContext`** — context-endpoint för externa AI-appar. Inget UI behövs.

### 🔴 Funktioner som saknas i både backend och UI (från tidigare session)
Enligt sessionssammanfattning från 2026-04-16 bad användaren om att implementera:

1. **Rebase** — finns inte (grep hittar ingen rebase-kod utanför `merge-revision.ts`).
2. **Revert av commit ("backa till version")** — finns inte. Ingen procedur återställer en branch till en tidigare commit.
3. **"Ful variant"-rebase för översättningar** — partiellt via `markTranslationCaughtUp` + `TranslationStaleBanner`, men ingen faktisk omskrivning av translation-innehåll på toppen av ny källa.

### 🟠 Potentiella UI-luckor värda att kontrollera
Backend-procedurer som **finns** men där UI-ingången är indirekt/gömd:

- **`archiveResumeBranch`** — endast via branch-picker i history-sidan (dölj/visa arkiverade). Ingen dedicerad "arkiverade branches"-vy.
- **`listBranchAssignmentsFull`** — används men svår att hitta; ingen separat "alla assignments"-översikt.
- **`getResumeCommit`** / commit-detail-sidan — endast länkad från HistoryCommitTable, inget breadcrumb-flöde från commit → compare.
- **Duplicerade routes**: `/assistant/preferences` + `/settings/assistant/preferences` (samma) — städa.

---

## 3. Rekommenderat nästa steg

Användaren hade redan beslutat i förra sessionen: **tre separata commits på samma branch** för rebase, revert och ful-translation-rebase. Denna inventering bekräftar att:

- `rebase` + `revert` är **helt nya features** (backend + UI från noll).
- `markTranslationCaughtUp` finns men **omslag saknas** — "ful rebase" = skapa ny translation-branch från ny källa + kopiera över befintligt översatt innehåll där det går.

Innan implementation startar: bekräfta exakt vilken semantik som önskas för rebase (linjär replay på annan bas?) och revert (ny commit som inverterar, eller branch-reset?).

---

## Verifiering

Denna inventering är en läsbaserad leverans. För att verifiera:

- `cat apps/backend/src/router.ts | grep -E ":\s*\w+Handler" | wc -l` → ska visa ~68
- [Grep](apps/frontend/src) efter varje procedurnamn — 65/68 ska ge träff, 3 (listade ovan) ska inte ge det.
