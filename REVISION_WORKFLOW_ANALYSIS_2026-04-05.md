# Revision Workflow — Djupanalys och åtgärdsplan

> Skapad: 2026-04-05
> Baserad på: genomläsning av `message.ts`, `action-orchestration.ts`, `revision-tools.ts`, `revision-work-items.ts` samt direkta databasuttag.

---

## 1. Vad databasen faktiskt visar

### Konversationsöversikt (per 2026-04-05)

| Konversation | Work items i DB | Pending | Guardrails | Tomma msg |
|---|---|---|---|---|
| CV review revisions (`8ab01d3e`) | 31 | 28 | 4 | 0 |
| CV stavfel korrektion (`0328e86f`) | 0 | – | 0 | 0 |
| CV revision request (`8d5c595c`) | 0 | – | 2 | 0 |
| Stavfel i CV (`8ba91cf8`) | 0 | – | 15 | 0 |
| Rättstavning CV korrektur (`c96a0b36`) | 0 | – | 15 | 1 |
| CV qwerty removal (`4c85c408`) | 0 | – | 38 | 4 |
| CV revision initiated (`070cedab`) | 0 | – | 27 | 3 |

**Mönster:** Konversationer utan DB-work-items (äldre) hamnar i guardrail-stormar och
genererar tomma meddelanden. Den senaste konversationen (`8ab01d3e`) har korrekt
DB-state men är fastnad p.g.a. loopgräns.

---

## 2. Rotorsakerna — specifika och verifierade

### Bug A: `MAX_BACKEND_TOOL_LOOPS = 8` — för låg, confirmed

Konversationen `8ab01d3e` har **31 work items** (titel, konsulttitel, presentation,
sammanfattning + 27 uppdrag). Varje item kräver minimum 2 yttre loop-iterationer
(inspect → suggest), ofta 3–4 med guardrails.

Steg-för-steg-räkning av `sendAIMessage("nej")` för denna konversation:

```
i=0: Guardrail (fel tool) → callOpenAI → continue
i=1: inspect_resume_section(consultantTitle) → callOpenAI → continue
i=2: set_revision_suggestions(consultantTitle) → persist → callOpenAI → continue
i=3: Free text → persist → orchestration → callOpenAI → continue
i=4: inspect_resume_section(presentation) → callOpenAI → continue
i=5: Guardrail (fel tool för presentation) → callOpenAI → continue
i=6: set_revision_suggestions(presentation) → persist → callOpenAI → continue
i=7: Free text → persist → generera autostart för summary → callOpenAI → continue
i=8 → loop exits (8 < 8 = false)
```

**Resultat:** 2 items processade per HTTP-anrop. 28 kvar = ~14 anrop till.
Varje anrop kräver ett nytt användarmeddelande. Användaren ser bara
"Fortsätt med fler ändringar..." och vet inte om att hen måste skicka 14 meddelanden till.

Den sista `internal_autostart` (08:00:29.651) persisterades till `ai_message_deliveries`
men model-svaret på den **loggades aldrig** — loopen exitade precis efter `continue`
från `callOpenAI(nextMessages)` vid i=7.

### Bug B: `assistantRow = null` + `assistantContent = ""` vid loopens slut

Scenario:
1. Initial `callOpenAI` returnerar `tool_calls` (ingen text) → rad 1048 skippar persist → `assistantRow = null`
2. Hela loopen processas utan att en textrespons nånsin produceras (t.ex. 8 guardrail-iterationer i rad)
3. Loop exiterar, `assistantRow` är fortfarande `null`, `assistantContent = ""`
4. Fallback på rad 1811: `persistAssistantMessage("")` anropas
5. Kastas `"AI returned an empty assistant message during the revision workflow."` (rad 986)
   — ELLER (i äldre kod utan den checken): ett tomt meddelande med `length=0` lagras i DB

**Bekräftelse i databasen:** `c96a0b36`, `4c85c408`, `070cedab` har alla `empty_msgs > 0`.
Tre av dessa är fortfarande öppna konversationer fast de aldrig kan göra progress.

### Bug C: Guardrail-storm för skills-item — modellen fastnar

I `070cedab` och `4c85c408` triggrar `[[internal_guardrail]]` **38 respektive 27 gånger**
för samma work item (`w-2`, section=skills). Orsak:

- `isAllowedToolCallForPendingWorkItem` för `section="skills"` tillåter bara
  `inspect_resume_skills` eller `set_revision_work_items`
- Men skills-guardrail-meddelandet (rad 400–401) hamnar i else-grenen:
  *"Inspect the exact source text for section skills"* — ett instruktionsfel
  som inte matchar allowed tools (det rätta verktyget är `inspect_resume_skills`,
  inte `inspect_resume_section`)
- Modellen kallar `inspect_resume_section` (fel), ny guardrail, o.s.v. i 8 iterationer
- Loopen exiterar, `assistantRow = null` → tommeddelande

