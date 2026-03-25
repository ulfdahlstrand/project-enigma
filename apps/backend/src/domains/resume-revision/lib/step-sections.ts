import type { ResumeRevisionStepSection } from "@cv-tool/contracts";

// ---------------------------------------------------------------------------
// Step section ordering
// ---------------------------------------------------------------------------

export const STEP_SECTIONS: ResumeRevisionStepSection[] = [
  "discovery",
  "consultant_title",
  "presentation_summary",
  "skills",
  "assignments",
  "highlighted_experience",
  "consistency_polish",
];

/**
 * Returns the next section after the given one, or null if it is the last.
 */
export function getNextSection(
  current: ResumeRevisionStepSection
): ResumeRevisionStepSection | null {
  const idx = STEP_SECTIONS.indexOf(current);
  if (idx === -1 || idx === STEP_SECTIONS.length - 1) return null;
  return STEP_SECTIONS[idx + 1] ?? null;
}

/** Returns true if the given section is the discovery (first) step. */
export function isDiscoverySection(section: ResumeRevisionStepSection): boolean {
  return section === "discovery";
}
