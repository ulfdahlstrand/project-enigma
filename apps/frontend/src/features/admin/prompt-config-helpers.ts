export function orderPromptFragmentsForDisplay<
  T extends { key: string; sortOrder: number }
>(fragments: T[]): T[] {
  const priority = (key: string) => {
    if (key === "kickoff_message") return 0;
    if (key === "system_template") return 1;
    return 2;
  };

  return [...fragments].sort((a, b) => {
    const priorityDiff = priority(a.key) - priority(b.key);
    return priorityDiff !== 0 ? priorityDiff : a.sortOrder - b.sortOrder;
  });
}
