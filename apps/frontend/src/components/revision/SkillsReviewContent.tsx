import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { diffWords } from "diff";
import type { ReviewRenderArgs } from "../ai-assistant/DiffReviewDialog";

export type SkillsReviewSection = {
  heading: string;
  items: string[];
};

export type SkillsReviewValue = {
  suggestionId: string;
  mode: "group_order" | "group_contents";
  targetCategory?: string;
  originalSections: SkillsReviewSection[];
  suggestedSections: SkillsReviewSection[];
};

function SkillsSectionCard({
  label,
  sections,
  tone,
}: {
  label: string;
  sections: SkillsReviewSection[];
  tone: "original" | "suggested";
}) {
  const palette = tone === "original"
    ? { bg: "error.light", fg: "error.contrastText" }
    : { bg: "success.light", fg: "success.contrastText" };

  return (
    <Box sx={{ flex: 1 }}>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block" }}>
        {label}
      </Typography>
      <Box
        data-testid={`skills-review-${tone}`}
        sx={{
          p: 2,
          borderRadius: 1,
          bgcolor: palette.bg,
          color: palette.fg,
          minHeight: 100,
        }}
      >
        {sections.map((section) => (
          <Box
            key={section.heading}
            data-testid={`skills-review-${tone}-section`}
            sx={{ "&:not(:last-child)": { mb: 1.5 } }}
          >
            <Typography
              variant="subtitle2"
              sx={{ fontWeight: 700 }}
              data-testid={`skills-review-${tone}-heading`}
            >
              {section.heading}
            </Typography>
            <Box component="ol" sx={{ m: 0, mt: 0.75, pl: 2.5 }} data-testid={`skills-review-${tone}-list`}>
              {section.items.map((item) => (
                <Box key={item} component="li" sx={{ mb: 0.25 }} data-testid={`skills-review-${tone}-item`}>
                  <Typography variant="body2" component="span">
                    {item}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function SideBySideSkillsReview({ value }: { value: SkillsReviewValue }) {
  const { t } = useTranslation("common");
  const helperText = value.mode === "group_order"
    ? "Only the order of the groups changes in this suggestion."
    : `Only ${value.targetCategory ?? "the selected group"} changes in this suggestion.`;

  return (
    <Box sx={{ mt: 1 }}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        {helperText}
      </Typography>
      <Box sx={{ display: "flex", gap: 2 }}>
        <SkillsSectionCard
          label={t("aiAssistant.diff.original")}
          sections={value.originalSections}
          tone="original"
        />
        <SkillsSectionCard
          label={t("aiAssistant.diff.suggested")}
          sections={value.suggestedSections}
          tone="suggested"
        />
      </Box>
    </Box>
  );
}

function sectionsToText(sections: SkillsReviewSection[], mode: SkillsReviewValue["mode"]) {
  if (mode === "group_order") {
    return sections.map((s) => s.heading).join(", ");
  }
  return sections.flatMap((s) => s.items).join(", ");
}

function UnifiedSkillsReview({ value }: { value: SkillsReviewValue }) {
  const original = sectionsToText(value.originalSections, value.mode);
  const suggested = sectionsToText(value.suggestedSections, value.mode);
  const parts = diffWords(original, suggested);

  return (
    <Box
      sx={{
        mt: 1,
        p: 2,
        borderRadius: 1,
        bgcolor: "background.paper",
        border: "1px solid",
        borderColor: "divider",
        fontSize: "0.875rem",
        lineHeight: 1.6,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        fontFamily: "monospace",
      }}
    >
      {parts.map((part, i) => {
        if (part.removed) {
          return (
            <Box
              key={i}
              component="span"
              sx={{
                bgcolor: "error.light",
                color: "error.contrastText",
                textDecoration: "line-through",
                px: 0.25,
                borderRadius: 0.5,
              }}
            >
              {part.value}
            </Box>
          );
        }
        if (part.added) {
          return (
            <Box
              key={i}
              component="span"
              sx={{
                bgcolor: "success.light",
                color: "success.contrastText",
                px: 0.25,
                borderRadius: 0.5,
              }}
            >
              {part.value}
            </Box>
          );
        }
        return <span key={i}>{part.value}</span>;
      })}
    </Box>
  );
}

export function renderSkillsReview({ mode, value }: ReviewRenderArgs<SkillsReviewValue>) {
  return mode === "side-by-side"
    ? <SideBySideSkillsReview value={value} />
    : <UnifiedSkillsReview value={value} />;
}
