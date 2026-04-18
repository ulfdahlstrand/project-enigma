/**
 * RowMenu — editorial commit row action menu.
 *
 * Design: dark card anchored to the "..." button via MUI Popper (bottom-end),
 * with commit header, grouped actions, keyboard-shortcut badges, and a
 * destructive separator section.
 */

import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Popper from "@mui/material/Popper";
import { accent, danger, fg, font, ink, line } from "../compare/compare-design";
import { laneColor } from "./history-inline-graph";
import type { GraphCommit } from "./history-graph-utils";
import { RelativeTime } from "../../../../../components/RelativeTime";
import {
  BranchIcon,
  CopyIcon,
  DiffIcon,
  EyeIcon,
  LinkIcon,
  RewindIcon,
} from "../../../../../components/Icons";

// ---------------------------------------------------------------------------
// Internal sub-components
// ---------------------------------------------------------------------------

const itemBaseSx = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  gap: "10px",
  padding: "8px 10px",
  borderRadius: "7px",
  background: "transparent",
  border: 0,
  cursor: "pointer",
  fontFamily: font.ui,
  fontSize: "12.5px",
  textAlign: "left" as const,
  transition: "background 120ms, color 120ms",
} as const;

interface RowMenuItemProps {
  icon: React.ReactNode;
  label: React.ReactNode;
  kbd?: React.ReactNode;
  onClick: () => void;
  isDanger?: boolean;
}

function RowMenuItem({ icon, label, kbd, onClick, isDanger = false }: RowMenuItemProps) {
  const itemColor = isDanger ? danger.main : fg[2];
  const iconColor = isDanger ? danger.main : fg[4];
  const hoverIconColor = isDanger ? danger.main : fg[2];

  return (
    <Box
      component="button"
      role="menuitem"
      onClick={onClick}
      sx={{
        ...itemBaseSx,
        color: itemColor,
        "& svg": { color: iconColor, flexShrink: 0 },
        "&:hover": { background: ink[3], color: isDanger ? danger.main : fg[1] },
        "&:hover svg": { color: hoverIconColor },
      }}
    >
      {icon}
      <Box component="span" sx={{ flex: 1, minWidth: 0 }}>
        {label}
      </Box>
      {kbd !== undefined && (
        <Box
          component="span"
          aria-hidden="true"
          sx={{
            fontFamily: font.mono,
            fontSize: "10px",
            padding: "1px 6px",
            minWidth: 14,
            textAlign: "center",
            borderRadius: "4px",
            background: ink[1],
            border: `1px solid ${line[1]}`,
            color: fg[4],
            flexShrink: 0,
            letterSpacing: "0.02em",
          }}
        >
          {kbd}
        </Box>
      )}
    </Box>
  );
}

function RowMenuGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box sx={{ padding: "4px 0" }}>
      <Box
        sx={{
          fontFamily: font.mono,
          fontSize: "9.5px",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: fg[5],
          padding: "6px 10px 4px",
        }}
      >
        {label}
      </Box>
      {children}
    </Box>
  );
}

