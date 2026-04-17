/**
 * CompareDiffGroupsCard — editorial diff container matching real/styles.css
 * .diff / .diff__group / .diff__ghead / .diff__row. Each group is a
 * collapsible section with a chevron header, a right-aligned count, and
 * either paired text rows (prose) or a chipdiff block (skills).
 *
 * Styling: MUI sx prop only (design tokens from compare-design.ts)
 * i18n: useTranslation("common")
 */
import type { MouseEvent } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { diffWords } from "diff";
import Box from "@mui/material/Box";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import type { DiffGroup, DiffGroupItem } from "../../../../../utils/diff-utils";
import { EditorialSideBySideDiff } from "./EditorialSideBySideDiff";
import { SkillChipDiff } from "./SkillChipDiff";
import {
  accent,
  danger,
  fg,
  font,
  ink,
  line,
  ok,
  radius,
} from "./compare-design";
import type { CompareViewMode } from "./compare-utils";

interface CompareDiffGroupsCardProps {
  diffGroups: DiffGroup[];
  totalPlusCount: number;
  totalMinusCount: number;
  viewMode: CompareViewMode;
  onViewModeChange: (event: MouseEvent<HTMLElement>, nextValue: CompareViewMode | null) => void;
}

function groupCount(group: DiffGroup): string {
  return `+${group.plusCount} / −${group.minusCount}`;
}

interface DiffRowProps {
  tone: "add" | "del" | "neutral";
  leftChildren?: React.ReactNode;
  rightChildren?: React.ReactNode;
  spanChildren?: React.ReactNode;
  isFirst: boolean;
}

function DiffRow({ tone, leftChildren, rightChildren, spanChildren, isFirst }: DiffRowProps) {
  const gutterChar = tone === "add" ? "+" : tone === "del" ? "−" : " ";
  const gutterBg = tone === "add" ? ok.soft : tone === "del" ? danger.soft : ink[1];
  const gutterColor = tone === "add" ? ok.main : tone === "del" ? danger.main : fg[5];
  const cellBg = (kind: "add" | "del" | "empty" | "neutral") => {
    if (kind === "add") return ok.cellBg;
    if (kind === "del") return danger.cellBg;
    return "transparent";
  };

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "28px 1fr 1fr",
        borderTop: isFirst ? "none" : `1px solid ${line[1]}`,
        fontSize: "13px",
      }}
    >
      <Box
        sx={{
          backgroundColor: gutterBg,
          color: gutterColor,
          fontFamily: font.mono,
          fontSize: "11px",
          textAlign: "center",
          py: "10px",
          userSelect: "none",
        }}
      >
        {gutterChar}
      </Box>
      {spanChildren !== undefined ? (
        <Box
          sx={{
            gridColumn: "2 / 4",
            px: "16px",
            py: "10px",
            color: fg[2],
            lineHeight: 1.65,
            borderLeft: `1px solid ${line[1]}`,
            backgroundColor: cellBg(tone === "add" ? "add" : tone === "del" ? "del" : "neutral"),
            whiteSpace: "pre-wrap",
            overflowWrap: "break-word",
            minWidth: 0,
          }}
        >
          {spanChildren}
        </Box>
      ) : (
        <>
          <Box
            sx={{
              px: "16px",
              py: "10px",
              color: fg[2],
              lineHeight: 1.65,
              borderLeft: `1px solid ${line[1]}`,
              backgroundColor: cellBg(tone === "del" ? "del" : "empty"),
              whiteSpace: "pre-wrap",
              overflowWrap: "break-word",
              minWidth: 0,
            }}
          >
            {leftChildren ?? ""}
          </Box>
          <Box
            sx={{
              px: "16px",
              py: "10px",
              color: fg[2],
              lineHeight: 1.65,
              borderLeft: `1px solid ${line[1]}`,
              backgroundColor: cellBg(tone === "add" ? "add" : "empty"),
              whiteSpace: "pre-wrap",
              overflowWrap: "break-word",
              minWidth: 0,
            }}
          >
            {rightChildren ?? ""}
          </Box>
        </>
      )}
    </Box>
  );
}

function EditorialInlineDiff({ original, suggested }: { original: string; suggested: string }) {
  const parts = diffWords(original, suggested);
  return (
    <>
      {parts.map((part, i) => {
        if (part.removed) {
          return (
            <Box
              key={i}
              component="span"
              sx={{ backgroundColor: danger.soft, color: danger.main, textDecoration: "line-through", px: "2px", borderRadius: "2px" }}
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
              sx={{ backgroundColor: ok.soft, color: ok.main, px: "2px", borderRadius: "2px" }}
            >
              {part.value}
            </Box>
          );
        }
        return <span key={i}>{part.value}</span>;
      })}
    </>
  );
}

