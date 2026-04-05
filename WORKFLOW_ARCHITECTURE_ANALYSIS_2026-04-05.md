# Workflow Architecture Analysis

## Syfte

Det här dokumentet sammanfattar en teknisk analys av ett moget agent-/tooling-flöde som referens och översätter relevanta mönster till rekommendationer för revisionsflödet i Project Enigma.

Analysen fokuserar på det som är mest relevant för nuvarande problem:

- separation mellan planering och exekvering
- robust verktygsorkestrering
- köhantering och task/work-item-state
- feltolerans och återupptagning
- separation mellan synliga meddelanden och interna events

## Källor som granskades

I referensimplementationen granskades främst:

- övergripande README/dokumentation
- query engine
- tool orchestration
- tool execution
- streaming tool executor
- queue processor
- tasks/task store
- messages/message utilities

I Project Enigma är de mest relevanta nuvarande filerna:

- `apps/backend/src/domains/ai/conversation/message.ts`
- `apps/backend/src/domains/ai/conversation/revision-work-items.ts`
- `apps/backend/src/domains/ai/conversation/revision-suggestions.ts`
- `apps/backend/src/domains/ai/conversation/action-orchestration.ts`
- `apps/backend/src/domains/ai/conversation/tool-execution.ts`
- `apps/frontend/src/hooks/inline-resume-revision.ts`
- `apps/frontend/src/components/ai-assistant/lib/build-resume-revision-prompt.ts`

## Vad referensmönstret gör bättre

### 1. Tydlig separation mellan motor och UI

Det mest slående i referensimplementationen är att själva query-/tool-motorn är tydligare separerad från UI-lagret.

Exempel på ansvarsfördelning:

- en query engine äger querylivscykeln
- en orchestration layer äger hur tool calls grupperas och körs
- en execution layer äger exekvering och avbrottshantering
- UI hooks reagerar på state, men driver inte modellogiken

Lärdom för Enigma:

- backend måste bli den tydliga revisionsmotorn
- frontend ska visa state och reagera på handoff/suggestions/work items
- frontend ska inte delta i AI-orkestrering eller tolka modellen som primär sanning

### 2. Tool execution är en egen pipeline

I referensimplementationen ligger tool-exekveringen inte blandad med all annan konversationslogik. Det finns en separat orchestration layer och en separat execution layer.

Det ger:

- enklare tillåten ordning
- tydligare concurrency-regler
- enklare hantering av progress
- enklare fallback när något går fel

Lärdom för Enigma:

`message.ts` i backend gör just nu för mycket:

- laddar historik
- kör OpenAI
- avgör branchfrågor
- injicerar guardrails
- skapar branch
- driver work-item-loop
- persisterar tool-resultat
- persisterar synliga meddelanden
- hanterar slash-kommandon

Det är huvudorsaken till att ni får cirkulära buggar. Den filen behöver delas upp i en faktisk revisionsworkflowmotor.

### 3. Köer och tasks är first-class state

Referensimplementationen har en riktig taskmodell med:

- tydlig status
- explicit lagring
- notifieringar
- fallback-polling
- en singleton store i UI:t
- stabil `subscribe/getSnapshot`-modell

Särskilt viktigt:

- task state behandlas som den faktiska sanningen
- UI läser den sanningen reaktivt
- processing triggas endast när förutsättningarna är uppfyllda

Lärdom för Enigma:

Det här ligger helt i linje med det ni redan börjat göra:

- `ai_revision_work_items` som aktuell sanning
- `ai_revision_suggestions` som aktuell sanning
- `ai_message_deliveries` som audit logg

Det som återstår är att fullt ut lita på dessa tabeller och sluta deriviera styrlogik från assistantmeddelanden.

### 4. Feltolerans är inbyggd i exekveringslagret

Referensimplementationens streaming/tool-executor visar ett viktigt mönster:

- verktyg kan discardas
- sibling tools kan avbrytas
- fel representeras explicit
- systemet fortsätter på ett definierat sätt i stället för att bara falla ut

Lärdom för Enigma:

För revisionsflödet behöver work-item-pipelinen behandla fel som data, inte som krasch:

- `failed`
- `blocked`
- `attempt_count`
- `last_error`

Och sedan:

- hoppa till nästa item
- rapportera status via `/status` och `/work`
- låta användaren eller backend återuppta senare

### 5. Meddelandemodellen skiljer tydligare på olika typer av output

Referensimplementationens message utilities visar ett viktigt designmönster: systemet skiljer på olika sorters meddelanden och artificiella placeholder-/systemmeddelanden i stället för att behandla allt som samma typ av “assistant text”.

Lärdom för Enigma:

Det här är exakt vad ni behöver mer av:

- synliga chatmeddelanden
- interna orchestration events
- tool calls
- tool results
- workflow-state

