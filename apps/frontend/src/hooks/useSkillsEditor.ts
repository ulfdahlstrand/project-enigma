import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../orpc-client";
import type { SkillRow } from "../components/SkillsEditor";

// ---------------------------------------------------------------------------
// Sorting helper
// ---------------------------------------------------------------------------

export function sortCategories(grouped: Record<string, SkillRow[]>): [string, SkillRow[]][] {
  return Object.entries(grouped).sort(([a, aSkills], [b, bSkills]) => {
    const minA = Math.min(...aSkills.map((s) => s.sortOrder));
    const minB = Math.min(...bSkills.map((s) => s.sortOrder));
    if (minA !== minB) return minA - minB;
    if (a === "") return 1;
    if (b === "") return -1;
    return a.localeCompare(b);
  });
}

export function getNextSkillSortOrder(
  sortedCategories: [string, SkillRow[]][],
  category: string,
): number {
  const categoryIndex = sortedCategories.findIndex(([name]) => name === category);

  if (categoryIndex === -1) {
    const maxSortOrder = sortedCategories.flatMap(([, skills]) => skills).reduce(
      (max, skill) => Math.max(max, skill.sortOrder),
      -1,
    );
    return Math.max(maxSortOrder + 1, sortedCategories.length * 1000);
  }

  const categorySkills = sortedCategories[categoryIndex]![1];
  const maxSortOrderInCategory = categorySkills.reduce(
    (max, skill) => Math.max(max, skill.sortOrder),
    -1,
  );
  return Math.max(maxSortOrderInCategory + 1, categoryIndex * 1000 + categorySkills.length);
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

interface UseSkillsEditorParams {
  resumeId: string;
  skills: SkillRow[];
  queryKey: readonly unknown[];
}

export function useSkillsEditor({ resumeId, skills, queryKey }: UseSkillsEditorParams) {
  const queryClient = useQueryClient();

  const [view, setView] = useState<"detail" | "list">("detail");

  // Inline skill name edit (detail view)
  const [editingSkillId, setEditingSkillId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  // Add skill to an existing category
  const [addingToCategory, setAddingToCategory] = useState<string | null>(null);
  const [newSkillName, setNewSkillName] = useState("");

  // Add a brand-new category
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategorySkillName, setNewCategorySkillName] = useState("");

  // Reorder pending state (list view)
  const [isReordering, setIsReordering] = useState(false);

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const updateMutation = useMutation({
    mutationFn: ({ id, name, sortOrder }: { id: string; name?: string; sortOrder?: number }) =>
      orpc.updateResumeSkill({ id, name, sortOrder }),
    onSuccess: async () => {
      setEditingSkillId(null);
      await invalidate();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => orpc.deleteResumeSkill({ id }),
    onSuccess: invalidate,
  });

  const addMutation = useMutation({
    mutationFn: ({
      name,
      category,
      sortOrder,
    }: {
      name: string;
      category: string | null;
      sortOrder?: number;
    }) => orpc.createResumeSkill({ resumeId, name, category, sortOrder }),
    onSuccess: async () => {
      setAddingToCategory(null);
      setNewSkillName("");
      setAddingCategory(false);
      setNewCategoryName("");
      setNewCategorySkillName("");
      await invalidate();
    },
  });

  // Derived data
  const grouped = skills.reduce<Record<string, SkillRow[]>>((acc, skill) => {
    const key = skill.category?.trim() || "";
    return { ...acc, [key]: [...(acc[key] ?? []), skill] };
  }, {});

  const sortedCategories = sortCategories(grouped);
  const mid = Math.ceil(sortedCategories.length / 2);
  const leftCategories = sortedCategories.slice(0, mid);
  const rightCategories = sortedCategories.slice(mid);

  // Handlers
  const startEditing = (skill: SkillRow) => {
    setEditingSkillId(skill.id);
    setEditName(skill.name);
  };

  const commitEdit = (id: string) => {
    if (editName.trim()) updateMutation.mutate({ id, name: editName.trim() });
  };

  const startAddingToCategory = (cat: string) => {
    setAddingToCategory(cat);
    setNewSkillName("");
  };

  const commitAddToCategory = (cat: string) => {
    if (!newSkillName.trim()) return;
    addMutation.mutate({
      name: newSkillName.trim(),
      category: cat || null,
      sortOrder: getNextSkillSortOrder(sortedCategories, cat),
    });
  };

  const commitAddCategory = () => {
    if (!newCategoryName.trim() || !newCategorySkillName.trim()) return;
    addMutation.mutate({
      name: newCategorySkillName.trim(),
      category: newCategoryName.trim(),
      sortOrder: getNextSkillSortOrder(sortedCategories, newCategoryName.trim()),
    });
  };

  const handleMoveCategory = async (index: number, direction: "up" | "down") => {
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= sortedCategories.length) return;

    const reordered = [...sortedCategories];
    const temp = reordered[index]!;
    reordered[index] = reordered[swapIndex]!;
    reordered[swapIndex] = temp;

    const updates: { id: string; sortOrder: number }[] = [];
    reordered.forEach(([, catSkills], catIndex) => {
      catSkills.forEach((skill, skillIndex) => {
        updates.push({ id: skill.id, sortOrder: catIndex * 1000 + skillIndex });
      });
    });

    setIsReordering(true);
    try {
      await Promise.all(
        updates.map(({ id, sortOrder }) => orpc.updateResumeSkill({ id, sortOrder }))
      );
      await invalidate();
    } finally {
      setIsReordering(false);
    }
  };

  return {
    view, setView,
    editingSkillId, setEditingSkillId,
    editName, setEditName,
    addingToCategory, setAddingToCategory,
    newSkillName, setNewSkillName,
    addingCategory, setAddingCategory,
    newCategoryName, setNewCategoryName,
    newCategorySkillName, setNewCategorySkillName,
    isReordering,
    updateMutation, deleteMutation, addMutation,
    sortedCategories, leftCategories, rightCategories,
    startEditing, commitEdit,
    startAddingToCategory, commitAddToCategory, commitAddCategory,
    handleMoveCategory,
  };
}
