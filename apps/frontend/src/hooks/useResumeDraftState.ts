/**
 * useResumeDraftState — manages the draft text fields for resume editing.
 *
 * Backed by a per-instance Zustand store. A single store subscription mirrors
 * the four draft fields into plain ref objects so async callbacks can read the
 * latest values without stale-closure hazards — no `useEffect` sync required.
 *
 * Owns:
 *   - Zustand store with draftTitle/Presentation/Summary/HighlightedItems
 *   - Subscription-backed ref mirrors (titleRef/presentationRef/etc.)
 *   - An effect that re-initialises drafts from server content when the branch changes
 *   - buildDraftPatch() / buildDraftPatchFromValues() helpers
 */
import { useCallback, useEffect, useMemo, useRef } from "react";
import { createStore, useStore, type StoreApi } from "zustand";

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

type DraftRef = { current: string };

export interface ResumeDraftState {
  draftTitle: string;
  draftPresentation: string;
  draftSummary: string;
  draftHighlightedItems: string;
  draftTitleRef: DraftRef;
  draftPresentationRef: DraftRef;
  draftSummaryRef: DraftRef;
  draftHighlightedItemsRef: DraftRef;
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

interface DraftFields {
  draftTitle: string;
  draftPresentation: string;
  draftSummary: string;
  draftHighlightedItems: string;
}

const INITIAL_FIELDS: DraftFields = {
  draftTitle: "",
  draftPresentation: "",
  draftSummary: "",
  draftHighlightedItems: "",
};

interface DraftRefs {
  title: DraftRef;
  presentation: DraftRef;
  summary: DraftRef;
  highlightedItems: DraftRef;
}

interface DraftStoreBundle {
  store: StoreApi<DraftFields>;
  refs: DraftRefs;
}

function createDraftStoreBundle(): DraftStoreBundle {
  const refs: DraftRefs = {
    title: { current: "" },
    presentation: { current: "" },
    summary: { current: "" },
    highlightedItems: { current: "" },
  };

  const store = createStore<DraftFields>(() => ({ ...INITIAL_FIELDS }));

  // Mirror state into refs on every update so async callbacks always read the
  // latest values synchronously. Zustand fires subscribers synchronously on set,
  // which is strictly tighter than a post-commit useEffect.
  store.subscribe((state) => {
    refs.title.current = state.draftTitle;
    refs.presentation.current = state.draftPresentation;
    refs.summary.current = state.draftSummary;
    refs.highlightedItems.current = state.draftHighlightedItems;
  });

  return { store, refs };
}

export function useResumeDraftState({
  isEditing,
  activeBranchId,
  consultantTitle,
  presentationText,
  summary,
  highlightedItemsText,
}: UseResumeDraftStateInput): ResumeDraftState {
  const bundleRef = useRef<DraftStoreBundle | null>(null);
  if (!bundleRef.current) {
    bundleRef.current = createDraftStoreBundle();
  }
  const { store, refs } = bundleRef.current;

  const draftTitle = useStore(store, (s) => s.draftTitle);
  const draftPresentation = useStore(store, (s) => s.draftPresentation);
  const draftSummary = useStore(store, (s) => s.draftSummary);
  const draftHighlightedItems = useStore(store, (s) => s.draftHighlightedItems);

  const setDraftTitle = useCallback(
    (v: string) => store.setState({ draftTitle: v }),
    [store],
  );
  const setDraftPresentation = useCallback(
    (v: string) => store.setState({ draftPresentation: v }),
    [store],
  );
  const setDraftSummary = useCallback(
    (v: string) => store.setState({ draftSummary: v }),
    [store],
  );
  const setDraftHighlightedItems = useCallback(
    (v: string) => store.setState({ draftHighlightedItems: v }),
    [store],
  );

  // Re-initialise drafts from server content when branch or content changes.
  useEffect(() => {
    if (!isEditing) return;

    store.setState({
      draftTitle: consultantTitle ?? "",
      draftPresentation: presentationText,
      draftSummary: summary ?? "",
      draftHighlightedItems: highlightedItemsText,
    });
  }, [
    activeBranchId,
    consultantTitle,
    highlightedItemsText,
    isEditing,
    presentationText,
    store,
    summary,
  ]);

  const buildDraftPatch = useCallback((): DraftPatch => {
    const state = store.getState();
    return {
      consultantTitle: state.draftTitle.trim() || null,
      presentation: state.draftPresentation
        .split(/\n\n+/)
        .map((p) => p.trim())
        .filter(Boolean),
      summary: state.draftSummary.trim() || null,
      highlightedItems: state.draftHighlightedItems
        .split(/\n+/)
        .map((item) => item.trim())
        .filter(Boolean),
    };
  }, [store]);

  const buildDraftPatchFromValues = useCallback(
    (title: string, presentationValue: string, summaryValue: string): DraftPatch => ({
      consultantTitle: title.trim() || null,
      presentation: presentationValue
        .split(/\n\n+/)
        .map((p) => p.trim())
        .filter(Boolean),
      summary: summaryValue.trim() || null,
      highlightedItems: store
        .getState()
        .draftHighlightedItems.split(/\n+/)
        .map((item) => item.trim())
        .filter(Boolean),
    }),
    [store],
  );

  return useMemo(
    () => ({
      draftTitle,
      draftPresentation,
      draftSummary,
      draftHighlightedItems,
      draftTitleRef: refs.title,
      draftPresentationRef: refs.presentation,
      draftSummaryRef: refs.summary,
      draftHighlightedItemsRef: refs.highlightedItems,
      setDraftTitle,
      setDraftPresentation,
      setDraftSummary,
      setDraftHighlightedItems,
      buildDraftPatch,
      buildDraftPatchFromValues,
    }),
    [
      buildDraftPatch,
      buildDraftPatchFromValues,
      draftHighlightedItems,
      draftPresentation,
      draftSummary,
      draftTitle,
      refs,
      setDraftHighlightedItems,
      setDraftPresentation,
      setDraftSummary,
      setDraftTitle,
    ],
  );
}
