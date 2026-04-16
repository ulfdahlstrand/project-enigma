/**
 * useResumeDraftState — manages the draft text fields + refs for resume editing.
 * Owns:
 *   - useState for title / presentation / summary / highlightedItems
 *   - parallel refs so mutation callbacks always read the latest values
 *   - an effect that keeps refs in sync with state
 *   - an effect that initialises drafts from server content when the branch changes
 *   - buildDraftPatch() / buildDraftPatchFromValues() helpers
 */
import { useEffect, useRef, useState } from "react";

export interface DraftPatch {
  consultantTitle: string | null;
  presentation: string[];
  summary: string | null;
  highlightedItems: string[];
}

interface UseResumeDraftStateInput {
  isEditing: boolean;
  /** Changing branch resets drafts to the server values below. */
  activeBranchId: string | null;
  consultantTitle: string | null;
  presentationText: string;
  summary: string | null;
  highlightedItemsText: string;
}

export interface ResumeDraftState {
  draftTitle: string;
  draftPresentation: string;
  draftSummary: string;
  draftHighlightedItems: string;
  draftTitleRef: React.MutableRefObject<string>;
  draftPresentationRef: React.MutableRefObject<string>;
  draftSummaryRef: React.MutableRefObject<string>;
  draftHighlightedItemsRef: React.MutableRefObject<string>;
  setDraftTitle: (v: string) => void;
  setDraftPresentation: (v: string) => void;
  setDraftSummary: (v: string) => void;
  setDraftHighlightedItems: (v: string) => void;
  buildDraftPatch: () => DraftPatch;
  buildDraftPatchFromValues: (
    title: string,
    presentationValue: string,
    summaryValue: string,
  ) => DraftPatch;
}

export function useResumeDraftState({
  isEditing,
  activeBranchId,
  consultantTitle,
  presentationText,
  summary,
  highlightedItemsText,
}: UseResumeDraftStateInput): ResumeDraftState {
  const [draftTitle, setDraftTitle] = useState("");
  const [draftPresentation, setDraftPresentation] = useState("");
  const [draftSummary, setDraftSummary] = useState("");
  const [draftHighlightedItems, setDraftHighlightedItems] = useState("");

  const draftTitleRef = useRef("");
  const draftPresentationRef = useRef("");
  const draftSummaryRef = useRef("");
  const draftHighlightedItemsRef = useRef("");

  // Keep refs in sync so async callbacks always read the latest values.
  useEffect(() => {
    draftTitleRef.current = draftTitle;
    draftPresentationRef.current = draftPresentation;
    draftSummaryRef.current = draftSummary;
    draftHighlightedItemsRef.current = draftHighlightedItems;
  }, [draftTitle, draftPresentation, draftSummary, draftHighlightedItems]);

  // Re-initialise drafts from server content when branch or content changes.
  useEffect(() => {
    if (!isEditing) return;

    const nextTitle = consultantTitle ?? "";
    const nextPresentation = presentationText;
    const nextSummary = summary ?? "";
    const nextHighlightedItems = highlightedItemsText;

    draftTitleRef.current = nextTitle;
    draftPresentationRef.current = nextPresentation;
    draftSummaryRef.current = nextSummary;
    draftHighlightedItemsRef.current = nextHighlightedItems;

    setDraftTitle(nextTitle);
    setDraftPresentation(nextPresentation);
    setDraftSummary(nextSummary);
    setDraftHighlightedItems(nextHighlightedItems);
  }, [activeBranchId, consultantTitle, highlightedItemsText, isEditing, presentationText, summary]);

  const buildDraftPatch = (): DraftPatch => ({
    consultantTitle: draftTitleRef.current.trim() || null,
    presentation: draftPresentationRef.current
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter(Boolean),
    summary: draftSummaryRef.current.trim() || null,
    highlightedItems: draftHighlightedItemsRef.current
      .split(/\n+/)
      .map((item) => item.trim())
      .filter(Boolean),
  });

  const buildDraftPatchFromValues = (
    title: string,
    presentationValue: string,
    summaryValue: string,
  ): DraftPatch => ({
    consultantTitle: title.trim() || null,
    presentation: presentationValue
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter(Boolean),
    summary: summaryValue.trim() || null,
    highlightedItems: draftHighlightedItemsRef.current
      .split(/\n+/)
      .map((item) => item.trim())
      .filter(Boolean),
  });

  return {
    draftTitle,
    draftPresentation,
    draftSummary,
    draftHighlightedItems,
    draftTitleRef,
    draftPresentationRef,
    draftSummaryRef,
    draftHighlightedItemsRef,
    setDraftTitle,
    setDraftPresentation,
    setDraftSummary,
    setDraftHighlightedItems,
    buildDraftPatch,
    buildDraftPatchFromValues,
  };
}
