# Revision Workflow Handoff

## Målbild

Vi försöker bygga om AI-revisionsflödet för CV-redigering så att det blir backendstyrt, spårbart och återupptagningsbart.

Målarkitekturen är:

- `ai_messages`: endast användarsynlig chatt
- `ai_message_deliveries`: append-only logg för interna steg, tool calls, tool results, retries
- `ai_revision_work_items`: aktuell exekveringsstate för revisionsarbete
- `ai_revision_suggestions`: aktuell state för förslag som användaren granskar

Principer:

- modellen ska få analysera och planera
- allt konkret arbete ska gå via work items
- suggestions ska alltid vara resultat av work items
- frontend ska vara reaktiv på backendstate, inte orkestrera själv
- revisionsbranch ska skapas via backend-tool, inte frontend-tool
- breda jobb som `hela CV:t` eller `alla uppdrag` ska hanteras mekaniskt och komplett

## Vad som redan är gjort

### Persistens och struktur

- `ai_message_deliveries` finns och används för interna meddelanden och tool-loggning
- `ai_revision_work_items` finns och persisteras separat
- `ai_revision_suggestions` finns och persisteras separat
- frontendens suggestionlista läser nu bara `revisionSuggestions` från databasen, inte från chatthistorik

### Branch- och chattflöde

- branchspecifik chatt persisteras per branch
- branchskapande är flyttat till backend
- frontend exekverar inte längre assistant-tools lokalt
- gamla autoskapandet av revisionsbranch vid AI-edit är borttaget

### Revision-workflow

- narrow revisioner måste nu också gå via work items först
- breda assignment/whole-resume requests kräver explicit queue
- backend kan autogenerera broad work items i stället för att modellen måste serialisera en enorm `set_revision_work_items`
- branchfråga måste bekräftas med explicit `ja` innan `create_revision_branch`

### Datakälla för branchinnehåll

- `getResume` är nu branch-aware
- legacyfält som `resumes.presentation` ska inte längre vara primär källa i detail/edit-flödet

## Vad vi försöker åstadkomma just nu

Det aktuella fokuset är att få revisionsloopen att fungera stabilt för broad jobs, särskilt:

- `fixa stavfel i hela cvt`
- `ta bort qwerty från hela cvt`
- `fixa stavfel i alla uppdrag`

Önskat beteende för broad flow:

1. startchatten avgör om ny branch behövs
2. om `ja`: backend skapar branch och handoffar dit
3. om `nej`: backend fortsätter i nuvarande branch
4. backend bygger en komplett work-item-kö
5. loopen processar exakt ett pending item åt gången
6. varje item slutar i:
   - suggestions, eller
   - `no_changes_needed`, eller
   - `failed`
7. chatten säger inte att allt är klart förrän kön faktiskt är tom

## Var vi står just nu

Vi är inte i mål. Flödet fungerar delvis men fastnar fortfarande i backendloopen.

Den aktuella felbilden är:

- broad jobs börjar nu oftare korrekt
- work items skapas
- backend kan komma in i revision-loop och köra inspect-tools
- men efter vissa inspect-steg returnerar modellen ett tomt assistentsvar eller ett svar som vår loop hanterar fel
- resultatet blir `Unhandled backend error` eller att konversationen stannar

Senaste konkreta fel som setts:

- efter `list_resume_assignments`
- sedan `inspect_resume_section`
- därefter:
  - `AI returned an empty assistant message during the revision workflow.`

## Konkreta observationer från senaste felsökningen

### Felande konversation

Exempel på felande konversation:

- `8ab01d3e-5745-4dcf-8719-7bcca5e20942`

I databasen såg vi:

- ett internt autostartmeddelande som säger att dedikerad branch redan finns
- sedan guardrail att först kalla `list_resume_assignments`
- `list_resume_assignments` kördes
- backend skapade/persisterade work items
- sedan kördes `inspect_resume_section` för `title`
- modellen producerade `set_revision_suggestions`
- därefter fortsatte loopen mot nästa item
- och sedan föll den ut med tomt assistentsvar i revisionsworkflowet

### Viktig slutsats

Det här är inte längre främst ett promptproblem. Det är ett loop-/state-machine-problem i backend.

Vi har flera vägar där backend fortfarande antar att nästa OpenAI-svar måste vara synlig text, fast modellen i själva verket:

