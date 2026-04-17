/**
 * SkillChipDiff — renders skill diffs as chipdiff blocks matching
 * real/styles.css .chipdiff-label + .chipdiff. Each category gets a small
 * uppercase mono label followed by a flex-wrap row of chips.
 *
 * Styling: MUI sx prop only (design tokens from compare-design.ts)
 * i18n: useTranslation("common")
 */
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import type { DiffGroupItem, DiffStatus } from "../../../../../utils/diff-utils";
import { danger, fg, font, ink, line, ok } from "./compare-design";

interface SkillChipDiffProps {
  items: DiffGroupItem[];
}

interface CategoryGroup {
  category: string;
  items: DiffGroupItem[];
}

const UNCATEGORISED_KEY = "__uncategorised__";

function groupByCategory(items: DiffGroupItem[]): CategoryGroup[] {
  const buckets = new Map<string, DiffGroupItem[]>();
  for (const item of items) {
    const key =
      item.category && item.category.trim().length > 0
        ? item.category
        : UNCATEGORISED_KEY;
    const existing = buckets.get(key);
    if (existing) existing.push(item);
    else buckets.set(key, [item]);
  }
  return Array.from(buckets.entries()).map(([category, groupItems]) => ({
    category,
    items: groupItems,
  }));
}

function chipSx(status: DiffStatus) {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    px: "10px",
    py: "3px",
    borderRadius: "999px",
    fontFamily: font.mono,
    fontSize: "11px",
    letterSpacing: "0.02em",
    backgroundColor: ink[2],
    color: fg[3],
    border: `1px solid ${line[1]}`,
  } as const;
  if (status === "added") {
    return {
      ...base,
      backgroundColor: ok.soft,
      color: ok.main,
      borderColor: ok.line,
    };
  }
  if (status === "removed") {
    return {
      ...base,
      backgroundColor: danger.soft,
      color: danger.main,
      borderColor: danger.line,
      textDecoration: "line-through",
    };
  }
  return base;
}

export function SkillChipDiff({ items }: SkillChipDiffProps) {
  const { t } = useTranslation("common");
  const groups = useMemo(() => groupByCategory(items), [items]);

  if (groups.length === 0) return null;

  return (
    <Box>
      {groups.map((group) => (
        <Box key={group.category}>
          <Box
            sx={{
              px: "16px",
              pt: "10px",
              pb: "2px",
              borderTop: `1px solid ${line[1]}`,
              fontFamily: font.mono,
              fontSize: "10px",
              color: fg[5],
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}
          >
            {group.category === UNCATEGORISED_KEY
              ? t("resume.compare.skills.uncategorised")
              : group.category}
          </Box>
          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              gap: "6px",
              px: "16px",
              py: "12px",
              borderTop: `1px solid ${line[1]}`,
            }}
          >
            {group.items.map((item) => (
              <Box
                key={item.key}
                component="span"
                sx={chipSx(item.status)}
                aria-label={t(
                  `resume.compare.status${item.status.charAt(0).toUpperCase()}${item.status.slice(1)}`,
                )}
              >
                {item.title}
              </Box>
            ))}
          </Box>
        </Box>
      ))}
    </Box>
  );
}
