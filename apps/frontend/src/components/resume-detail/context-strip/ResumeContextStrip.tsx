/**
 * ResumeContextStrip — a slim horizontal row rendered between PageHeader and the
 * workspace. Consolidates four scattered pieces of context into one place:
 *
 *   1. VariantChip    — active variant name + dropdown to switch / add variants
 *   2. LanguageLinkBadge(s) — one link per linked resume (cross-language translation)
 *   3. DraftStatusChip — "Synced" or "Unsaved changes" based on edit-mode draft state
 *   4. StaleRevisionChip — informational pill for stale translations or revisions
 *
 * Styling: MUI sx prop only
 * i18n: useTranslation("common") — keys under resume.contextStrip.*
 */
import type { useNavigate } from "@tanstack/react-router";
import Box from "@mui/material/Box";
import type { ReactNode } from "react";

import { VariantChip } from "./VariantChip";
import { DraftStatusChip } from "./DraftStatusChip";
import { StaleRevisionChip } from "./StaleRevisionChip";
import { LanguageLinkBadge } from "../../../routes/_authenticated/resumes/$id_/history/LanguageLinkBadge";
import { useListCommitTags } from "../../../hooks/versioning";
import type { CommitTagWithLinkedResume } from "@cv-tool/contracts";
import type { ResumeDetailPageBundle } from "../pages/useResumeDetailPage";

export interface ResumeContextStripProps {
  bundle: {
    id: string;
    isEditRoute: boolean;
    branches: ResumeDetailPageBundle["branches"];
    activeBranchId: ResumeDetailPageBundle["activeBranchId"];
    activeBranch: ResumeDetailPageBundle["activeBranch"];
    activeBranchType: ResumeDetailPageBundle["activeBranchType"];
    activeBranchName: ResumeDetailPageBundle["activeBranchName"];
    variantBranchId: ResumeDetailPageBundle["variantBranchId"];
    sourceBranch: ResumeDetailPageBundle["sourceBranch"];
    mergedCommitIds: ResumeDetailPageBundle["mergedCommitIds"];
    // Draft fields
    draftTitle: ResumeDetailPageBundle["draftTitle"];
    consultantTitle: ResumeDetailPageBundle["consultantTitle"];
    draftPresentation: ResumeDetailPageBundle["draftPresentation"];
    presentationText: string;
    draftSummary: ResumeDetailPageBundle["draftSummary"];
    summary: ResumeDetailPageBundle["summary"];
    draftHighlightedItems: ResumeDetailPageBundle["draftHighlightedItems"];
    highlightedItemsText: string;
    navigate: ReturnType<typeof useNavigate>;
  };
  onAddVariant: () => void;
  saveAction?: ReactNode;
}

function StaleAwareLanguageBadge({
  tag,
  currentResumeId,
  activeBranchHeadCommitId,
}: {
  tag: CommitTagWithLinkedResume;
  currentResumeId: string;
  activeBranchHeadCommitId: string | null;
}) {
  const linkedIsTarget = tag.source.resumeId === currentResumeId;
  const taggedCommit = linkedIsTarget ? tag.sourceCommitId : tag.targetCommitId;
  const isStale = activeBranchHeadCommitId != null && activeBranchHeadCommitId !== taggedCommit;

  return <LanguageLinkBadge tag={tag} currentResumeId={currentResumeId} isStale={isStale} />;
}

export function ResumeContextStrip({ bundle, onAddVariant, saveAction }: ResumeContextStripProps) {
  const {
    id,
    isEditRoute,
    branches,
    activeBranchId,
    activeBranch,
    activeBranchType,
    activeBranchName,
    variantBranchId,
    sourceBranch,
    mergedCommitIds,
    draftTitle,
    consultantTitle,
    draftPresentation,
    presentationText,
    draftSummary,
    summary,
    draftHighlightedItems,
    highlightedItemsText,
    navigate,
  } = bundle;

  const showVariantChip = variantBranchId !== null && branches !== undefined;

  const { data: commitTags } = useListCommitTags(id, activeBranchId);
  const linkedTags = commitTags ?? [];
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.75,
        px: 2,
        height: 40,
        borderBottom: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
        flexShrink: 0,
        overflowX: "auto",
        overflowY: "hidden",
        scrollbarWidth: "none",
        "&::-webkit-scrollbar": { display: "none" },
      }}
    >
      {showVariantChip && (
        <VariantChip
          resumeId={id}
          branches={branches}
          variantBranchId={variantBranchId}
          activeBranchName={activeBranchName}
          mergedCommitIds={mergedCommitIds}
          navigate={navigate}
          onAddVariant={onAddVariant}
        />
      )}



      {linkedTags.map((tag) => (
        <StaleAwareLanguageBadge
          key={tag.id}
          tag={tag}
          currentResumeId={id}
          activeBranchHeadCommitId={activeBranch?.headCommitId ?? null}
        />
      ))}

      <DraftStatusChip
        isEditRoute={isEditRoute}
        draftTitle={draftTitle}
        consultantTitle={consultantTitle}
        draftPresentation={draftPresentation}
        presentationText={presentationText}
        draftSummary={draftSummary}
        summary={summary}
        draftHighlightedItems={draftHighlightedItems}
        highlightedItemsText={highlightedItemsText}
      />

      <StaleRevisionChip
        activeBranchType={activeBranchType}
        sourceBranch={sourceBranch}
      />
      {saveAction && (
        <Box sx={{ ml: "auto", flexShrink: 0 }}>
          {saveAction}
        </Box>
      )}
    </Box>
  );
}
