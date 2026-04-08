/**
 * SkillsEditor — editable version of the skills page, visually matching
 * SkillsPageContent (two-column gray-header category blocks).
 *
 * Toggle between:
 *   - Detail view  (chips + inline add/edit/delete per skill)
 *   - List view    (numbered category list with up/down reordering)
 *
 * Styling: MUI sx prop only
 * i18n: useTranslation("common")
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import SortIcon from "@mui/icons-material/Sort";
import { useSkillsEditor } from "../hooks/useSkillsEditor";
import { SkillsAddCategoryForm } from "./SkillsAddCategoryForm";

export interface SkillRow {
  id: string;
  name: string;
  groupId: string;
  category: string | null;
  sortOrder: number;
}

export interface SkillGroupRow {
  id: string;
  resumeId: string;
  name: string;
  sortOrder: number;
}

interface SkillsEditorProps {
  resumeId: string;
  branchId?: string | null;
  skillGroups: SkillGroupRow[];
  skills: SkillRow[];
  queryKey: readonly unknown[];
  view?: "detail" | "list";
  onViewChange?: (v: "detail" | "list") => void;
  addingCategory?: boolean;
  onAddingCategoryChange?: (open: boolean) => void;
}

export function SkillsEditor({
  resumeId,
  branchId,
  skillGroups,
  skills,
  queryKey,
  view: externalView,
  onViewChange,
  addingCategory: externalAddingCategory,
  onAddingCategoryChange,
}: SkillsEditorProps) {
  const { t } = useTranslation("common");
  const editor = useSkillsEditor({
    resumeId,
    branchId,
    skillGroups,
    skills,
    queryKey,
    view: externalView,
    onViewChange,
    addingCategory: externalAddingCategory,
    onAddingCategoryChange,
  });
  const [sortingGroupId, setSortingGroupId] = useState<string | null>(null);
  const [draggingSkillId, setDraggingSkillId] = useState<string | null>(null);
  const [draftSkillOrder, setDraftSkillOrder] = useState<Record<string, string[]>>({});
  const [confirmDeleteGroupId, setConfirmDeleteGroupId] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const renderSkill = (skill: SkillRow) => {
    if (editor.editingSkillId === skill.id) {
      return (
        <Box key={skill.id} sx={{ display: "flex", gap: 0.5, alignItems: "center", width: "100%", mt: 0.5 }}>
          <TextField
            value={editor.editName}
            onChange={(e) => editor.setEditName(e.target.value)}
            size="small"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") editor.commitEdit(skill.id);
              if (e.key === "Escape") editor.setEditingSkillId(null);
            }}
            sx={{ flex: 1, "& .MuiInputBase-input": { fontSize: "0.75rem", py: 0.5 } }}
          />
          <IconButton
            size="small"
            color="primary"
            onClick={() => editor.commitEdit(skill.id)}
            disabled={!editor.editName.trim() || editor.updateMutation.isPending}
          >
            <CheckIcon sx={{ fontSize: 16 }} />
          </IconButton>
          <IconButton size="small" onClick={() => editor.setEditingSkillId(null)}>
            <CloseIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
      );
    }

    return null;
  };

  const renderAddSkillInput = (groupId: string) => (
    <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", width: "100%", mt: 0.5 }}>
      <TextField
        value={editor.newSkillName}
        onChange={(e) => editor.setNewSkillName(e.target.value)}
        size="small"
        autoFocus
        placeholder={t("resume.edit.skillNameLabel")}
        onKeyDown={(e) => {
          if (e.key === "Enter") editor.commitAddToCategory(groupId);
          if (e.key === "Escape") editor.setAddingToCategory(null);
        }}
        sx={{ flex: 1, "& .MuiInputBase-input": { fontSize: "0.75rem", py: 0.5 } }}
      />
      <IconButton
        size="small"
        color="primary"
        onClick={() => editor.commitAddToCategory(groupId)}
        disabled={!editor.newSkillName.trim() || editor.addMutation.isPending}
      >
        <CheckIcon sx={{ fontSize: 16 }} />
      </IconButton>
      <IconButton size="small" onClick={() => editor.setAddingToCategory(null)}>
        <CloseIcon sx={{ fontSize: 16 }} />
      </IconButton>
    </Box>
  );

  const renderCategoryBlock = (groupId: string, cat: string, catSkills: SkillRow[]) => {
    const isSorting = sortingGroupId === groupId;
    const orderedSkillIds = draftSkillOrder[groupId] ?? catSkills.map((skill) => skill.id);
    const orderedSkills = orderedSkillIds
      .map((skillId: string) => catSkills.find((skill: SkillRow) => skill.id === skillId))
      .filter((skill): skill is SkillRow => Boolean(skill));

    return (
    <Box key={groupId} sx={{ mb: 2.5, minWidth: 0 }}>
      <Box sx={{ bgcolor: "action.hover", px: 1.5, py: 0.75, mb: 1, display: "flex", alignItems: "center", minWidth: 0 }}>
        <Typography
          variant="caption"
          sx={{ fontWeight: 700, letterSpacing: "0.06em", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
        >
          {(cat || t("resume.detail.skillsHeading")).toUpperCase()}
        </Typography>
        <Tooltip title={t("resume.edit.skillAddButton")}>
          <IconButton size="small" onClick={() => editor.startAddingToCategory(groupId)} sx={{ p: 0.25 }}>
            <AddIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title={t("resume.edit.skillDeleteCategoryButton")}>
          <IconButton size="small" onClick={() => setConfirmDeleteGroupId(groupId)} sx={{ p: 0.25 }}>
            <DeleteOutlineIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title={t("resume.edit.skillsSortWithinGroupTooltip")}>
          <IconButton
            size="small"
            onClick={() => {
              if (isSorting) {
                setSortingGroupId(null);
                setDraftSkillOrder((current) => {
                  const next = { ...current };
                  delete next[groupId];
                  return next;
                });
                return;
              }

              setSortingGroupId(groupId);
              setDraftSkillOrder((current) => ({
                ...current,
                [groupId]: catSkills.map((skill) => skill.id),
              }));
            }}
            sx={{ p: 0.25 }}
          >
            <SortIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Box>
      {isSorting ? (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
          {orderedSkills.map((skill) => (
            <Box
              key={skill.id}
              draggable
              onDragStart={() => setDraggingSkillId(skill.id)}
              onDragEnd={() => setDraggingSkillId(null)}
              onDragOver={(event) => {
                event.preventDefault();
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (!draggingSkillId || draggingSkillId === skill.id) return;

                const currentOrder = draftSkillOrder[groupId] ?? catSkills.map((candidate: SkillRow) => candidate.id);
                const nextOrder = currentOrder.filter((id: string) => id !== draggingSkillId);
                const dropIndex = nextOrder.indexOf(skill.id);
                nextOrder.splice(dropIndex, 0, draggingSkillId);
                setDraftSkillOrder((current: Record<string, string[]>) => ({ ...current, [groupId]: nextOrder }));
              }}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                px: 1,
                py: 0.75,
                border: "1px solid",
                borderColor: draggingSkillId === skill.id ? "primary.main" : "divider",
                bgcolor: "background.paper",
                cursor: "grab",
              }}
            >
              <DragIndicatorIcon sx={{ fontSize: 16, color: "text.secondary" }} />
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {skill.name}
              </Typography>
            </Box>
          ))}
          <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, mt: 0.5 }}>
            <Button
              size="small"
              onClick={() => {
                setSortingGroupId(null);
                setDraftSkillOrder((current: Record<string, string[]>) => {
                  const next = { ...current };
                  delete next[groupId];
                  return next;
                });
              }}
            >
              {t("resume.edit.skillCancelButton")}
            </Button>
            <Button
              size="small"
              variant="contained"
              disabled={editor.isReordering}
              onClick={() => {
                const nextOrder = draftSkillOrder[groupId] ?? catSkills.map((candidate: SkillRow) => candidate.id);
                void editor.reorderSkills(groupId, nextOrder).then(() => {
                  setSortingGroupId(null);
                  setDraftSkillOrder((current: Record<string, string[]>) => {
                    const next = { ...current };
                    delete next[groupId];
                    return next;
                  });
                });
              }}
            >
              {t("resume.edit.skillSaveButton")}
            </Button>
          </Box>
        </Box>
      ) : (
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
        {catSkills.map((skill) => {
          if (editor.editingSkillId === skill.id) {
            return renderSkill(skill);
          }

          return (
            <Box key={skill.id} sx={{ display: "flex", alignItems: "center", maxWidth: "100%" }}>
              <Chip
                label={skill.name}
                size="small"
                variant="outlined"
                onClick={() => editor.startEditing(skill)}
                onDelete={() => editor.deleteMutation.mutate(skill.id)}
                sx={{ fontSize: "0.75rem", cursor: "pointer", maxWidth: "100%" }}
              />
            </Box>
          );
        })}
        {editor.addingToCategory === groupId && renderAddSkillInput(groupId)}
      </Box>
      )}
    </Box>
  );
  };

  // ---------------------------------------------------------------------------
  // List view
  // ---------------------------------------------------------------------------

  if (editor.view === "list") {
    return (
      <Box sx={{ position: "relative" }}>
        {editor.isReordering && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 1 }}>
            <CircularProgress size={20} />
          </Box>
        )}
        <Box sx={{ display: "flex", flexDirection: "column" }}>
          {editor.sortedCategories.map((group, index) => (
            <Box key={group.id}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 1, opacity: editor.isReordering ? 0.5 : 1 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, minWidth: 24, color: "text.disabled" }}>
                  {index + 1}
                </Typography>
                <Box sx={{ flex: 1, bgcolor: "action.hover", px: 1.5, py: 0.75, minWidth: 0 }}>
                  <Typography
                    variant="caption"
                    sx={{ fontWeight: 700, letterSpacing: "0.06em", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  >
                    {(group.category || t("resume.detail.skillsHeading")).toUpperCase()}
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
                  {t("resume.edit.skillsCount", { count: group.skills.length })}
                </Typography>
                <Box sx={{ display: "flex" }}>
                  <IconButton
                    size="small"
                    onClick={() => setConfirmDeleteGroupId(group.id)}
                    disabled={editor.isReordering}
                  >
                    <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => void editor.handleMoveCategory(index, "up")}
                    disabled={index === 0 || editor.isReordering}
                  >
                    <ArrowUpwardIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => void editor.handleMoveCategory(index, "down")}
                    disabled={index === editor.sortedCategories.length - 1 || editor.isReordering}
                  >
                    <ArrowDownwardIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Box>
              </Box>
              {index < editor.sortedCategories.length - 1 && <Divider />}
            </Box>
          ))}
        </Box>
        <Box sx={{ mt: 2 }}>
          <SkillsAddCategoryForm
            adding={editor.addingCategory}
            categoryName={editor.newCategoryName}
            skillName={editor.newCategorySkillName}
            isPending={editor.addMutation.isPending}
            onCategoryNameChange={editor.setNewCategoryName}
            onSkillNameChange={editor.setNewCategorySkillName}
            onCommit={editor.commitAddCategory}
            onCancel={() => editor.setAddingCategory(false)}
            onStartAdding={() => { editor.setAddingCategory(true); editor.setNewCategoryName(""); editor.setNewCategorySkillName(""); }}
          />
        </Box>
      </Box>
    );
  }

  // ---------------------------------------------------------------------------
  // Detail view
  // ---------------------------------------------------------------------------

  return (
    <Box sx={{ position: "relative" }}>
      {skills.length === 0 && !editor.addingCategory ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t("resume.detail.noSkills")}
        </Typography>
      ) : (
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3, alignItems: "start", mb: 2 }}>
          <Box sx={{ minWidth: 0 }}>
            {editor.leftCategories.map((group) => renderCategoryBlock(group.id, group.category, group.skills))}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            {editor.rightCategories.map((group) => renderCategoryBlock(group.id, group.category, group.skills))}
          </Box>
        </Box>
      )}
      <SkillsAddCategoryForm
        adding={editor.addingCategory}
        categoryName={editor.newCategoryName}
        skillName={editor.newCategorySkillName}
        isPending={editor.addMutation.isPending}
        onCategoryNameChange={editor.setNewCategoryName}
        onSkillNameChange={editor.setNewCategorySkillName}
        onCommit={editor.commitAddCategory}
        onCancel={() => editor.setAddingCategory(false)}
        onStartAdding={() => { editor.setAddingCategory(true); editor.setNewCategoryName(""); editor.setNewCategorySkillName(""); }}
      />
      <Dialog
        open={confirmDeleteGroupId !== null}
        onClose={() => {
          if (!editor.deleteGroupMutation.isPending) {
            setConfirmDeleteGroupId(null);
          }
        }}
      >
        <DialogTitle>{t("resume.edit.skillDeleteCategoryDialog.title")}</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            {t("resume.edit.skillDeleteCategoryDialog.description")}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setConfirmDeleteGroupId(null)}
            disabled={editor.deleteGroupMutation.isPending}
          >
            {t("resume.edit.skillCancelButton")}
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={confirmDeleteGroupId === null || editor.deleteGroupMutation.isPending}
            onClick={() => {
              if (!confirmDeleteGroupId) return;
              editor.deleteGroupMutation.mutate(confirmDeleteGroupId, {
                onSuccess: () => setConfirmDeleteGroupId(null),
              });
            }}
          >
            {editor.deleteGroupMutation.isPending
              ? t("resume.edit.skillDeleteCategoryDialog.deleting")
              : t("resume.edit.skillDeleteCategoryDialog.confirm")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
