/**
 * draft-status — shared helper for comparing draft fields against saved resume.
 *
 * Extracted from DraftStatusChip so both DraftStatusChip and UnsavedChip use
 * the same comparison logic without duplicating truth.
 */

export interface DraftStatusFields {
  isEditRoute: boolean;
  draftTitle: string;
  consultantTitle: string | null;
  draftPresentation: string;
  presentationText: string;
  draftSummary: string;
  summary: string | null;
  draftHighlightedItems: string;
  highlightedItemsText: string;
}

function hasUnsavedFields(fields: Omit<DraftStatusFields, "isEditRoute">): boolean {
  return (
    fields.draftTitle !== (fields.consultantTitle ?? "") ||
    fields.draftPresentation !== fields.presentationText ||
    fields.draftSummary !== (fields.summary ?? "") ||
    fields.draftHighlightedItems !== fields.highlightedItemsText
  );
}

/**
 * Returns true when all draft fields match the saved resume (i.e. nothing to save).
 * Returns false when in preview mode (isEditRoute === false) or when any field diverges.
 *
 * Note: "synced" means no action is needed — this includes preview mode where
 * editing is not active.
 */
export function isDraftSynced(fields: DraftStatusFields): boolean {
  if (!fields.isEditRoute) return true;
  return !hasUnsavedFields(fields);
}
