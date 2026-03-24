import type { ResumeRevisionStepSection } from "@cv-tool/contracts";
import type { ResumeCommitContent } from "../../../db/types.js";

// ---------------------------------------------------------------------------
// extractSectionContent
//
// Returns the slice of a commit snapshot that is relevant for the given step
// section. Used to populate the "originalContent" field in AI proposals and
// in the step prompt context.
// ---------------------------------------------------------------------------

export function extractSectionContent(
  section: ResumeRevisionStepSection,
  content: ResumeCommitContent
): unknown {
  switch (section) {
    case "discovery":
      return null;
    case "consultant_title":
      return { consultantTitle: content.consultantTitle };
    case "presentation_summary":
      return { presentation: content.presentation, summary: content.summary };
    case "skills":
      return { skills: content.skills };
    case "assignments":
      return { assignments: content.assignments };
    case "highlighted_experience":
      return {
        assignments: content.assignments.map((a) => ({
          assignmentId: a.assignmentId,
          clientName: a.clientName,
          role: a.role,
          highlight: a.highlight,
        })),
      };
    case "consistency_polish":
      return content;
  }
}

// ---------------------------------------------------------------------------
// applySectionContent
//
// Merges a proposal's proposedContent into the base commit snapshot for the
// given section. Returns a new ResumeCommitContent (immutable — never mutates
// the input).
// ---------------------------------------------------------------------------

export function applySectionContent(
  section: ResumeRevisionStepSection,
  base: ResumeCommitContent,
  proposedContent: unknown
): ResumeCommitContent {
  const proposed = proposedContent as Record<string, unknown>;

  switch (section) {
    case "discovery":
      // Discovery has no commit — base content is returned unchanged.
      return base;

    case "consultant_title":
      return {
        ...base,
        consultantTitle: (proposed["consultantTitle"] as string | null) ?? null,
      };

    case "presentation_summary":
      return {
        ...base,
        presentation:
          (proposed["presentation"] as string[] | undefined) ?? base.presentation,
        summary: (proposed["summary"] as string | null | undefined) ?? base.summary,
      };

    case "skills":
      return {
        ...base,
        skills: (proposed["skills"] as ResumeCommitContent["skills"]) ?? base.skills,
      };

    case "assignments":
      return {
        ...base,
        assignments:
          (proposed["assignments"] as ResumeCommitContent["assignments"]) ??
          base.assignments,
      };

    case "highlighted_experience": {
      // proposedContent carries the full assignments array with updated highlight flags.
      const updatedAssignments = proposed["assignments"] as
        | ResumeCommitContent["assignments"]
        | undefined;
      if (updatedAssignments === undefined) return base;
      // Build a highlight map from the proposal, then apply to existing assignments.
      const highlightMap = new Map(
        updatedAssignments.map((a) => [a.assignmentId, a.highlight])
      );
      return {
        ...base,
        assignments: base.assignments.map((a) => ({
          ...a,
          highlight: highlightMap.get(a.assignmentId) ?? a.highlight,
        })),
      };
    }

    case "consistency_polish":
      // For the final polish step, proposedContent may be a full or partial snapshot.
      return { ...base, ...proposed } as ResumeCommitContent;
  }
}