Nuvarande problem uppstår ofta för att backend ibland försöker persistera ett “synligt assistantmeddelande” när svaret egentligen är ett internt workflowsteg.

## Vad det här betyder för Enigmas revisionsflöde

Den viktigaste slutsatsen är:

Ni behöver sluta se revisionschatten som “en konversation som ibland använder tools” och i stället se den som “en workflowmotor med en chatt ovanpå”.

Det är den stora skillnaden mellan nuvarande läge och det mer mogna mönster som syns i referensimplementationen.

## Rekommenderad målarkitektur

### 1. Inför en separat `RevisionWorkflowEngine`

Skapa en separat backendmodul, till exempel:

- `apps/backend/src/domains/ai/conversation/revision-workflow-engine.ts`

Den ska äga:

- workflow-state
- allowed next steps
- item-by-item processing
- branch decision-state
- retry/failure handling

`message.ts` ska då bara:

- validera request
- ladda konversation
- delegera till `RevisionWorkflowEngine`
- persistera slutligt användarsynligt svar

### 2. Gör work items till den enda exekveringsmodellen

Allt konkret revisionsarbete ska först bli work items.

Det gäller även smala requests.

Exempel:

- `fixa stavfel i presentationen`
  - skapar work item för `presentation`
- `fixa stavfel i alla uppdrag`
  - skapar ett work item per assignment
- `fixa skills`
  - skapar övergripande skills-item som backend expanderar till mer specifika items

Förslag:

- inga suggestions utan `work_item_id`
- inga terminala suggestions-tools tillåtna innan kö finns
- inga “no changes needed”-beslut utan work item

### 3. Definiera explicit allowed order per workflow-state

Det här är sannolikt den viktigaste konkreta förbättringen.

Exempel på states:

- `awaiting_branch_decision`
- `creating_branch`
- `queue_initialization`
- `processing_work_item`
- `awaiting_next_item`
- `completed`

Och per state, tillåtna verktyg:

- `awaiting_branch_decision`
  - inga inspect/suggestion tools
  - endast vänta på `ja/nej`
- `creating_branch`
  - endast `create_revision_branch`
- `queue_initialization`
  - `list_resume_assignments`
  - eller backend-autogenerering
- `processing_work_item`
  - endast inspect-tool för aktuellt item
  - sedan exakt en av:
    - suggestion tool
    - `mark_revision_work_item_no_changes_needed`
- `completed`
  - endast synlig sammanfattning

Det här ska valideras i backend, inte bara beskrivas i prompten.

### 4. Låt backend skapa broad queues deterministiskt

För breda jobb ska backend själv bygga köer.

Exempel:

- `whole_resume`
  - `title`
  - `consultantTitle`
  - `presentation`
  - `summary`
  - alla assignments
- `all_assignments`
  - exakt ett item per assignment

Det här har ni redan börjat göra, och det är rätt väg.

Nästa steg är att göra det till enda vägen för breda jobb.

### 5. Inför tydlig `current_work_item`-semantik

I stället för att varje loopvarv “letar nästa pending item” lite löst, bör motorn explicit välja ett current item.

Möjlig modell:

- `ai_revision_work_items.status`
  - `pending`
  - `in_progress`
  - `completed`
  - `no_changes_needed`
  - `failed`
  - `blocked`

När ett item börjar processas:

- markera `in_progress`

Om modellen returnerar ogiltigt, tomt eller felaktigt svar:

- markera `failed`
- öka `attempt_count`
- spara `last_error`
- fortsätt till nästa item

Det här minskar risken att samma item fastnar i en loop.

### 6. Flytta mer state från assistanttext till DB-state

Just nu används fortfarande assistanttext och deliveries delvis som styrmekanism.

Det bör minimeras.

Bättre uppdelning:

- `ai_messages`: endast det användaren ska läsa
- `ai_message_deliveries`: diagnostik och logg
- `ai_revision_work_items`: exekveringsstate
- `ai_revision_suggestions`: granskningsstate

Workflowmotorn ska i första hand läsa:

- work items
- suggestions
- branch state

inte assistanttexter.

### 7. Gör UI:t helt reaktivt mot persisted state

Referensmönstret visar att UI-konsumenter bör läsa från stabila stores/snapshots, inte härleda för mycket själva.

För Enigma innebär det:

- checklistan läser `ai_revision_suggestions`
- statuspanelen läser `ai_revision_work_items`
- chattpanelen läser `ai_messages`
- historik/logg läser `ai_message_deliveries`

Frontend ska inte längre behöva tolka:

- legacy fenced JSON
- assistanttext för workflowstatus
- heuristisk merge mellan lokal state och chatthistorik

### 8. Lägg till en enkel recovery-policy

