export interface Department {
  id: string;
  name: string;
  description?: string;
  /** Every leader. A department can have more than one. */
  leaderIds?: string[];
  sortOrder?: number;
  companyId?: string;
  createdAt?: string;
  updatedAt?: string;
  /** Pre-array single leader. Read for older documents, never written. */
  leaderId?: string;
  leaderName?: string;
}

/** The leaders of a department, falling back to the single legacy field. */
export function departmentLeaderIds(
  department: Pick<Department, "leaderIds" | "leaderId"> | undefined
): string[] {
  if (!department) return [];
  const ids = department.leaderIds ?? [];
  if (ids.length > 0) return ids;
  return department.leaderId ? [department.leaderId] : [];
}

export function departmentName(
  departments: Department[],
  departmentId?: string | null
): string {
  if (!departmentId) return "Unassigned";
  return departments.find((d) => d.id === departmentId)?.name ?? "Unassigned";
}
