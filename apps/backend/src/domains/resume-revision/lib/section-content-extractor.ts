import type { ResumeRevisionStepSection } from "@cv-tool/contracts";
import type { ResumeCommitContent } from "../../../db/types.js";

/** section_detail for assignments is "<assignmentId>|||<clientName>". Returns just the id part. */
function parseAssignmentId(sectionDetail: string): string {
  return sectionDetail.split("|||")[0] ?? sectionDetail;
}

// ---------------------------------------------------------------------------
// extractSectionContent
//
// Returns the slice of a commit snapshot that is relevant for the given step
// section. Used to populate the "originalContent" field in AI proposals and
// in the step prompt context.
// ---------------------------------------------------------------------------

export function extractSectionContent(
  section: ResumeRevisionStepSection,
  content: ResumeCommitContent,
  sectionDetail: string | null = null
): unknown {
  switch (section) {
    case "discovery":
      return null;
    case "consultant_title":
      return { consultantTitle: content.consultantTitle };
    case "presentation_summary":
      return { presentation: content.presentation, summary: content.summary };
    case "skills":
      if (sectionDetail === "__new_categories__") {
        // Show all existing skills as reference for suggesting new categories
        return { skills: content.skills };
      }
      if (sectionDetail) {
        // Only extract skills for this specific category
        return { skills: content.skills.filter((s) => s.category === sectionDetail) };
      }
      return { skills: content.skills };
    case "assignments": {
      if (sectionDetail) {
        const assignmentId = parseAssignmentId(sectionDetail);
        return { assignments: content.assignments.filter((a) => a.assignmentId === assignmentId) };
      }
      return { assignments: content.assignments };
    }
    case "highlighted_experience":
      // Return all assignments as context for the AI to reference.
      // The actual highlighted items are loaded separately from resume_highlighted_items.
      return {
        assignments: content.assignments.map((a) => ({
          assignmentId: a.assignmentId,
          clientName: a.clientName,
          role: a.role,
          startDate: a.startDate,
          endDate: a.endDate,
          description: a.description,
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
  proposedContent: unknown,
  sectionDetail: string | null = null
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

    case "skills": {
      const proposedSkills = (proposed["skills"] as ResumeCommitContent["skills"]) ?? [];
      if (sectionDetail === "__new_categories__") {
        // Append new category skills, avoiding duplicates by name+category
        const existingKeys = new Set(base.skills.map((s) => `${s.name}|${s.category ?? ""}`));
        const newSkills = proposedSkills.filter((s) => !existingKeys.has(`${s.name}|${s.category ?? ""}`));
        return { ...base, skills: [...base.skills, ...newSkills] };
      }
      if (sectionDetail) {
        // Replace only skills belonging to this category
        return {
          ...base,
          skills: [
            ...base.skills.filter((s) => s.category !== sectionDetail),
            ...proposedSkills,
          ],
        };
      }
      return { ...base, skills: proposedSkills.length > 0 ? proposedSkills : base.skills };
    }

    case "assignments": {
      const proposedAssignments =
        (proposed["assignments"] as ResumeCommitContent["assignments"]) ?? [];
      if (sectionDetail) {
        const assignmentId = parseAssignmentId(sectionDetail);
        // Replace only the single assignment with this id
        return {
          ...base,
          assignments: [
            ...base.assignments.filter((a) => a.assignmentId !== assignmentId),
            ...proposedAssignments,
          ],
        };
      }
      return {
        ...base,
        assignments: proposedAssignments.length > 0 ? proposedAssignments : base.assignments,
      };
    }

    case "highlighted_experience":
      // highlighted_experience writes to resume_highlighted_items (not commit content).
      // applySectionContent is a no-op for this section.
      return base;

    case "consistency_polish":
      // For the final polish step, proposedContent may be a full or partial snapshot.
      return { ...base, ...proposed } as ResumeCommitContent;
  }
}