- returnerar en tool call
- returnerar tom `content`
- eller svarar på ett sätt som borde behandlas som intern continuation snarare än synligt assistantmeddelande

## Hypotes om rotorsak

Den bästa nuvarande hypotesen är att `message.ts` fortfarande blandar flera ansvar i samma loop:

- chatpersistens
- tool-loop
- autostart/guardrail
- work-item-orkestrering
- branchflöde
- legacy tool-call parsing

Det gör att vissa grenar hanterar `assistantMessage.tool_calls` korrekt, medan andra fortfarande försöker:

- läsa `assistantMessage.content ?? ""`
- och persistera det som synligt assistantmeddelande

fast svaret egentligen inte borde persisteras som text alls.

Det finns också sannolikt fortfarande en blandning av:

- legacy-parsning från assistant-text med fenced JSON
- riktiga OpenAI-tools

Det ökar risken att olika grenar beter sig olika.

## Försök som redan gjorts

Följande har redan testats och helt eller delvis införts:

- skicka `revisionTools` i uppföljningsanrop efter backend-inspect
- fånga malformed tool args och retrya i stället för 500
- autogenerera broad work-item-kö i backend i stället för att modellen serialiserar allt
- autogenerera broad work items även efter explicit branchavslag `nej`
- blockera suggestions innan work-item-kö finns
- stoppa branchskapande utan explicit bekräftelse
- hindra frontend från att posta tool-resultat tillbaka in i chatten
- flytta branchskapande till backend
- sluta härleda suggestions från chatthistoriken i frontend
- göra branch-aware resumehämtning i stället för att läsa legacyfält i `resumes`

Ett nytt försök gjordes också för att göra loopen mer feltolerant:

- om modellen ger tomt svar mitt i ett work item ska itemet markeras som `failed`
- loopen ska sedan gå vidare till nästa item

Den delen är delvis patchad i `message.ts`, men den är inte verifierad i verklig körning ännu och har inte en stark regressionssvit runt exakt det scenariot.

## Vad som sannolikt behöver göras härnäst

Den mest lovande vägen framåt är att Claude eller nästa agent tar ett steg tillbaka och gör en tydligare state machine av revisionsflödet i backend, i stället för fler lokala patchar.

Rekommenderad riktning:

1. Extrahera revisionsworkflowet ur `apps/backend/src/domains/ai/conversation/message.ts` till en separat modul.
2. Definiera explicita tillåtna steg per state, till exempel:
   - branch decision
   - queue creation
   - inspect current item
   - resolve current item
   - move to next item
   - done
3. Sluta behandla assistantens fria text som primär kontrollmekanism i revisionsflödet.
4. Låt backend avgöra nästa steg från persisterad state i `ai_revision_work_items`.
5. Gör ett tydligt felhanteringsspår:
   - markera item som `failed`
   - spara `last_error`
   - fortsätt till nästa item
6. Minimera legacy-spåret med fenced JSON-toolcalls i revisionschatten.

## Viktiga filer

- `apps/backend/src/domains/ai/conversation/message.ts`
- `apps/backend/src/domains/ai/conversation/revision-work-items.ts`
- `apps/backend/src/domains/ai/conversation/revision-suggestions.ts`
- `apps/backend/src/domains/ai/conversation/action-orchestration.ts`
- `apps/backend/src/domains/ai/conversation/revision-tools.ts`
- `apps/backend/src/domains/ai/conversation/tool-execution.ts`
- `apps/frontend/src/hooks/inline-resume-revision.ts`
- `apps/frontend/src/components/ai-assistant/lib/build-resume-revision-prompt.ts`

## Databasentiteter att känna till

- `ai_conversations`
- `ai_messages`
- `ai_message_deliveries`
- `ai_revision_work_items`
- `ai_revision_suggestions`
- `resume_branches`
- `resume_branch_commits`
- `branch_assignments`

## Senaste relevanta commits

- `03ec155` `feat(revision): add explain command and branch-aware snapshots`
- `f69deec` `fix(revision): enforce broad revision workflow ordering`
- `cffd6ed` `fix(revision): recover from malformed tool args`

## Sammanfattning

Det vi försöker bygga är rätt riktning, men den nuvarande implementationen i backend har fortfarande för mycket blandad orkestrering i samma loop. Vi har fått in viktig persistens och bättre struktur, men själva execution-loopen för revision-work-items är fortfarande inte robust nog. Det är där arbetet sitter fast nu.