**Notera:** `buildPendingWorkItemGuardrailMessage` (rad 384–407) har skills-meddelandet:
```
item.section === "skills"
  ? "This is a broad skills work item. First inspect..."   ← broad skills branch
  : `Inspect the exact source text for section ${item.section}...`   ← else
```
Men `isBroadSkillsWorkItem` kräver keywords om "reorder/reorganize/groups".
Work-itemet "Review skills for 'qwerty'" matchar INTE — hamnar i else-grenen.
Meddelandet säger "Inspect the exact source text for section skills" men allowed tool
är `inspect_resume_skills`, inte `inspect_resume_section`. Modellen vet inte vilket.

### Bug D: Två parallella state-källor — legacy JSON vs DB

Äldre konversationer (`070cedab`, `4c85c408` m.fl.) har **0 rader i `ai_revision_work_items`**
trots att `tool_result` för `set_revision_work_items` visar `{persisted: true}`.

Orsak: Orkestreringen i `message.ts` (rad 1658–1660) har en fallback:
```typescript
orchestrationMessage = persistedAutomation
  ? { kind: "automation", content: `... ${persistedAutomation}` }
  : deriveNextActionOrchestrationMessage(orchestrationHistory);  // ← legacy
```

`deriveNextActionOrchestrationMessage` (i `action-orchestration.ts`) läser state
från fenced-JSON i `ai_messages`, **inte från DB**. För konversationer där DB-tabellen
var tom men fenced-JSON fanns i historiken aktiveras denna fallback.

Konsekvens: state sources divergerar. Guardrail-kontroller i loopen använder DB-items
(`persistedWorkItems`), men orkestrering använder fenced-JSON. Detta ger inkonsekventa
beslut inom samma request.

### Bug E: `openAIMessages` clobbras av orchestration-grenen (rad 1682)

Orchestration-greenen (rad 1682–1697) bygger `nextMessages` från `updatedHistory`
(DB) + orchestration-meddelande. Men `openAIMessages` har ackumulerat
tool call/result-par in-memory under de senaste iterationerna.

När `callOpenAI(nextMessages)` anropas på rad 1700 ser modellen **inte** de senaste
tool call/result-paren. Modellen saknar kontext → ökar risk för fel tool call → guardrail.

### Bug F: Fri text ("Fortsätt med fler...") som continuation-signal är trasig UX

Varje gång loopen exiterar genereras en fri text som "Fortsätt med fler ändringar eller
områden när du är redo." Användaren ser detta som att AI är klar och väntar. I själva
verket finns 28 pending items i DB och systemet behöver ytterligare ~14 meddelanden.

Det finns **ingen signal** till frontend om att backend har pågående arbete.

---

## 3. Vad som faktiskt fungerar

- Work items skapas korrekt i DB för den senaste konversationen (`8ab01d3e`)
- DB-state är rätt källan till sanning (section-title, consultant-title, presentation = completed)
- `inspect_resume_section` och `set_revision_suggestions` exekveras korrekt per item
- `persistRevisionToolCallSuggestions` fungerar (suggestions visas i frontend)
- Guardrail-mekanismen *i sig* är korrekt — det är guardrail-meddelandet för skills
  och loopgränsen som gör att den hamnar i storm

---

## 4. Prioriterad åtgärdsplan

### Fas 1 — Omedelbar buggfix (1 commit, ~2–3 timmar)

Tre minimala ändringar i `message.ts`:

**1a. Höj `MAX_BACKEND_TOOL_LOOPS`**
```typescript
// Från:
const MAX_BACKEND_TOOL_LOOPS = 8;
// Till:
const MAX_BACKEND_TOOL_LOOPS = 40;
```
Motivering: 31 items × 2-3 iterationer per item = 62–93 iterationer behövs.
8 täcker inte ens 3 items med margin för guardrails.

**1b. Fixa fallback på rad 1811 — assistantRow=null + content=""**

Nuvarande:
```typescript
if (!assistantRow) {
  if (isRevisionConversation && recoveredFromRevisionWorkflowFailure && assistantContent.trim().length === 0) {
    assistantContent = "I am continuing...";
  }
  assistantRow = await persistAssistantMessage(assistantContent);
}
```

Ändra till: fallback på genererat meddelande ALLTID när content är tom i revisionskonversation,
inte bara vid `recoveredFromRevisionWorkflowFailure`:
```typescript
if (!assistantRow) {
  if (isRevisionConversation && assistantContent.trim().length === 0) {
    assistantContent = detectConversationLanguage(conversation.system_prompt) === "sv"
      ? "Jag fortsätter med revisionen."
      : "Continuing the revision.";
  }
  assistantRow = await persistAssistantMessage(assistantContent);
}
```

**1c. Fixa skills-guardrail-meddelandet**

I `buildPendingWorkItemGuardrailMessage` (rad 398–401):
```typescript
// Från (else-branch för skills):
: `Inspect the exact source text for section ${item.section} and then resolve only this work item.`
// Till:
item.section === "skills"
  ? "Inspect the skills structure with inspect_resume_skills and then resolve only this work item."
  : `Inspect the exact source text for section ${item.section} with inspect_resume_section and then resolve only this work item.`
```

