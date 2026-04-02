import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import type { RefObject } from "react";

interface ResumeCoverPageContentProps {
  employeeName: string;
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
}

export function ResumeCoverPageContent({
  employeeName,
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
}: ResumeCoverPageContentProps) {
  const { t } = useTranslation("common");

  return (
    <Box sx={{ display: "flex", flexDirection: "column", justifyContent: "center", minHeight: "100%", pt: "200px" }}>
      <Box>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h1" component="h1" sx={{ fontWeight: 700, lineHeight: 1.1, color: "text.primary" }}>
            {employeeName}
          </Typography>
          {isEditing ? (
            <TextField
              label={t("resume.edit.consultantTitleLabel")}
              value={draftTitle}
              onChange={(e) => onDraftTitleChange?.(e.target.value)}
              variant="standard"
              fullWidth
              sx={{ mt: 0.5, "& input": { fontWeight: 700, fontSize: "1.25rem" } }}
            />
          ) : consultantTitle ? (
            <Typography variant="h3" component="p" sx={{ fontWeight: 700, color: "text.primary", mt: 0.5 }}>
              {consultantTitle}
            </Typography>
          ) : null}
        </Box>

        {isEditing ? (
          <TextField
            label={t("resume.edit.presentationLabel")}
            helperText={t("resume.edit.presentationHelper")}
            value={draftPresentation}
            onChange={(e) => onDraftPresentationChange?.(e.target.value)}
            multiline
            minRows={4}
            fullWidth
            variant="outlined"
            sx={{ mb: 3 }}
            {...(presentationRef && { inputRef: presentationRef })}
          />
        ) : presentation.length > 0 ? (
          <Box {...(presentationRef && { ref: presentationRef })} sx={{ mb: 3 }}>
            {presentation.map((para, i) => (
              <Typography key={i} variant="body1" sx={{ mb: 1, textAlign: "justify" }}>
                {para}
              </Typography>
            ))}
          </Box>
        ) : null}

        {(isEditing || summary || highlightedItems.length > 0) && (
          <Box
            sx={{
              bgcolor: "action.hover",
              border: "none",
              borderRadius: 0,
              px: 3,
              py: 2.5,
            }}
          >
            {(isEditing || summary) && (
              <Box sx={{ mb: highlightedItems.length > 0 || isEditing ? 2.5 : 0 }}>
                <Typography
                  variant="caption"
                  sx={{ fontWeight: 700, letterSpacing: "0.08em", display: "block", mb: 0.75 }}
                >
                  {t("resume.detail.specialSkillsHeading").toUpperCase()}
                </Typography>
                {isEditing ? (
                  <TextField
                    label={t("resume.edit.summaryLabel")}
                    value={draftSummary}
                    onChange={(e) => onDraftSummaryChange?.(e.target.value)}
                    multiline
                    minRows={2}
                    fullWidth
                    variant="outlined"
                    size="small"
                  />
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    {summary}
                  </Typography>
                )}
              </Box>
            )}

            {(isEditing || highlightedItems.length > 0) && (
              <Box>
                <Typography
                  variant="caption"
                  sx={{ fontWeight: 700, letterSpacing: "0.08em", display: "block", mb: 0.75 }}
                >
                  {t("resume.detail.highlightedExperienceHeading").toUpperCase()}
                </Typography>
                {isEditing ? (
                  <TextField
                    label={t("resume.edit.highlightedExperienceLabel")}
                    helperText={t("resume.edit.highlightedExperienceHelper")}
                    value={draftHighlightedItems}
                    onChange={(e) => onDraftHighlightedItemsChange?.(e.target.value)}
                    multiline
                    minRows={3}
                    fullWidth
                    variant="outlined"
                    size="small"
                  />
                ) : (
                  <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                    {highlightedItems.map((item, i) => (
                      <Typography
                        key={i}
                        component="li"
                        variant="body2"
                        color="text.secondary"
                        sx={{ mb: 0.25 }}
                      >
                        {item}
                      </Typography>
                    ))}
                  </Box>
                )}
              </Box>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
}
