import Box from "@mui/material/Box";
import type { RefObject } from "react";
import { ResumeDocumentPage } from "./ResumeDocumentPage";
import { ResumeCoverPageContent } from "./ResumeCoverPageContent";

interface ResumeCoverPageProps {
  title: string;
  language?: string | null;
  page: number;
  totalPages: number;
  employeeName: string;
  profileImageDataUrl: string | null;
  consultantTitle: string | null;
  presentation: string[];
  summary: string | null;
  highlightedItems: string[];
  presentationRef?: RefObject<HTMLDivElement | null>;
  isEditing?: boolean;
  draftTitle?: string;
  draftPresentation?: string;
  draftSummary?: string;
  draftHighlightedItems?: string;
  onDraftTitleChange?: (v: string) => void;
  onDraftPresentationChange?: (v: string) => void;
  onDraftSummaryChange?: (v: string) => void;
  onDraftHighlightedItemsChange?: (v: string) => void;
  sectionRef?: RefObject<HTMLDivElement | null>;
}

export function ResumeCoverPage({
  title,
  language,
  page,
  totalPages,
  employeeName,
  profileImageDataUrl,
  consultantTitle,
  presentation,
  summary,
  highlightedItems,
  presentationRef,
  isEditing = false,
  draftTitle = "",
  draftPresentation = "",
  draftSummary = "",
  draftHighlightedItems = "",
  onDraftTitleChange,
  onDraftPresentationChange,
  onDraftSummaryChange,
  onDraftHighlightedItemsChange,
  sectionRef,
}: ResumeCoverPageProps) {
  return (
    <Box {...(sectionRef ? { ref: sectionRef } : {})} sx={{ width: "100%", display: "flex", justifyContent: "center" }}>
      <ResumeDocumentPage title={title} language={language ?? undefined} page={page} totalPages={totalPages} hideHeader>
        <ResumeCoverPageContent
          language={language}
          employeeName={employeeName}
          profileImageDataUrl={profileImageDataUrl}
          consultantTitle={consultantTitle}
          presentation={presentation}
          summary={summary}
          highlightedItems={highlightedItems}
          isEditing={isEditing}
          draftTitle={draftTitle}
          draftPresentation={draftPresentation}
          draftSummary={draftSummary}
          draftHighlightedItems={draftHighlightedItems}
          {...(presentationRef ? { presentationRef } : {})}
          {...(onDraftTitleChange ? { onDraftTitleChange } : {})}
          {...(onDraftPresentationChange ? { onDraftPresentationChange } : {})}
          {...(onDraftSummaryChange ? { onDraftSummaryChange } : {})}
          {...(onDraftHighlightedItemsChange ? { onDraftHighlightedItemsChange } : {})}
        />
      </ResumeDocumentPage>
    </Box>
  );
}
