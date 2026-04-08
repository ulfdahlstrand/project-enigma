# Resume Side Toolbar Audit

Date: 2026-04-07
Branch: `feat/consultant-profile-image`

## Goal

Replace the remaining floating resume FABs with a section-attached side toolbar that sits next to the relevant document page/section, instead of floating relative to the whole canvas.

The reference direction is a compact vertical toolbar visually attached to the page edge.

## Current State

The current resume UI still contains several absolute-positioned floating controls.

### Actively rendered floating controls

1. Assignments page toggle FAB
- File: [apps/frontend/src/components/resume-detail/ResumeAssignmentsPage.tsx](/Users/ulfdahlstrand/Projects/Code/Work/SthlmTech/project-enigma/apps/frontend/src/components/resume-detail/ResumeAssignmentsPage.tsx)
- Purpose: toggle between full assignments and compact/summary view
- Implementation:
  - absolute `Fab`
  - positioned with:
    - `left: calc(50% + 794 / 2 + 16px)`
    - `top: calc(assignmentsFabTop + theme.spacing(...))`
- Notes:
  - this is the control the user called out as floating at the top of the document
  - it is page-global, not section-attached

2. Assignments page add FAB
- File: [apps/frontend/src/components/resume-detail/ResumeAssignmentsPage.tsx](/Users/ulfdahlstrand/Projects/Code/Work/SthlmTech/project-enigma/apps/frontend/src/components/resume-detail/ResumeAssignmentsPage.tsx)
- Purpose: create a new assignment
- Implementation:
  - absolute `Fab`
  - same `left` strategy as above
  - stacked below the assignments toggle with `assignmentsFabTop`
- Notes:
  - also page-global and absolute

3. Skills page floating actions
- File: [apps/frontend/src/components/SkillsEditor.tsx](/Users/ulfdahlstrand/Projects/Code/Work/SthlmTech/project-enigma/apps/frontend/src/components/SkillsEditor.tsx)
- Current controls:
  - toggle detail/list view
  - add skill group
- Implementation:
  - `floatingActions`
  - absolute `Fab`s positioned using:
    - `left: calc(50% + 794 / 2 + 16px)`
    - `top: calc(theme.spacing(...) - pageTopOffset)`
- Notes:
  - these are visually detached from the skills page content
  - the positioning logic is local to `SkillsEditor`, not shared with the resume page shell

### Positional plumbing still in use

4. Resume route still measures DOM offsets for floating controls
- File: [apps/frontend/src/routes/_authenticated/resumes/$id.tsx](/Users/ulfdahlstrand/Projects/Code/Work/SthlmTech/project-enigma/apps/frontend/src/routes/_authenticated/resumes/$id.tsx)
- State still present:
  - `fabTop`
  - `assignmentsFabTop`
- Refs involved:
  - `presentationRef`
  - `assignmentsSectionRef`
  - `canvasRef`
- Current behavior:
  - `useLayoutEffect` measures section top offsets relative to the whole document canvas
  - values are then threaded down through workspaces into `ResumeDocumentCanvas`
- Notes:
  - this plumbing exists to support absolute canvas-adjacent controls
  - it becomes unnecessary if controls are rendered directly next to the relevant page or section

5. Resume canvas still carries floating-control props
- File: [apps/frontend/src/components/resume-detail/ResumeDocumentCanvas.tsx](/Users/ulfdahlstrand/Projects/Code/Work/SthlmTech/project-enigma/apps/frontend/src/components/resume-detail/ResumeDocumentCanvas.tsx)
- Props still present:
  - `fabTop`
  - `showAssignmentsToggleFab`
  - `assignmentsFabTop`
- Notes:
  - `fabTop` is now dead weight in practice
  - `showAssignmentsToggleFab` and `assignmentsFabTop` are still consumed by the assignments page

