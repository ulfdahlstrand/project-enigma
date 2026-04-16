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
import Typography from "@mui/material/Typography";
import { useSkillsEditor } from "../hooks/useSkillsEditor";
import { SkillsAddCategoryForm } from "./SkillsAddCategoryForm";
import { SkillsCategoryBlock } from "./skills/SkillsCategoryBlock";
import { SkillsDeleteCategoryDialog } from "./skills/SkillsDeleteCategoryDialog";
import { SkillsListView } from "./skills/SkillsListView";

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
  branchId: string;
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
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editGroupName, setEditGroupName] = useState("");

  const startEditingGroup = (groupId: string, currentName: string) => {
    setEditingGroupId(groupId);
    setEditGroupName(currentName);
  };

  const stopEditingGroup = () => setEditingGroupId(null);

  const startSorting = (groupId: string, skillIds: string[]) => {
    setSortingGroupId(groupId);
    setDraftSkillOrder((current) => ({ ...current, [groupId]: skillIds }));
  };

  const stopSorting = (groupId: string) => {
    setSortingGroupId(null);
    setDraftSkillOrder((current) => {
      const next = { ...current };
      delete next[groupId];
      return next;
    });
  };

  const handleDrop = (groupId: string, targetSkillId: string, catSkills: SkillRow[]) => {
    if (!draggingSkillId || draggingSkillId === targetSkillId) return;
    const currentOrder = draftSkillOrder[groupId] ?? catSkills.map((candidate) => candidate.id);
    const nextOrder = currentOrder.filter((id) => id !== draggingSkillId);
    const dropIndex = nextOrder.indexOf(targetSkillId);
    nextOrder.splice(dropIndex, 0, draggingSkillId);
    setDraftSkillOrder((current) => ({ ...current, [groupId]: nextOrder }));
  };

  const saveSkillOrder = (groupId: string, catSkills: SkillRow[]) => {
    const nextOrder = draftSkillOrder[groupId] ?? catSkills.map((candidate) => candidate.id);
    void editor.reorderSkills(groupId, nextOrder).then(() => stopSorting(groupId));
  };

  const buildCategoryBlock = (groupId: string, categoryName: string, catSkills: SkillRow[]) => {
    const orderedSkillIds = draftSkillOrder[groupId] ?? catSkills.map((skill) => skill.id);
    const orderedSkills = orderedSkillIds
      .map((skillId) => catSkills.find((skill) => skill.id === skillId))
      .filter((skill): skill is SkillRow => Boolean(skill));

    return (
      <SkillsCategoryBlock
        key={groupId}
        groupId={groupId}
        categoryName={categoryName}
        catSkills={catSkills}
        isSorting={sortingGroupId === groupId}
        isEditingGroup={editingGroupId === groupId}
        editingSkillId={editor.editingSkillId}
        editName={editor.editName}
        addingToCategory={editor.addingToCategory}
        newSkillName={editor.newSkillName}
        editGroupName={editGroupName}
        draggingSkillId={draggingSkillId}
        orderedSkills={orderedSkills}
        isReordering={editor.isReordering}
        updateMutation={editor.updateMutation}
        addMutation={editor.addMutation}
        deleteMutation={editor.deleteMutation}
        updateGroupMutation={editor.updateGroupMutation}
        onEditGroupNameChange={setEditGroupName}
        onEditNameChange={editor.setEditName}
        onNewSkillNameChange={editor.setNewSkillName}
        onCommitEdit={editor.commitEdit}
        onCancelEdit={() => editor.setEditingSkillId(null)}
        onStartAddingToCategory={editor.startAddingToCategory}
        onCancelAdding={() => editor.setAddingToCategory(null)}
        onCommitAddToCategory={editor.commitAddToCategory}
        onStartEditing={editor.startEditing}
        onStartEditingGroup={startEditingGroup}
        onStopEditingGroup={stopEditingGroup}
        onStartConfirmDelete={setConfirmDeleteGroupId}
        onStartSorting={startSorting}
        onStopSorting={stopSorting}
        onDragStart={setDraggingSkillId}
        onDragEnd={() => setDraggingSkillId(null)}
        onDrop={(targetSkillId) => handleDrop(groupId, targetSkillId, catSkills)}
        onSaveSkillOrder={() => saveSkillOrder(groupId, catSkills)}
      />
    );
  };

  if (editor.view === "list") {
    return (
      <>
        <SkillsListView
          sortedCategories={editor.sortedCategories}
          isReordering={editor.isReordering}
          editingGroupId={editingGroupId}
          editGroupName={editGroupName}
          updateGroupMutation={editor.updateGroupMutation}
          addingCategory={editor.addingCategory}
          newCategoryName={editor.newCategoryName}
          newCategorySkillName={editor.newCategorySkillName}
          addMutationPending={editor.addMutation.isPending}
          onEditGroupNameChange={setEditGroupName}
          onStartEditingGroup={startEditingGroup}
          onStopEditingGroup={stopEditingGroup}
          onStartConfirmDelete={setConfirmDeleteGroupId}
          onMoveCategory={(index, direction) => void editor.handleMoveCategory(index, direction)}
          onCategoryNameChange={editor.setNewCategoryName}
          onSkillNameChange={editor.setNewCategorySkillName}
          onCommitAddCategory={editor.commitAddCategory}
          onCancelAddCategory={() => editor.setAddingCategory(false)}
          onStartAddingCategory={() => {
            editor.setAddingCategory(true);
            editor.setNewCategoryName("");
            editor.setNewCategorySkillName("");
          }}
        />
        <SkillsDeleteCategoryDialog
          open={confirmDeleteGroupId !== null}
          isDeleting={editor.deleteGroupMutation.isPending}
          onCancel={() => setConfirmDeleteGroupId(null)}
          onConfirm={() => {
            if (!confirmDeleteGroupId) return;
            editor.deleteGroupMutation.mutate(confirmDeleteGroupId, {
              onSuccess: () => setConfirmDeleteGroupId(null),
            });
          }}
        />
      </>
    );
  }

  return (
    <Box sx={{ position: "relative" }}>
      {skills.length === 0 && !editor.addingCategory ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t("resume.detail.noSkills")}
        </Typography>
      ) : (
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3, alignItems: "start", mb: 2 }}>
          <Box sx={{ minWidth: 0 }}>
            {editor.leftCategories.map((group) =>
              buildCategoryBlock(group.id, group.category, group.skills),
            )}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            {editor.rightCategories.map((group) =>
              buildCategoryBlock(group.id, group.category, group.skills),
            )}
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
        onStartAdding={() => {
          editor.setAddingCategory(true);
          editor.setNewCategoryName("");
          editor.setNewCategorySkillName("");
        }}
      />
      <SkillsDeleteCategoryDialog
        open={confirmDeleteGroupId !== null}
        isDeleting={editor.deleteGroupMutation.isPending}
        onCancel={() => setConfirmDeleteGroupId(null)}
        onConfirm={() => {
          if (!confirmDeleteGroupId) return;
          editor.deleteGroupMutation.mutate(confirmDeleteGroupId, {
            onSuccess: () => setConfirmDeleteGroupId(null),
          });
        }}
      />
    </Box>
  );
}