Inspirerat av etablerade mönster i robusta tool-executors.

För varje work item:

- max antal försök, t.ex. `3`
- därefter `failed`
- workflowet fortsätter ändå

För hela körningen:

- om vissa items failar
  - chatten säger inte “klart”
  - den säger “delvis klart”
  - `/status` visar failed count
  - `/work` visar exakt vilka item som misslyckades

Det här är bättre än att låta en enda tom AI-respons krascha hela konversationen.

## Konkreta förbättringsförslag för nästa iteration

### Förslag A: Extrahera revisionsmotorn

Gör detta först.

Bryt ut ur `message.ts`:

- branch decision logic
- work-item step logic
- broad queue generation
- tool-step validation
- retry/failure handling

Mål:

- `message.ts` ska sluta vara monolit
- revisionsworkflowet ska bli testbart i isolation

### Förslag B: Inför `RevisionWorkflowState`

Till exempel:

```ts
type RevisionWorkflowState =
  | { kind: "awaiting_branch_decision"; scope: "whole_resume" | "all_assignments" | "narrow" }
  | { kind: "queue_initialization"; scope: "whole_resume" | "all_assignments" | "narrow" }
  | { kind: "processing_item"; workItemId: string }
  | { kind: "completed" }
```

Den här staten behöver inte nödvändigtvis lagras som egen tabell direkt, men workflowmotorn ska kunna härleda den deterministiskt från DB-state.

### Förslag C: Ta bort legacy tool-call parsing för revisionschatten

Det här är sannolikt ett av de viktigaste förenklingsstegen.

Om revisionschatten nu ändå går via riktiga backendtools och persisterade work items/suggestions:

- ta bort eller minimera `extractToolCalls(...)`-spåret för revisionschatten
- använd ett enhetligt provider-tool-flöde

Ju längre hybridläget lever, desto fler edge cases kommer ni få.

### Förslag D: Gör `/status`, `/work` och `/explain` helt DB-drivna

Det här är i princip redan rätt tänkt.

Förbättra dem ytterligare:

- `/status`
  - counts per status
  - current work item
  - failed items
- `/work`
  - full lista
  - tydlig markering för `in_progress`, `failed`, `blocked`
- `/explain`
  - baseras på persisted suggestions + work items + deliveries
  - inte på fri assistenttext

### Förslag E: Inför `no-op detection` i backend

Ni har sett fall där modellen skapar suggestion som egentligen inte ändrar texten.

Det ska stoppas i backend.

När inspect-resultatet är känt:

- om `suggestedText === currentText`
  - suggestion ska inte persisteras
  - item ska i stället bli `no_changes_needed`

Det här ökar datakvaliteten och gör workflowet mindre förvirrande.

## Rekommenderad implementeringsordning

1. Extrahera revisionsworkflowet ur `message.ts`
2. Inför explicit allowed-order/state-machine
3. Gör broad queue generation helt backenddriven
4. Gör all revision work-item-first
5. Ta bort revisionschatts legacy tool-call parsing
6. Lägg till robust failure handling per item
7. Skärp backend no-op detection
8. Gör frontend helt read-only mot persisted state

## Risker att undvika

### 1. Fler promptpatchar utan state machine

Det här är den största risken.

Promptändringar kan förbättra modellbeteende, men de löser inte kärnproblemet när backend fortfarande accepterar för många tillstånd och för många vägval.

### 2. Fortsatt hybrid mellan chatthistorik och DB-state

Så länge revisionsflödet delvis drivs av:

- assistantmeddelanden
- deliveries
- frontendheuristik

och delvis av riktiga tabeller, kommer ni fortsätta få edge cases.

### 3. För mycket logik i `message.ts`

Ni har redan sett konsekvensen:

- svårt att resonera om
- svårt att testa
- lätt att fixa en väg och bryta en annan

## Sammanfattning

Det viktigaste förslaget är inte en enskild buggfix, utan en arbetsmodell:

- låt modellen analysera och planera
- låt backend exekvera via en explicit work-item-pipeline
- låt UI:t bara visa persisted state

Den tydligaste lärdomen från robusta agentflöden är att de inte byggs genom att modellen får styra hela processen via fri text, utan genom att exekvering, köer och felhantering blir egna system med tydliga regler.

## Kort sammanfattning av förslaget

Förslaget innebär att revisionschatten i Enigma görs om från en “LLM-konversation med lite tools” till en faktisk workflowmotor:

- varje konkret ändring blir ett work item
- backend styr tillåten ordning
- suggestions blir output från work items
- fel markeras på itemnivå i stället för att krascha hela körningen
- frontend visar bara persisted state

Det skulle ge:

- färre loopbuggar
- bättre traceability
- bättre återupptagning
- enklare debugging
- ett mycket stabilare broad-revision-flöde
