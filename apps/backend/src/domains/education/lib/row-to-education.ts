export function rowToEducation(row: {
  id: string;
  employee_id: string;
  type: string;
  value: string;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}) {
  return {
    id: row.id,
    employeeId: row.employee_id,
    type: row.type as "degree" | "certification" | "language",
    value: row.value,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
