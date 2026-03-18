export function rowToAssignment(row: {
  id: string;
  employee_id: string;
  resume_id: string | null;
  client_name: string;
  role: string;
  description: string;
  start_date: Date;
  end_date: Date | null;
  technologies: string[];
  is_current: boolean;
  keywords: string | null;
  type: string | null;
  highlight: boolean;
  created_at: Date;
  updated_at: Date;
}) {
  return {
    id: row.id,
    employeeId: row.employee_id,
    resumeId: row.resume_id,
    clientName: row.client_name,
    role: row.role,
    description: row.description,
    startDate: row.start_date,
    endDate: row.end_date,
    technologies: row.technologies,
    isCurrent: row.is_current,
    keywords: row.keywords,
    type: row.type,
    highlight: row.highlight,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