Motivering: modellen kallar `inspect_resume_section(skills)` för att sektionen heter "skills"
och instruktionen säger "inspect... section skills". Rätt verktyg är `inspect_resume_skills`.

---

### Fas 2 — Stoppa guardrail-loopen vid skills (1 commit)

Lägg till explicit `failed`-markering och `continue` när guardrail fires mer än N gånger
för **samma** work item i samma request. Alternativt: lägg till ett räknare per work_item_id
som nollställs per request.

Enklare: efter `MAX_GUARDRAIL_RETRIES` (t.ex. 3) för samma item → `failNextOpenRevisionWorkItem`.

---

### Fas 3 — Blocking legacy path (1 commit)

Ta bort fallback till `deriveNextActionOrchestrationMessage` (fenced-JSON läsning):
```typescript
// Från:
orchestrationMessage = persistedAutomation
  ? { kind: "automation", content: ... }
  : deriveNextActionOrchestrationMessage(orchestrationHistory);

// Till:
orchestrationMessage = persistedAutomation
  ? { kind: "automation", content: ... }
  : null;  // om inga DB-items finns, gör inget
```

`deriveNextActionOrchestrationMessage` i `action-orchestration.ts` läser fenced-JSON
och kan aktiveras på konversationer vars DB-state är felaktig. Ta bort eller inaktivera
det anropet.

---

### Fas 4 — Kontinuation utan användarmeddelande (1–2 commits)

Det fundamentala problemet är att backend inte kan fortsätta utan ett nytt HTTP-request.
Lösning: om loopen exiterar p.g.a. `MAX_BACKEND_TOOL_LOOPS` och det finns pending items,
returnera ett svar som frontend vet betyder "skicka ett continuation-meddelande direkt".

Alternativ A: returnera ett explicit continuation-svar från endpoint (ny contract-property `needsContinuation: boolean`).
Alternativ B: generera ett syntetiskt `[[internal_autostart]]`-meddelande som frontend
ska posta tillbaka automatiskt.
Alternativ C: flytta loopen till en bakgrundsjob (mer arkitekturellt men robustast).

---

### Fas 5 — Extrahera revision-engine (1–2 veckor, kan göras parallellt med Fas 1–4)

Extrahera allt revision-specifikt ur `message.ts` till `revision-engine.ts`:

```typescript
type RevisionPhase =
  | "branch_decision"
  | "queue_creation"
  | "process_item"
  | "done"
  | "waiting_user_input";

interface RevisionEngineResult {
  phase: RevisionPhase;
  assistantContent: string;
  needsContinuation: boolean;
}
```

Enginen:
- Läser state **enbart från DB** (`ai_revision_work_items`)
- Bestämmer nästa tillåtet steg per state
- Har explicita transitions: `pending → in_progress → completed/failed/no_changes_needed`
- Har maximalt ett modell-anrop per state-transition (inte N anrop inom ett anrop)
- Returnerar `needsContinuation: true` om det finns pending items efter en transition

`message.ts` kallar enginen och hanterar bara HTTP-lagret.

---

## 5. Vad som INTE ska göras

- **Inte** fler guardrail-meddelanden på det befintliga fenced-JSON-spåret
- **Inte** öka `MAX_BACKEND_TOOL_LOOPS` utan att OCKSÅ fixa skills-guardrail och
  continuation — annars ökar bara timeout-risken
- **Inte** ta bort `ai_message_deliveries`-loggning — det är det bästa debug-verktyget
- **Inte** starta med Fas 5 direkt — Fas 1 löser de aktuella krascharna med minimal risk

---

## 6. Filerna som måste ändras i Fas 1

| Fil | Ändring |
|---|---|
| `apps/backend/src/domains/ai/conversation/message.ts` | `MAX_BACKEND_TOOL_LOOPS`, fallback för tom content, skills-guardrail text |
| Inga andra filer | Fas 1 är isolerad till message.ts |

Teststrategi för Fas 1: kör manuellt med `sendAIMessage("fixa stavfel i hela cvt")` på
konversationen `8ab01d3e` och verifiera att fler items processas per request.

---

## 7. Öppna frågor

1. **Continuation-signalen**: hur ska frontend veta när det ska posta ett fortsätt-meddelande?
   Behöver vi ändra kontrakt (`ai-conversations.ts`)?
2. **Timeout-risk med MAX_BACKEND_TOOL_LOOPS=40**: varje iteration inkl. modell-anrop
   tar ~1–3 sek. 40 iterationer = potentiellt 120 sek. Acceptabelt för HTTP-timeout?
   Om inte: Fas 4 (continuation) måste prioriteras.
3. **Gamla fastnade konversationer** (`070cedab`, `4c85c408`): ska de återupptas
   eller stängas? DB-work-items är tomma — de kan inte återupptas automatiskt.