function RowMenuSep() {
  return (
    <Box
      sx={{
        height: "1px",
        background: line[1],
        margin: "4px 6px",
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// RowMenu
// ---------------------------------------------------------------------------

export interface RowMenuProps {
  commit: GraphCommit;
  laneIndex: number;
  branchName: string | null;
  isHead: boolean;
  anchorEl: HTMLElement;
  resumeId: string;
  onClose: () => void;
  onViewCommit: () => void;
  onCompare: () => void;
  onCompareWithParent: (() => void) | null;
  onRevert: () => void;
}

export function RowMenu({
  commit,
  laneIndex,
  branchName,
  isHead,
  anchorEl,
  resumeId,
  onClose,
  onViewCommit,
  onCompare,
  onCompareWithParent,
  onRevert,
}: RowMenuProps) {
  const { t } = useTranslation("common");
  const menuRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        !anchorEl.contains(e.target as Node)
      ) {
        onCloseRef.current();
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onCloseRef.current();
    }
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [anchorEl]);

  const color = laneColor(laneIndex);
  const isAi = commit.createdBy === null;
  const authorLabel = isAi
    ? t("resume.history.authorAI", { defaultValue: "AI-assistent" })
    : t("resume.history.authorHuman", { defaultValue: "Ulf Dahlstrand" });
  const title = commit.title || t("resume.history.defaultMessage");
  const displayBranchName = branchName ?? "—";

  return (
    <Popper
      open
      anchorEl={anchorEl}
      placement="bottom-end"
      modifiers={[{ name: "offset", options: { offset: [0, 6] } }]}
      sx={{ zIndex: 1300 }}
    >
      <Box
        ref={menuRef}
        role="menu"
        onClick={(e) => e.stopPropagation()}
        sx={{
          minWidth: 320,
          maxWidth: 360,
          background: `linear-gradient(180deg, ${ink[2]}, ${ink[1]})`,
          border: `1px solid ${line[2]}`,
          borderRadius: "12px",
          padding: "6px",
          boxShadow:
            "0 1px 0 oklch(100% 0 0 / 0.04) inset, 0 20px 60px -10px oklch(0% 0 0 / 0.6), 0 8px 20px -6px oklch(0% 0 0 / 0.5)",
        }}
      >
      {/* Commit header card */}
      <Box
        sx={{
          padding: "12px 12px 10px",
          borderRadius: "8px",
          background: ink[0],
          border: `1px solid ${line[1]}`,
          marginBottom: "6px",
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: "7px",
            fontFamily: font.mono,
            fontSize: "10.5px",
            letterSpacing: "0.02em",
            marginBottom: "8px",
          }}
        >
          <Box
            sx={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: color,
              boxShadow: "0 0 0 2px oklch(100% 0 0 / 0.06)",
              flexShrink: 0,
            }}
          />
          <Box component="span" sx={{ fontWeight: 500, color }}>
            {displayBranchName}
          </Box>
          {isHead && (
            <Box
              component="span"
              sx={{
                fontSize: "9px",
                padding: "1px 5px",
                borderRadius: "3px",
                background: accent.soft,
                color: accent.main,
                border: `1px solid ${accent.line}`,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                fontWeight: 600,
              }}
            >
              HEAD
            </Box>
          )}
          <Box
            component="span"
            sx={{ marginLeft: "auto", color: fg[5], fontSize: "10px", fontFamily: font.mono }}
          >
            @{commit.id.slice(0, 7)}
          </Box>
        </Box>

        <Box
          sx={{
            fontFamily: font.display,
            fontSize: "14px",
            lineHeight: 1.35,
            color: fg[1],
            fontWeight: 400,
          }}
        >
          {title}
        </Box>

        <Box
          sx={{
            marginTop: "6px",
            fontSize: "11px",
            color: fg[4],
            display: "flex",
            alignItems: "center",
            gap: "6px",
            flexWrap: "wrap",
          }}
        >
          <span>{authorLabel}</span>
          <Box component="span" sx={{ color: fg[5] }}>·</Box>
          <RelativeTime date={commit.createdAt} />
        </Box>
      </Box>

      {/* Group: Visa */}
      <RowMenuGroup label="Visa">
        <RowMenuItem
          icon={<EyeIcon />}
          label={t("resume.history.viewCommitMenuItem")}
          kbd="↵"
          onClick={() => { onViewCommit(); onClose(); }}
        />
        <RowMenuItem
          icon={<DiffIcon />}
          label={t("resume.history.compareWithCurrentMenuItem")}
          kbd="D"
          onClick={() => { onCompare(); onClose(); }}
        />
        {onCompareWithParent && (
          <RowMenuItem
            icon={<BranchIcon />}
            label={t("resume.history.compareWithParentMenuItem", { defaultValue: "Jämför med föregående commit" })}
            kbd="⇧D"
            onClick={() => { onCompareWithParent(); onClose(); }}
          />
        )}
      </RowMenuGroup>

      <RowMenuSep />

      {/* Group: Åtgärder */}
      <RowMenuGroup label={t("resume.history.menuGroupActions", { defaultValue: "Åtgärder" })}>
        <RowMenuItem
          icon={<CopyIcon />}
          label={t("resume.history.copyCommitIdMenuItem", { defaultValue: "Kopiera commit-ID" })}
          kbd={
            <Box component="span" sx={{ fontFamily: font.mono, fontSize: "10px", background: "transparent", border: "none" }}>
              {commit.id.slice(0, 7)}
            </Box>
          }
          onClick={() => {
            void navigator.clipboard.writeText(commit.id);
            onClose();
          }}
        />
        <RowMenuItem
          icon={<LinkIcon />}
          label={t("resume.history.copyLinkMenuItem", { defaultValue: "Kopiera länk till ögonblicksbild" })}
          onClick={() => {
            void navigator.clipboard.writeText(
              `${window.location.origin}/resumes/${resumeId}/commit/${commit.id}`,
            );
            onClose();
          }}
        />
      </RowMenuGroup>

      <RowMenuSep />

      {/* Destructive */}
      <Box sx={{ padding: "4px 0" }}>
        <RowMenuItem
          icon={<RewindIcon />}
          label={
            <>
              {t("resume.history.restoreSnapshotMenuItem")}{" "}
              <Box component="b" sx={{ fontWeight: 500, color: fg[1] }}>
                {displayBranchName}
              </Box>{" "}
              {t("resume.history.restoreSnapshotToThis", { defaultValue: "till denna" })}
            </>
          }
          isDanger
          onClick={() => { onRevert(); onClose(); }}
        />
      </Box>
      </Box>
    </Popper>
  );
}
