/**
 * SkillsEditor — editable skills page with drag-and-drop reordering via
 * @dnd-kit. Skills are draggable chips (reordered within their category)
 * and each category header is a drag handle (reordered across categories).
 *
 * Styling: MUI sx prop only
 * i18n: useTranslation("common")
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useSkillsEditor } from "../hooks/useSkillsEditor";
import { SkillsAddCategoryForm } from "./SkillsAddCategoryForm";
import { SkillsCategoryBlock } from "./skills/SkillsCategoryBlock";
import { SkillsDeleteCategoryDialog } from "./skills/SkillsDeleteCategoryDialog";

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
  addingCategory?: boolean;
  onAddingCategoryChange?: (open: boolean) => void;
}

export function SkillsEditor({
  resumeId,
  branchId,
  skillGroups,
  skills,
  queryKey,
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
    addingCategory: externalAddingCategory,
    onAddingCategoryChange,
  });
  const [confirmDeleteGroupId, setConfirmDeleteGroupId] = useState<string | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editGroupName, setEditGroupName] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const startEditingGroup = (groupId: string, currentName: string) => {
    setEditingGroupId(groupId);
    setEditGroupName(currentName);
  };

  const stopEditingGroup = () => setEditingGroupId(null);

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const activeId = String(active.id);
    const overId = String(over.id);

    if (activeId.startsWith("group:") && overId.startsWith("group:")) {
      const fromIndex = editor.sortedCategories.findIndex(
        (group) => `group:${group.id}` === activeId,
      );
      const toIndex = editor.sortedCategories.findIndex(
        (group) => `group:${group.id}` === overId,
      );
      if (fromIndex === -1 || toIndex === -1) return;
      const direction = toIndex > fromIndex ? "down" : "up";
      const steps = Math.abs(toIndex - fromIndex);
      void moveCategoryStepwise(fromIndex, direction, steps);
      return;
    }

    // Skill-level drop: find which category owns both skills
    const group = editor.sortedCategories.find((candidate) =>
      candidate.skills.some((skill) => skill.id === activeId) &&
      candidate.skills.some((skill) => skill.id === overId),
    );
    if (!group) return;

    const currentOrder = group.skills.map((skill) => skill.id);
    const fromIndex = currentOrder.indexOf(activeId);
    const toIndex = currentOrder.indexOf(overId);
    if (fromIndex === -1 || toIndex === -1) return;

    const nextOrder = [...currentOrder];
    nextOrder.splice(fromIndex, 1);
    nextOrder.splice(toIndex, 0, activeId);
    void editor.reorderSkills(group.id, nextOrder);
  };

  const moveCategoryStepwise = async (
    startIndex: number,
    direction: "up" | "down",
    steps: number,
  ) => {
    let index = startIndex;
    for (let step = 0; step < steps; step += 1) {
      await editor.handleMoveCategory(index, direction);
      index = direction === "down" ? index + 1 : index - 1;
    }
  };

  const buildCategoryBlock = (groupId: string, categoryName: string, catSkills: SkillRow[]) => (
    <SkillsCategoryBlock
      key={groupId}
      groupId={groupId}
      categoryName={categoryName}
      catSkills={catSkills}
      isEditingGroup={editingGroupId === groupId}
      editingSkillId={editor.editingSkillId}
      editName={editor.editName}
      addingToCategory={editor.addingToCategory}
      newSkillName={editor.newSkillName}
      editGroupName={editGroupName}
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
    />
  );

  const groupSortableIds = editor.sortedCategories.map((group) => `group:${group.id}`);

  return (
    <Box sx={{ position: "relative" }}>
      {skills.length === 0 && !editor.addingCategory ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t("resume.detail.noSkills")}
        </Typography>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={groupSortableIds} strategy={verticalListSortingStrategy}>
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
          </SortableContext>
        </DndContext>
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
