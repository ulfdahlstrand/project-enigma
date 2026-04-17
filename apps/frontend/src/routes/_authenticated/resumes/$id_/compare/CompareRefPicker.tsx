/**
 * CompareRefPicker — editorial RefChip trigger card + RefPickerMenu dropdown.
 * Matches real/CompareScreen.jsx exactly: search, three tabs (Variants / Snapshots
 * / Recent), expandable branch rows with nested commit lists, footer hints.
 *
 * Styling: MUI sx prop only (design tokens from compare-design.ts)
 * i18n: useTranslation("common")
 */
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import InputBase from "@mui/material/InputBase";
import Popover from "@mui/material/Popover";
import type { TFunction } from "i18next";
import type { CompareRefBranchOption, CompareRefCommitOption } from "./CompareRefChip";
import { accent, fg, font, ink, line, lilac, ok, radius, warm } from "./compare-design";

// ── Branch color palette ─────────────────────────────────────────────────────

type Tone = { main: string; soft: string; line: string };

const PALETTE: Tone[] = [
  { main: accent.main, soft: accent.soft, line: accent.line },
  { main: warm.main,   soft: warm.soft,   line: warm.line },
  { main: ok.main,     soft: ok.soft,     line: ok.line },
  { main: lilac.main,  soft: lilac.soft,  line: lilac.line },
];

function toneFor(index: number): Tone {
  return PALETTE[index % PALETTE.length]!;
}

// ── Module-level recent-refs store (session memory) ──────────────────────────

const recentRefs: string[] = [];

function trackRecent(ref: string) {
  const i = recentRefs.indexOf(ref);
  if (i > -1) recentRefs.splice(i, 1);
  recentRefs.unshift(ref);
  if (recentRefs.length > 8) recentRefs.pop();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(date: string | Date | null | undefined, t: TFunction): string {
  if (!date) return "";
  const ms = Date.now() - new Date(date).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days === 0) return t("resume.compare.refpicker.today");
  if (days === 1) return t("resume.compare.refpicker.yesterday");
  return t("resume.compare.refpicker.daysAgo", { count: days });
}

function shortId(id: string) {
  return id.slice(0, 6);
}

function commitsForBranch(
  headId: string | null | undefined,
  allCommits: CompareRefCommitOption[],
  limit = 20,
): CompareRefCommitOption[] {
  if (!headId) return [];
  const map = new Map(allCommits.map((c) => [c.id, c]));
  const result: CompareRefCommitOption[] = [];
  let curr = map.get(headId);
  while (curr && result.length < limit) {
    result.push(curr);
    curr = curr.parentCommitId ? map.get(curr.parentCommitId) : undefined;
  }
  return result;
}

type ResolvedRef =
  | { kind: "branch"; branch: CompareRefBranchOption; commit: CompareRefCommitOption | null; branchIndex: number }
  | { kind: "commit"; commit: CompareRefCommitOption; branchIndex: number }
  | null;

function resolveRef(
  value: string,
  branches: CompareRefBranchOption[],
  commits: CompareRefCommitOption[],
): ResolvedRef {
  if (!value) return null;
  const bi = branches.findIndex((b) => b.name === value);
  if (bi > -1) {
    const branch = branches[bi]!;
    const commit = commits.find((c) => c.id === branch.headCommitId) ?? null;
    return { kind: "branch", branch, commit, branchIndex: bi };
  }
  const commit = commits.find((c) => c.id === value);
  if (commit) {
    const bi2 = branches.findIndex((b) => b.headCommitId === commit.id);
    return { kind: "commit", commit, branchIndex: Math.max(0, bi2) };
  }
  return null;
}

// ── Shared sx helpers ─────────────────────────────────────────────────────────

const monoSx = { fontFamily: font.mono };
const dotSx = (color: string) => ({
  width: "10px",
  height: "10px",
  borderRadius: "50%",
  flexShrink: 0,
  backgroundColor: color,
  boxShadow: `0 0 0 2px ${ink[1]}`,
});

