export interface Department {
  id: string;
  name: string;
  description?: string;
  leaderId?: string;
  leaderName?: string;
  memberIds?: string[];
  sortOrder?: number;
  companyId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export function departmentName(
  departments: Department[],
  departmentId?: string | null
): string {
  if (!departmentId) return "Unassigned";
  return departments.find((d) => d.id === departmentId)?.name ?? "Unassigned";
}