6. View/edit workspaces still pass floating-control state through
- Files:
  - [apps/frontend/src/components/resume-detail/ResumeViewWorkspace.tsx](/Users/ulfdahlstrand/Projects/Code/Work/SthlmTech/project-enigma/apps/frontend/src/components/resume-detail/ResumeViewWorkspace.tsx)
  - [apps/frontend/src/components/resume-detail/ResumeEditWorkspace.tsx](/Users/ulfdahlstrand/Projects/Code/Work/SthlmTech/project-enigma/apps/frontend/src/components/resume-detail/ResumeEditWorkspace.tsx)
- Current behavior:
  - view mode hardcodes `showAssignmentsToggleFab={true}`
  - edit mode uses `showAssignmentsToggleFab={!showRevisionShell}`
- Notes:
  - this is another sign that the FAB behavior is handled outside the relevant page component instead of being page-owned

## Legacy / likely dead code

1. Old AI presentation FAB
- File: [apps/frontend/src/components/ai-assistant/ImprovePresentationFab.tsx](/Users/ulfdahlstrand/Projects/Code/Work/SthlmTech/project-enigma/apps/frontend/src/components/ai-assistant/ImprovePresentationFab.tsx)
- Status:
  - still exists
  - no active usage found in `apps/frontend/src`

2. Old AI assignment FAB
- File: [apps/frontend/src/components/ai-assistant/ImproveAssignmentFab.tsx](/Users/ulfdahlstrand/Projects/Code/Work/SthlmTech/project-enigma/apps/frontend/src/components/ai-assistant/ImproveAssignmentFab.tsx)
- Status:
  - still exists
  - no active usage found in `apps/frontend/src`

3. Old zoom FAB control
- File: [apps/frontend/src/components/resume-detail/ResumeDocumentZoomControl.tsx](/Users/ulfdahlstrand/Projects/Code/Work/SthlmTech/project-enigma/apps/frontend/src/components/resume-detail/ResumeDocumentZoomControl.tsx)
- Status:
  - still exists
  - no active usage found in `apps/frontend/src`
- Note:
  - zoom now lives in the bottom status bar instead

## Main Problems With Current Model

1. Controls are positioned relative to the whole document canvas, not the page/section they belong to.

2. Positioning depends on DOM measurement and route-level plumbing.

3. The assignments toggle and add button are implemented inside the page component, but still visually behave like global floating controls.

4. Skills controls are owned by `SkillsEditor`, not by a page-level side toolbar abstraction, which makes the pattern inconsistent.

5. There is dead/legacy floating-control code still present in the codebase, which makes the current situation harder to reason about.

## Recommended Refactor Direction

### First slice

Introduce a reusable page-attached side toolbar component, something like:

- `ResumePageSideToolbar`

Responsibilities:
- render a compact vertical toolbar attached to the right edge of one specific document page
- accept a small list of actions
- own the visual language for the toolbar

Suggested usage:
- assignments page:
  - toggle full/compact
  - add assignment
- skills page:
  - toggle detail/list
  - add skill group

### Structural change

Move toolbar ownership closer to the actual page components:

- `ResumeAssignmentsPage`
  should render its own side toolbar attached to its own page layout

- `ResumeSkillsPage`
  should own a page-level toolbar and pass actions into `SkillsEditor`, rather than having `SkillsEditor` emit global floating FABs

This should let us remove:
- route-level `fabTop`
- route-level `assignmentsFabTop`
- canvas-level pass-through of those props

### Cleanup after replacement

After the new toolbar is in place, remove:
- unused `fabTop` state and refs plumbing
- `showAssignmentsToggleFab` prop if the page can decide visibility locally
- legacy dead floating controls:
  - `ImprovePresentationFab`
  - `ImproveAssignmentFab`
  - `ResumeDocumentZoomControl`

## Suggested Implementation Order

1. Add reusable `ResumePageSideToolbar`.
2. Replace assignments page FABs with that toolbar.
3. Move skills floating actions out of `SkillsEditor` into a page-level toolbar.
4. Remove `fabTop` / `assignmentsFabTop` measurement plumbing.
5. Remove dead floating-control components if they are confirmed unused.

## Test / Runtime Notes

At the time of this audit:
- worktree was clean before writing this note
- frontend test suite had previously been green locally
- this audit did not change runtime code