// ── RefChip — the trigger card ────────────────────────────────────────────────

interface RefChipProps {
  label: string;
  value: string;
  branches: CompareRefBranchOption[];
  commits: CompareRefCommitOption[];
  onOpen: (el: HTMLElement) => void;
}

function RefChip({ label, value, branches, commits, onOpen }: RefChipProps) {
  const { t } = useTranslation("common");
  const resolved = resolveRef(value, branches, commits);
  const tone = resolved ? toneFor(resolved.branchIndex) : { main: fg[4], soft: "transparent", line: line[1] };
  const commit = resolved?.commit ?? null;
  const branchName = resolved?.kind === "branch" ? resolved.branch.name : null;
  const isHead = resolved?.kind === "branch";

  return (
    <ButtonBase
      onClick={(e) => onOpen(e.currentTarget)}
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        gap: "6px",
        width: "100%",
        textAlign: "left",
        px: "16px",
        py: "13px",
        borderRadius: radius.md,
        border: `1px solid ${line[1]}`,
        backgroundColor: ink[1],
        color: fg[2],
        transition: "border-color 120ms, background-color 120ms",
        "&:hover": { borderColor: line[2], backgroundColor: ink[2] },
        "&:focus-visible": {
          outline: "none",
          borderColor: accent.main,
          boxShadow: `0 0 0 3px ${accent.soft}`,
        },
      }}
    >
      {/* Role label */}
      <Box sx={{ ...monoSx, fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase", color: fg[5] }}>
        {label}
      </Box>

      {/* Branch / ref row */}
      <Box sx={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
        <Box component="span" sx={dotSx(tone.main)} />
        <Box
          component="span"
          sx={{ ...monoSx, fontSize: "13px", color: fg[1], letterSpacing: "0.01em", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
        >
          {branchName ?? (commit ? shortId(commit.id) : t("resume.compare.selectPlaceholder"))}
        </Box>
        {resolved && (
          isHead ? (
            <Box component="span" sx={{ ...monoSx, fontSize: "9.5px", letterSpacing: "0.12em", px: "6px", py: "1px", borderRadius: "4px", backgroundColor: accent.soft, color: accent.main, border: `1px solid ${accent.line}`, flexShrink: 0 }}>
              HEAD
            </Box>
          ) : (
            <Box component="span" sx={{ ...monoSx, fontSize: "11px", color: fg[4], px: "6px", py: "1px", borderRadius: "4px", backgroundColor: ink[2], border: `1px solid ${line[1]}`, flexShrink: 0 }}>
              @{shortId(commit?.id ?? "")}
            </Box>
          )
        )}
        {/* Caret */}
        <Box component="svg" sx={{ ml: "auto", flexShrink: 0, color: fg[4], width: "12px", height: "12px" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </Box>
      </Box>

      {/* Commit message */}
      <Box sx={{ fontSize: "13px", color: fg[2], overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.4, minHeight: "1.4em" }}>
        {commit?.title ?? ""}
      </Box>

      {/* Meta */}
      <Box sx={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", ...monoSx, fontSize: "10.5px", color: fg[4], letterSpacing: "0.02em" }}>
        {commit?.createdBy && <span>{commit.createdBy}</span>}
        {commit?.createdBy && commit?.createdAt && <Box component="span" sx={{ color: fg[5] }}>·</Box>}
        {commit?.createdAt && <span>{relativeTime(commit.createdAt, t)}</span>}
      </Box>
    </ButtonBase>
  );
}

// ── CommitRow — shared between BranchTab and CommitsTab ───────────────────────

interface CommitRowProps {
  commit: CompareRefCommitOption;
  isHead: boolean;
  isSelected: boolean;
  laneColor: string;
  isFirst: boolean;
  isLast: boolean;
  onPick: (id: string) => void;
  t: TFunction;
}

function CommitRow({ commit, isHead, isSelected, laneColor, isFirst, isLast, onPick, t }: CommitRowProps) {
  return (
    <ButtonBase
      data-nav-item
      onClick={() => onPick(commit.id)}
      sx={{
        width: "100%",
        display: "grid",
        gridTemplateColumns: "20px 48px 1fr auto auto",
        alignItems: "center",
        gap: "10px",
        px: "14px",
        py: "6px",
        textAlign: "left",
        fontSize: "12px",
        color: fg[2],
        backgroundColor: isSelected ? accent.soft : "transparent",
        transition: "background 120ms",
        "&:hover": { backgroundColor: isSelected ? accent.soft : ink[2] },
        "&:focus-visible": { outline: `2px solid ${accent.main}`, outlineOffset: "-2px", backgroundColor: ink[2] },
      }}
    >
      {/* Lane rail */}
      <Box sx={{ position: "relative", height: "28px", width: "20px", display: "grid", placeItems: "center" }}>
        <Box sx={{ position: "absolute", left: "50%", top: isFirst ? "50%" : 0, bottom: isLast ? "50%" : 0, width: "2px", ml: "-1px", backgroundColor: laneColor, opacity: 0.6 }} />
        <Box sx={{ position: "relative", width: isHead ? "10px" : "9px", height: isHead ? "10px" : "9px", borderRadius: "50%", backgroundColor: laneColor, boxShadow: `0 0 0 2px ${ink[0]}` }} />
      </Box>
      {/* SHA */}
      <Box component="span" sx={{ ...monoSx, fontSize: "10.5px", color: isHead ? accent.main : fg[4], letterSpacing: "0.02em" }}>
        {shortId(commit.id)}
      </Box>
      {/* Message */}
      <Box component="span" sx={{ color: isSelected ? accent.main : fg[2], overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, display: "flex", alignItems: "center", gap: "6px" }}>
        {isHead && <Box component="span" sx={{ color: accent.main, fontSize: "8px", lineHeight: 1 }} title="HEAD">●</Box>}
        {commit.title ?? shortId(commit.id)}
      </Box>
      {/* Author */}
      <Box component="span" sx={{ ...monoSx, fontSize: "10px", color: fg[5], whiteSpace: "nowrap" }}>
        {commit.createdBy ?? ""}
      </Box>
      {/* Time */}
      <Box component="span" sx={{ ...monoSx, fontSize: "10px", color: fg[4], whiteSpace: "nowrap" }}>
        {relativeTime(commit.createdAt, t)}
      </Box>
    </ButtonBase>
  );
}

// ── BranchTab ─────────────────────────────────────────────────────────────────

interface BranchTabProps {
  branches: CompareRefBranchOption[];
  commits: CompareRefCommitOption[];
  currentValue: string;
  query: string;
  onPick: (ref: string) => void;
  t: TFunction;
}

function BranchTab({ branches, commits, currentValue, query, onPick, t }: BranchTabProps) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const q = query.trim().toLowerCase();
  const visible = branches.filter(
    (b) => !q || b.name.toLowerCase().includes(q),
  );

  if (visible.length === 0) {
    return (
      <Box sx={{ py: "24px", px: "16px", textAlign: "center", color: fg[5], fontSize: "12.5px", ...monoSx }}>
        {t("resume.compare.refpicker.noResults", { query })}
      </Box>
    );
  }

  return (
    <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0 }}>
      {visible.map((branch, i) => {
        const tone = toneFor(i);
        const branchCommits = commitsForBranch(branch.headCommitId, commits);
        const isExpanded = expanded.has(branch.id);
        const isCurrent = currentValue === branch.name;
        const headCommit = branchCommits[0] ?? null;

        return (
          <Box component="li" key={branch.id} sx={{ borderBottom: `1px solid ${line[1]}`, "&:last-child": { borderBottom: 0 } }}>
            {/* Branch head row */}
            <Box sx={{ display: "flex", alignItems: "stretch", minHeight: "54px" }}>
              {/* Expand toggle */}
              <ButtonBase
                onClick={() => setExpanded((prev) => {
                  const next = new Set(prev);
                  next.has(branch.id) ? next.delete(branch.id) : next.add(branch.id);
                  return next;
                })}
                aria-expanded={isExpanded}
                aria-label={isExpanded ? t("resume.compare.refpicker.collapseCommits") : t("resume.compare.refpicker.expandCommits")}
                sx={{ width: "28px", display: "grid", placeItems: "center", color: fg[4], borderRight: `1px solid ${line[1]}`, backgroundColor: ink[1], transition: "color 120ms, background 120ms", "&:hover": { color: fg[1], backgroundColor: ink[2] } }}
              >
                <Box component="svg" sx={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0)", transition: "transform 150ms", width: "10px", height: "10px", flexShrink: 0 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </Box>
              </ButtonBase>

              {/* Branch pick button */}
              <ButtonBase
                data-nav-item
                data-branch-pick-id={branch.id}
                onClick={() => onPick(branch.name)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowRight" && !isExpanded) {
                    e.preventDefault();
                    e.stopPropagation();
                    setExpanded((prev) => new Set(prev).add(branch.id));
                  } else if (e.key === "ArrowLeft" && isExpanded) {
                    e.preventDefault();
                    e.stopPropagation();
                    setExpanded((prev) => {
                      const next = new Set(prev);
                      next.delete(branch.id);
                      return next;
                    });
                  }
                }}
                sx={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: "12px", px: "14px", py: "10px", textAlign: "left", backgroundColor: isCurrent ? accent.soft : "transparent", transition: "background 120ms", "&:hover": { backgroundColor: isCurrent ? accent.soft : ink[2] }, "&:focus-visible": { outline: `2px solid ${accent.main}`, outlineOffset: "-2px", backgroundColor: ink[2] } }}
              >
                <Box sx={{ ...dotSx(tone.main), width: "12px", height: "12px", boxShadow: `0 0 0 2px oklch(17% 0.009 250)` }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: "8px", mb: "2px" }}>
                    <Box component="span" sx={{ ...monoSx, fontSize: "13px", color: isCurrent ? accent.main : fg[1], letterSpacing: "0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {branch.name}
                    </Box>
                    <Box component="span" sx={{ ...monoSx, fontSize: "9px", letterSpacing: "0.14em", px: "5px", py: "1px", borderRadius: "3px", backgroundColor: accent.soft, color: accent.main, border: `1px solid ${accent.line}` }}>
                      HEAD
                    </Box>
                    {branch.isArchived && (
                      <Box component="span" sx={{ ...monoSx, fontSize: "9px", letterSpacing: "0.12em", px: "5px", py: "1px", borderRadius: "3px", textTransform: "uppercase", backgroundColor: ink[2], color: fg[4], border: `1px solid ${line[1]}` }}>
                        {t("resume.compare.refpicker.statusArchived")}
                      </Box>
                    )}
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11.5px", minWidth: 0 }}>
                    {headCommit && (
                      <>
                        <Box component="span" sx={{ ...monoSx, fontSize: "10.5px", color: fg[4], flexShrink: 0 }}>@{shortId(headCommit.id)}</Box>
                        <Box component="span" sx={{ color: fg[3], overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{headCommit.title}</Box>
                      </>
                    )}
                  </Box>
                </Box>
                <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "2px", ...monoSx, fontSize: "10.5px", color: fg[4], flexShrink: 0 }}>
                  <Box component="span" sx={{ color: fg[3] }}>{branchCommits.length} {t("resume.compare.refpicker.commitCount", { count: branchCommits.length })}</Box>
                  {branch.createdAt && <Box component="span">{relativeTime(branch.createdAt, t)}</Box>}
                </Box>
              </ButtonBase>
            </Box>

            {/* Expanded commit list */}
            {isExpanded && branchCommits.length > 0 && (
              <Box
                component="ul"
                onKeyDown={(e) => {
                  if (e.key === "ArrowLeft") {
                    e.preventDefault();
                    e.stopPropagation();
                    setExpanded((prev) => {
                      const next = new Set(prev);
                      next.delete(branch.id);
                      return next;
                    });
                    const btn = document.querySelector<HTMLElement>(`[data-branch-pick-id="${branch.id}"]`);
                    btn?.focus();
                  }
                }}
                sx={{ listStyle: "none", m: 0, py: "2px", pl: "40px", pr: 0, pb: "8px", backgroundColor: ink[0], borderTop: `1px solid ${line[1]}` }}
              >
                {branchCommits.map((c, ci) => (
                  <Box component="li" key={c.id}>
                    <CommitRow
                      commit={c}
                      isHead={ci === 0}
                      isSelected={currentValue === c.id}
                      laneColor={tone.main}
                      isFirst={ci === 0}
                      isLast={ci === branchCommits.length - 1}
                      onPick={onPick}
                      t={t}
                    />
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
}

// ── CommitsTab ────────────────────────────────────────────────────────────────

interface CommitsTabProps {
  branches: CompareRefBranchOption[];
  commits: CompareRefCommitOption[];
  currentValue: string;
  query: string;
  onPick: (ref: string) => void;
  t: TFunction;
}

function CommitsTab({ branches, commits, currentValue, query, onPick, t }: CommitsTabProps) {
  const q = query.trim().toLowerCase();
  const visible = commits.filter(
    (c) => !q || (c.title ?? "").toLowerCase().includes(q) || c.id.toLowerCase().includes(q),
  );

  if (visible.length === 0) {
    return (
      <Box sx={{ py: "24px", px: "16px", textAlign: "center", color: fg[5], fontSize: "12.5px", ...monoSx }}>
        {t("resume.compare.refpicker.noResults", { query })}
      </Box>
    );
  }

  return (
    <Box>
      {visible.map((commit, i) => {
        const branchIndex = branches.findIndex((b) => b.headCommitId === commit.id);
        const bi = branchIndex > -1 ? branchIndex : 0;
        const tone = toneFor(bi);
        const isHead = branchIndex > -1;
        const branch = isHead ? branches[bi]! : null;

        return (
          <Box key={commit.id} sx={{ borderBottom: `1px solid ${line[1]}`, "&:last-child": { borderBottom: 0 } }}>
            <ButtonBase
              data-nav-item
              onClick={() => onPick(commit.id)}
              sx={{ width: "100%", display: "grid", gridTemplateColumns: "20px 48px auto 1fr auto auto", alignItems: "center", gap: "10px", px: "16px", py: "7px", textAlign: "left", fontSize: "12px", color: fg[2], backgroundColor: currentValue === commit.id ? accent.soft : "transparent", transition: "background 120ms", "&:hover": { backgroundColor: currentValue === commit.id ? accent.soft : ink[2] }, "&:focus-visible": { outline: `2px solid ${accent.main}`, outlineOffset: "-2px", backgroundColor: ink[2] } }}
            >
              <Box sx={{ position: "relative", height: "28px", width: "20px", display: "grid", placeItems: "center" }}>
                <Box sx={{ position: "absolute", left: "50%", top: i === 0 ? "50%" : 0, bottom: i === visible.length - 1 ? "50%" : 0, width: "2px", ml: "-1px", backgroundColor: tone.main, opacity: 0.5 }} />
                <Box sx={{ position: "relative", width: "9px", height: "9px", borderRadius: "50%", backgroundColor: tone.main, boxShadow: `0 0 0 2px ${ink[0]}` }} />
              </Box>
              <Box component="span" sx={{ ...monoSx, fontSize: "10.5px", color: fg[4], letterSpacing: "0.02em" }}>{shortId(commit.id)}</Box>
              {branch && (
                <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: "5px", px: "7px", py: "1px", ...monoSx, fontSize: "10px", backgroundColor: ink[2], border: `1px solid ${line[1]}`, borderRadius: "999px", color: tone.main, letterSpacing: "0.02em", flexShrink: 0 }}>
                  <Box component="span" sx={{ width: "7px", height: "7px", borderRadius: "50%", backgroundColor: tone.main, flexShrink: 0 }} />
                  {branch.name}
                </Box>
              )}
              <Box component="span" sx={{ color: currentValue === commit.id ? accent.main : fg[2], overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, display: "flex", alignItems: "center", gap: "6px" }}>
                {isHead && <Box component="span" sx={{ color: accent.main, fontSize: "8px" }}>●</Box>}
                {commit.title ?? shortId(commit.id)}
              </Box>
              <Box component="span" sx={{ ...monoSx, fontSize: "10px", color: fg[5], whiteSpace: "nowrap" }}>{commit.createdBy ?? ""}</Box>
              <Box component="span" sx={{ ...monoSx, fontSize: "10px", color: fg[4], whiteSpace: "nowrap" }}>{relativeTime(commit.createdAt, t)}</Box>
            </ButtonBase>
          </Box>
        );
      })}
    </Box>
  );
}

// ── RecentTab ─────────────────────────────────────────────────────────────────

interface RecentTabProps {
  recentValues: string[];
  branches: CompareRefBranchOption[];
  commits: CompareRefCommitOption[];
  currentValue: string;
  onPick: (ref: string) => void;
  t: TFunction;
}

function RecentTab({ recentValues, branches, commits, currentValue, onPick, t }: RecentTabProps) {
  if (recentValues.length === 0) {
    return (
      <Box sx={{ py: "24px", px: "16px", textAlign: "center", color: fg[5], fontSize: "12.5px", ...monoSx }}>
        {t("resume.compare.refpicker.noRecent")}
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ ...monoSx, fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.14em", color: fg[5], px: "16px", pt: "10px", pb: "4px" }}>
        {t("resume.compare.refpicker.recentLabel")}
      </Box>
      {recentValues.map((ref) => {
        const resolved = resolveRef(ref, branches, commits);
        if (!resolved) return null;
        const tone = toneFor(resolved.branchIndex);
        const commit = resolved.commit;
        const isSelected = currentValue === ref;

        return (
          <ButtonBase
            data-nav-item
            key={ref}
            onClick={() => onPick(ref)}
            sx={{ width: "100%", display: "flex", alignItems: "center", gap: "12px", px: "16px", py: "10px", textAlign: "left", borderBottom: `1px solid ${line[1]}`, transition: "background 120ms", backgroundColor: isSelected ? accent.soft : "transparent", "&:hover": { backgroundColor: isSelected ? accent.soft : ink[2] }, "&:last-of-type": { borderBottom: 0 }, "&:focus-visible": { outline: `2px solid ${accent.main}`, outlineOffset: "-2px", backgroundColor: ink[2] } }}
          >
            <Box sx={dotSx(tone.main)} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: "8px", mb: "2px" }}>
                <Box component="span" sx={{ ...monoSx, fontSize: "12px", color: fg[1] }}>
                  {resolved.kind === "branch" ? resolved.branch.name : (commit ? shortId(commit.id) : ref)}
                </Box>
                {resolved.kind === "branch" ? (
                  <Box component="span" sx={{ ...monoSx, fontSize: "9px", letterSpacing: "0.14em", px: "5px", py: "1px", borderRadius: "3px", backgroundColor: accent.soft, color: accent.main, border: `1px solid ${accent.line}` }}>HEAD</Box>
                ) : commit ? (
                  <Box component="span" sx={{ ...monoSx, fontSize: "10.5px", color: fg[4] }}>@{shortId(commit.id)}</Box>
                ) : null}
              </Box>
              {commit && <Box sx={{ fontSize: "11.5px", color: fg[3], overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{commit.title}</Box>}
            </Box>
            {commit?.createdAt && <Box component="span" sx={{ ...monoSx, fontSize: "10.5px", color: fg[4], flexShrink: 0 }}>{relativeTime(commit.createdAt, t)}</Box>}
          </ButtonBase>
        );
      })}
    </Box>
  );
}

// ── RefPickerMenu — the full dropdown ─────────────────────────────────────────

type TabId = "branches" | "commits" | "recent";

interface RefPickerMenuProps {
  open: boolean;
  anchorEl: HTMLElement | null;
  align: "left" | "right";
  currentValue: string;
  branches: CompareRefBranchOption[];
  commits: CompareRefCommitOption[];
  onClose: () => void;
  onPick: (ref: string) => void;
}

function RefPickerMenu({ open, anchorEl, align, currentValue, branches, commits, onClose, onPick }: RefPickerMenuProps) {
  const { t } = useTranslation("common");
  const [tab, setTab] = useState<TabId>("branches");
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [recent, setRecent] = useState<string[]>([...recentRefs]);

  useEffect(() => {
    if (open) {
      setRecent([...recentRefs]);
      setTimeout(() => searchRef.current?.focus(), 40);
    } else {
      setQuery("");
    }
  }, [open]);

  const navItems = useCallback(() =>
    Array.from(bodyRef.current?.querySelectorAll<HTMLElement>("[data-nav-item]") ?? []),
  []);

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      navItems()[0]?.focus();
    }
  }, [navItems]);

  const handleBodyKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = navItems();
    if (items.length === 0) return;
    const idx = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown") {
      (items[idx + 1] ?? items[0])?.focus();
    } else {
      (items[idx - 1] ?? items[items.length - 1])?.focus();
    }
  }, [navItems]);

  const handlePick = useCallback((ref: string) => {
    trackRecent(ref);
    onPick(ref);
    onClose();
  }, [onPick, onClose]);

  const visibleBranches = useMemo(() => branches.filter((b) => !b.isArchived), [branches]);

  const tabs: { id: TabId; labelKey: string; count: number }[] = [
    { id: "branches", labelKey: "resume.compare.refpicker.tabBranches", count: visibleBranches.length },
    { id: "commits",  labelKey: "resume.compare.refpicker.tabCommits",  count: commits.length },
    { id: "recent",   labelKey: "resume.compare.refpicker.tabRecent",   count: recent.length },
  ];

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: "bottom", horizontal: align === "right" ? "right" : "left" }}
      transformOrigin={{ vertical: "top", horizontal: align === "right" ? "right" : "left" }}
      marginThreshold={8}
      slotProps={{
        paper: {
          elevation: 0,
          sx: {
            mt: "6px",
            width: "min(560px, 92vw)",
            maxHeight: "70vh",
            backgroundColor: "oklch(17% 0.009 250)",
            border: `1px solid ${line[2]}`,
            borderRadius: radius.lg,
            boxShadow: "0 20px 60px -20px oklch(0% 0 0 / 0.7), 0 2px 8px oklch(0% 0 0 / 0.4)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            "@keyframes refmenuIn": {
              from: { opacity: 0, transform: "translateY(-4px)" },
              to: { opacity: 1, transform: "translateY(0)" },
            },
            animation: "refmenuIn 140ms ease-out",
          },
        },
      }}
    >
      {/* Search */}
      <Box sx={{ display: "flex", alignItems: "center", gap: "8px", px: "14px", py: "11px", borderBottom: `1px solid ${line[1]}`, backgroundColor: ink[1], color: fg[4] }}>
        <Box component="svg" sx={{ flexShrink: 0, width: "14px", height: "14px" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </Box>
        <InputBase
          inputRef={searchRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          placeholder={t("resume.compare.refpicker.searchPlaceholder")}
          sx={{ flex: 1, "& input": { p: 0, fontSize: "13px", color: fg[1], "::placeholder": { color: fg[5] }, fontFamily: font.ui } }}
        />
        {query && (
          <ButtonBase onClick={() => setQuery("")} aria-label={t("resume.compare.refpicker.clearSearch")} sx={{ width: "20px", height: "20px", borderRadius: "4px", color: fg[4], fontSize: "16px", display: "grid", placeItems: "center", "&:hover": { backgroundColor: ink[3], color: fg[1] } }}>
            ×
          </ButtonBase>
        )}
      </Box>

      {/* Tabs */}
      <Box sx={{ display: "flex", gap: "2px", px: "8px", pt: "6px", pb: 0, borderBottom: `1px solid ${line[1]}`, backgroundColor: ink[1] }} role="tablist">
        {tabs.map(({ id, labelKey, count }) => (
          <ButtonBase
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            sx={{ px: "12px", pt: "7px", pb: "9px", fontSize: "12px", color: tab === id ? fg[1] : fg[4], display: "inline-flex", alignItems: "center", gap: "6px", position: "relative", borderRadius: "6px 6px 0 0", transition: "color 120ms", "&:hover": { color: fg[2] }, ...(tab === id ? { "&::after": { content: '""', position: "absolute", left: "8px", right: "8px", bottom: "-1px", height: "2px", backgroundColor: accent.main, borderRadius: "2px 2px 0 0" } } : {}) }}
          >
            {t(labelKey)}
            <Box component="span" sx={{ ...monoSx, fontSize: "9.5px", px: "5px", py: "1px", backgroundColor: tab === id ? accent.soft : ink[2], border: `1px solid ${tab === id ? accent.line : line[1]}`, borderRadius: "999px", color: tab === id ? accent.main : fg[4], letterSpacing: "0.02em" }}>
              {count}
            </Box>
          </ButtonBase>
        ))}
      </Box>

      {/* Body */}
      <Box ref={bodyRef} onKeyDown={handleBodyKeyDown} sx={{ flex: 1, overflowY: "auto", py: "4px" }}>
        {tab === "branches" && (
          <BranchTab branches={visibleBranches} commits={commits} currentValue={currentValue} query={query} onPick={handlePick} t={t} />
        )}
        {tab === "commits" && (
          <CommitsTab branches={branches} commits={commits} currentValue={currentValue} query={query} onPick={handlePick} t={t} />
        )}
        {tab === "recent" && (
          <RecentTab recentValues={recent} branches={branches} commits={commits} currentValue={currentValue} onPick={handlePick} t={t} />
        )}
      </Box>

      {/* Footer */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", px: "14px", py: "8px", borderTop: `1px solid ${line[1]}`, backgroundColor: ink[1], fontSize: "11px", color: fg[5], ...monoSx, letterSpacing: "0.02em" }}>
        <Box component="span" sx={{ display: "flex", alignItems: "center", gap: "4px", flexWrap: "wrap" }}>
          {["↑↓", "⏎", "Esc"].map((key, ki) => (
            <Box key={ki} sx={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
              <Box component="kbd" sx={{ fontFamily: font.mono, fontSize: "10px", px: "5px", py: "1px", mx: "3px", backgroundColor: ink[2], border: `1px solid ${line[1]}`, borderRadius: "4px", color: fg[3] }}>{key}</Box>
              {key === "↑↓" && t("resume.compare.refpicker.footerNav")}
              {key === "⏎" && t("resume.compare.refpicker.footerSelect")}
              {key === "Esc" && t("resume.compare.refpicker.footerClose")}
            </Box>
          ))}
        </Box>
        <Box component="span" sx={{ color: fg[5] }}>
          {tab === "branches" ? t("resume.compare.refpicker.footerHintBranches") : tab === "commits" ? t("resume.compare.refpicker.footerHintCommits") : "—"}
        </Box>
      </Box>
    </Popover>
  );
}

// ── CompareRefPicker — main exported component ────────────────────────────────

export interface CompareRefPickerProps {
  label: string;
  value: string;
  branches: CompareRefBranchOption[];
  commits: CompareRefCommitOption[];
  onSelect: (ref: string) => void;
  align?: "left" | "right";
}

export function CompareRefPicker({
  label,
  value,
  branches,
  commits,
  onSelect,
  align = "left",
}: CompareRefPickerProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  return (
    <>
      <RefChip
        label={label}
        value={value}
        branches={branches}
        commits={commits}
        onOpen={setAnchorEl}
      />
      <RefPickerMenu
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        align={align}
        currentValue={value}
        branches={branches}
        commits={commits}
        onClose={() => setAnchorEl(null)}
        onPick={onSelect}
      />
    </>
  );
}
