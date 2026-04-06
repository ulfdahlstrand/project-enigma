import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../orpc-client";
import type { SkillGroupRow, SkillRow } from "../components/SkillsEditor";

type SkillCategoryRow = {
  id: string;
  category: string;
  sortOrder: number;
  skills: SkillRow[];
};

export function getNextSkillSortOrder(groups: SkillCategoryRow[], groupId: string): number {
  const group = groups.find((candidate) => candidate.id === groupId);
  if (!group) {
    const maxSortOrder = groups.flatMap((candidate) => candidate.skills).reduce(
      (max, skill) => Math.max(max, skill.sortOrder),
      -1,
    );
    return maxSortOrder + 1;
  }

  return group.skills.reduce((max, skill) => Math.max(max, skill.sortOrder), -1) + 1;
}

function buildSkillGroups(skillGroups: SkillGroupRow[], skills: SkillRow[]): SkillCategoryRow[] {
  const groups = new Map<string, SkillCategoryRow>();

  for (const group of skillGroups) {
    groups.set(group.id, {
      id: group.id,
      category: group.name.trim(),
      sortOrder: group.sortOrder,
      skills: [],
    });
  }

  for (const skill of skills) {
    const existing = groups.get(skill.groupId);
    if (existing) {
      existing.skills.push(skill);
      existing.category = skill.category?.trim() || existing.category;
      continue;
    }

    groups.set(skill.groupId, {
      id: skill.groupId,
      category: skill.category?.trim() || "",
      sortOrder: Number.MAX_SAFE_INTEGER,
      skills: [skill],
    });
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      skills: [...group.skills].sort((a, b) => a.sortOrder - b.sortOrder),
    }))
    .sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      if (a.category === "") return 1;
      if (b.category === "") return -1;
      return a.category.localeCompare(b.category);
    });
}

interface UseSkillsEditorParams {
  resumeId: string;
  skillGroups: SkillGroupRow[];
  skills: SkillRow[];
  queryKey: readonly unknown[];
}

export function useSkillsEditor({ resumeId, skillGroups, skills, queryKey }: UseSkillsEditorParams) {
  const queryClient = useQueryClient();

  const [view, setView] = useState<"detail" | "list">("detail");
  const [editingSkillId, setEditingSkillId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [addingToCategory, setAddingToCategory] = useState<string | null>(null);
  const [newSkillName, setNewSkillName] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategorySkillName, setNewCategorySkillName] = useState("");
  const [isReordering, setIsReordering] = useState(false);

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey }),
      queryClient.invalidateQueries({ queryKey: ["getResume", resumeId] }),
    ]);
  };

  const updateMutation = useMutation({
    mutationFn: ({ id, name, sortOrder, groupId }: {
      id: string;
      name?: string;
      sortOrder?: number;
      groupId?: string;
    }) => orpc.updateResumeSkill({ id, name, sortOrder, groupId }),
    onSuccess: async () => {
      setEditingSkillId(null);
      await invalidate();
    },
  });

  const updateGroupMutation = useMutation({
    mutationFn: ({ id, name, sortOrder }: { id: string; name?: string; sortOrder?: number }) =>
      orpc.updateResumeSkillGroup({ id, name, sortOrder }),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => orpc.deleteResumeSkill({ id }),
    onSuccess: invalidate,
  });

  const addMutation = useMutation({
    mutationFn: ({ name, groupId, sortOrder }: { name: string; groupId: string; sortOrder?: number }) =>
      orpc.createResumeSkill({ resumeId, groupId, name, sortOrder }),
    onSuccess: async () => {
      setAddingToCategory(null);
      setNewSkillName("");
      setAddingCategory(false);
      setNewCategoryName("");
      setNewCategorySkillName("");
      await invalidate();
    },
  });

  const addGroupMutation = useMutation({
    mutationFn: ({ name, sortOrder }: { name: string; sortOrder: number }) =>
      orpc.createResumeSkillGroup({ resumeId, name, sortOrder }),
    onSuccess: invalidate,
  });

  const sortedCategories = buildSkillGroups(skillGroups, skills);
  const mid = Math.ceil(sortedCategories.length / 2);
  const leftCategories = sortedCategories.slice(0, mid);
  const rightCategories = sortedCategories.slice(mid);

  const startEditing = (skill: SkillRow) => {
    setEditingSkillId(skill.id);
    setEditName(skill.name);
  };

  const commitEdit = (id: string) => {
    if (editName.trim()) updateMutation.mutate({ id, name: editName.trim() });
  };

  const startAddingToCategory = (groupId: string) => {
    setAddingToCategory(groupId);
    setNewSkillName("");
  };

  const commitAddToCategory = (groupId: string) => {
    if (!newSkillName.trim()) return;
    addMutation.mutate({
      name: newSkillName.trim(),
      groupId,
      sortOrder: getNextSkillSortOrder(sortedCategories, groupId),
    });
  };

  const commitAddCategory = async () => {
    if (!newCategoryName.trim() || !newCategorySkillName.trim()) return;

    const nextGroupSortOrder = sortedCategories.reduce(
      (max, group) => Math.max(max, group.sortOrder),
      -1,
    ) + 1;

    const group = await addGroupMutation.mutateAsync({
      name: newCategoryName.trim(),
      sortOrder: nextGroupSortOrder,
    });

    addMutation.mutate({
      name: newCategorySkillName.trim(),
      groupId: group.id,
      sortOrder: 0,
    });
  };

  const handleMoveCategory = async (index: number, direction: "up" | "down") => {
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= sortedCategories.length) return;

    const reordered = [...sortedCategories];
    const temp = reordered[index]!;
    reordered[index] = reordered[swapIndex]!;
    reordered[swapIndex] = temp;

    setIsReordering(true);
    try {
      await Promise.all(
        reordered.map((group, groupIndex) =>
          orpc.updateResumeSkillGroup({ id: group.id, sortOrder: groupIndex }),
        ),
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
    updateMutation, updateGroupMutation, deleteMutation, addMutation, addGroupMutation,
    sortedCategories, leftCategories, rightCategories,
    startEditing, commitEdit,
    startAddingToCategory, commitAddToCategory, commitAddCategory,
    handleMoveCategory,
  };
}
