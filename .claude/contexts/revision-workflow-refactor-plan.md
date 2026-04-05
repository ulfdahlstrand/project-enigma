# Revision Workflow Refactor Plan

## Mål

Rensa upp och modernisera `message.ts` (backend) och den tillhörande frontend-orkestreringslogiken. Resultatet ska vara en tydlig, testbar arkitektur utan legacy-fallbacks.

---

## Status

| Fas | Beskrivning | Status |
|-----|-------------|--------|
| Fas 1 | Persist work items + branch chat state | ✅ Klar (commit: `94b4ed6`) |
| Fas 2 | Blockera legacy fenced-JSON fallback i message.ts | ✅ Klar |
| Fas 3 | Sluta persistera interna tool-calls som synliga assistentmeddelanden | ✅ Klar |
| Fas 4 | Lägg till `needsContinuation`-signal för frontend-auto-fortsättning | ✅ Klar |
| Fas 5 | Extrahera revision-workflow-engine till separat modul | 🔄 Pågår |

---

## Fas 5 — Extrahera revision workflow engine

### Vad som gjorts

`revision-workflow-engine.ts` är skapad med:
- Alla revision-specifika hjälpfunktioner flyttade från `message.ts`
- `runRevisionWorkflow` — huvud-export, kör hela tool-call-loopen
- `needsContinuation`-detektering i slutet av engine
- Dependency injection för `callOpenAI` och `persistAssistantMessage`

### Vad som återstår

**Uppdatera `message.ts`:**

1. Ta bort alla hjälpfunktioner som nu finns i engine (ungefär rad 62–810):
   - `requiresExplicitAssignmentWorkQueue`
   - `isWaitingForRevisionScopeDecision`
   - `detectConversationLanguage`
   - `buildHelpMessage`
   - `buildExplainMessage`
   - `buildStatusMessage`
   - `MAX_BACKEND_TOOL_LOOPS`
   - `REVISION_TOOL_GUARDRAIL_MESSAGE`
   - Alla interna hjälpfunktioner för loopen

2. Lägg till import:
   ```typescript
   import { runRevisionWorkflow, requiresExplicitAssignmentWorkQueue, isWaitingForRevisionScopeDecision } from "./revision-workflow-engine.js";
   ```

3. Ersätt revision-blocket (rad ~1056–1831) med ett anrop:
   ```typescript
   const { assistantRow, needsContinuation } = await runRevisionWorkflow(db, {
     conversationId: input.conversationId,
     conversation,
     userMessage: input.userMessage,
     existingMessages,
     openAIMessages,
     firstAssistantMessage,
     initialAssistantRow,
     callOpenAI,
     persistAssistantMessage,
     maxHistoryMessages: MAX_HISTORY_MESSAGES,
   });
   ```

4. Målet: `message.ts` ska bli ~350–400 rader (från ~1916).

### TypeScript-kontrakt

```typescript
// revision-workflow-engine.ts exports:
export interface RevisionWorkflowResult {
  readonly assistantRow: AssistantRow;
  readonly needsContinuation: boolean;
}

export async function runRevisionWorkflow(
  db: Kysely<Database>,
  context: {
    conversationId: string;
    conversation: ConversationRow;
    userMessage: string;
    existingMessages: MessageRow[];
    openAIMessages: Array<any>; // mutated in-place
    firstAssistantMessage: any;
    initialAssistantRow: AssistantRow | null;
    callOpenAI: (messages: Array<any>, tools?: Array<Record<string, unknown>>) => Promise<any>;
    persistAssistantMessage: (content: string) => Promise<AssistantRow>;
    maxHistoryMessages: number;
  },
): Promise<RevisionWorkflowResult>
```

---

## Frontend-ändringar (Fas 4, redan klara)

### `packages/contracts/src/ai-conversations.ts`
```typescript
export const sendAIMessageOutputSchema = aiMessageSchema.extend({
  needsContinuation: z.boolean(),
});
```

### `apps/frontend/src/hooks/ai-assistant.ts`
- `MAX_AUTO_CONTINUATIONS = 10` — cap för rekursiv auto-fortsättning
- `continuePendingWorkItems(cid, depth)` — rekursiv funktion som postar interna meddelanden
- `INTERNAL_AUTOSTART_PREFIX` — sentinel för interna continuation-meddelanden

---

## Viktiga designbeslut

| Beslut | Motivering |
|--------|-----------|
| DB (`ai_revision_work_items`) är enda sanningskällan för workflow-state | Ersätter legacy fenced-JSON i assistentmeddelanden |
| Dependency injection för `callOpenAI` och `persistAssistantMessage` | Undviker cirkulärt beroende mellan engine och message.ts |
| `openAIMessages` muteras in-place i engine | Undviker dyra kopior; dokumenterat med kommentar |
| `initialAssistantRow` skickas som context | message.ts kan ha persisterat ett tidigt svar innan engine anropas |
| Frontend-cap på 10 auto-kontinuationer | Skyddar mot oändliga loopar vid buggar |

---

## Nästa steg efter Fas 5

- Verifiera TypeScript (`npm run typecheck`)
- Kör tester (`npm run test`)
- Committa Fas 5
- Städa upp eventuella `any`-typer i engine-filen
