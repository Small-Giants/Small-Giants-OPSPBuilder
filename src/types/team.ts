export interface Team {
  id: string;
  name: string;
  description?: string;
  /** Every leader. A team can have more than one. */
  leaderIds?: string[];
  sortOrder?: number;
  companyId?: string;
  createdAt?: string;
  updatedAt?: string;
  /** Pre-array single leader. Read for older documents, never written. */
  leaderId?: string;
  leaderName?: string;
}

/** The leaders of a team, falling back to the single legacy field. */
export function teamLeaderIds(
  team: Pick<Team, "leaderIds" | "leaderId"> | undefined
): string[] {
  if (!team) return [];
  const ids = team.leaderIds ?? [];
  if (ids.length > 0) return ids;
  return team.leaderId ? [team.leaderId] : [];
}

export function teamName(
  teams: Team[],
  teamId?: string | null
): string {
  if (!teamId) return "Unassigned";
  return teams.find((d) => d.id === teamId)?.name ?? "Unassigned";
}
