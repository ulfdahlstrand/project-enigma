export function toQuarter(d: Date | string): string {
  const date = d instanceof Date ? d : new Date(d);
  return `Q${Math.ceil((date.getMonth() + 1) / 3)} ${date.getFullYear()}`;
}

export function sortAssignments<T>(
  assignments: T[],
  isCurrent: (a: T) => boolean,
  startDate: (a: T) => string | Date | null | undefined
): T[] {
  const toStr = (d: string | Date | null | undefined): string => {
    if (!d) return "";
    return d instanceof Date ? d.toISOString() : d;
  };
  return [...assignments].sort((a, b) => {
    if (isCurrent(a) !== isCurrent(b)) return isCurrent(a) ? -1 : 1;
    return toStr(startDate(b)).localeCompare(toStr(startDate(a)));
  });
}