function renderItemRows(item: DiffGroupItem, viewMode: CompareViewMode, rowIndex: number) {
  if (viewMode === "summary") {
    return (
      <Box
        key={item.key}
        sx={{
          borderTop: rowIndex === 0 ? "none" : `1px solid ${line[1]}`,
          px: "16px",
          py: "10px",
          fontSize: "13px",
          color: fg[2],
          lineHeight: 1.65,
          fontFamily: font.ui,
          whiteSpace: "pre-wrap",
          overflowWrap: "break-word",
        }}
      >
        <EditorialInlineDiff original={item.before} suggested={item.after} />
      </Box>
    );
  }

  // Split view — editorial side-by-side with word highlighting.
  return (
    <Box
      key={item.key}
      sx={{ borderTop: rowIndex === 0 ? "none" : `1px solid ${line[1]}` }}
    >
      <EditorialSideBySideDiff original={item.before} suggested={item.after} />
    </Box>
  );
}

function DiffGroupSection({
  group,
  viewMode,
}: {
  group: DiffGroup;
  viewMode: CompareViewMode;
}) {
  const [open, setOpen] = useState(true);

  return (
    <Box sx={{ borderBottom: `1px solid ${line[1]}`, "&:last-child": { borderBottom: 0 } }}>
      <Box
        onClick={() => setOpen((prev) => !prev)}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpen((prev) => !prev);
          }
        }}
        sx={{
          backgroundColor: ink[2],
          borderBottom: open ? `1px solid ${line[1]}` : "none",
          px: "16px",
          py: "10px",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          fontFamily: font.display,
          fontSize: "16px",
          fontWeight: 400,
          color: fg[1],
          letterSpacing: "-0.01em",
          cursor: "pointer",
          "&:hover": { backgroundColor: ink[3] },
          "&:focus-visible": {
            outline: `2px solid ${accent.main}`,
            outlineOffset: "-2px",
          },
        }}
      >
        {open ? (
          <ExpandMoreIcon sx={{ fontSize: 14, color: fg[4] }} />
        ) : (
          <ChevronRightIcon sx={{ fontSize: 14, color: fg[4] }} />
        )}
        <Box component="span">{group.label}</Box>
        <Box
          component="span"
          sx={{
            ml: "auto",
            fontFamily: font.mono,
            fontSize: "10.5px",
            color: fg[4],
            letterSpacing: "0.02em",
          }}
        >
          {groupCount(group)}
        </Box>
      </Box>
      {open && (
        <Box>
          {group.key === "skills" ? (
            <SkillChipDiff items={group.items} />
          ) : (
            group.items.map((item, index) => renderItemRows(item, viewMode, index))
          )}
        </Box>
      )}
    </Box>
  );
}

export function CompareDiffGroupsCard({
  diffGroups,
  viewMode,
  onViewModeChange,
}: CompareDiffGroupsCardProps) {
  const { t } = useTranslation("common");

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "10px",
          flexWrap: "wrap",
        }}
      >
        <Box
          component="span"
          sx={{
            fontFamily: font.mono,
            fontSize: "12px",
            color: fg[4],
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          {t("resume.compare.changedGroups", { count: diffGroups.length })}
        </Box>
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          size="small"
          onChange={onViewModeChange}
          aria-label={t("resume.compare.viewModeLabel")}
          sx={{
            "& .MuiToggleButton-root": {
              fontFamily: font.mono,
              fontSize: "11px",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: fg[3],
              borderColor: line[1],
              px: "12px",
              py: "4px",
              "&.Mui-selected": {
                backgroundColor: accent.soft,
                color: accent.main,
                borderColor: accent.line,
              },
            },
          }}
        >
          <ToggleButton value="summary" aria-label={t("resume.compare.summaryView")}>
            {t("resume.compare.summaryView")}
          </ToggleButton>
          <ToggleButton value="split" aria-label={t("resume.compare.splitView")}>
            {t("resume.compare.splitView")}
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>
      <Box
        sx={{
          backgroundColor: ink[1],
          border: `1px solid ${line[1]}`,
          borderRadius: radius.lg,
          overflow: "hidden",
        }}
      >
        {diffGroups.map((group) => (
          <DiffGroupSection key={group.key} group={group} viewMode={viewMode} />
        ))}
      </Box>
    </Box>
  );
}
