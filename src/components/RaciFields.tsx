"use client";

import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { UserCombobox } from "@/components/ui/user-combobox";
import { personLabel, useAssignablePeople } from "@/hooks/use-assignable-people";
import {
  RACI_ROLE_HINTS,
  RACI_ROLE_LABELS,
  type GoalLevel,
  type RaciAssignment,
  type RaciRole,
} from "@/types";
import { X } from "lucide-react";

/**
 * "full": department goals, RACI plus the Executive Sponsor.
 * "raci": annual priorities, RACI without a sponsor.
 * "owner": individual goals, one owner.
 * "assignees": rocks, an owner plus anyone else doing the work.
 */
export type PeopleFieldsMode = "full" | "raci" | "owner" | "assignees";

export function peopleModeForGoal(level: GoalLevel): PeopleFieldsMode {
  if (level === "department") return "full";
  if (level === "annual") return "raci";
  return "owner";
}

interface RaciFieldsProps {
  value: RaciAssignment;
  onChange: (next: RaciAssignment) => void;
  mode?: PeopleFieldsMode;
  className?: string;
}

type MultiRole = Extract<RaciRole, "responsible" | "consulted" | "informed">;

const MULTI_FIELDS: Record<MultiRole, keyof RaciAssignment> = {
  responsible: "contributorIds",
  consulted: "consultedIds",
  informed: "informedIds",
};

const MULTI_ORDER: MultiRole[] = ["responsible", "consulted", "informed"];

/**
 * People pickers shared by goals and rocks. Everyone named here can edit the
 * record, which matches `canWriteGoal` in firestore.rules. ClickUp members
 * who have never signed in can be picked too.
 */
export function RaciFields({ value, onChange, mode = "full", className }: RaciFieldsProps) {
  const { people } = useAssignablePeople();
  const isRaci = mode === "full" || mode === "raci";
  const multiRoles: MultiRole[] = isRaci ? MULTI_ORDER : mode === "assignees" ? ["responsible"] : [];

  const idsFor = (role: MultiRole): string[] =>
    (value[MULTI_FIELDS[role]] as string[] | undefined) ?? [];

  // In RACI one person may hold several roles, Accountable included. A rock's
  // owner is not also listed as working on it.
  const ownerExcluded = !isRaci;

  const handleAccountableChange = (userId: string) => {
    onChange({
      ...value,
      ...(ownerExcluded && userId
        ? { contributorIds: (value.contributorIds ?? []).filter((id) => id !== userId) }
        : {}),
      ownerId: userId,
      ownerName: userId ? personLabel(people, userId) : "",
    });
  };

  const addTo = (role: MultiRole, userId: string) => {
    if (!userId || (ownerExcluded && userId === value.ownerId)) return;
    if (idsFor(role).includes(userId)) return;
    onChange({ ...value, [MULTI_FIELDS[role]]: [...idsFor(role), userId] });
  };

  const removeFrom = (role: MultiRole, userId: string) => {
    const field = MULTI_FIELDS[role];
    onChange({
      ...value,
      [field]: idsFor(role).filter((id) => id !== userId),
    });
  };

  const heading = isRaci ? "Who is involved (RACI)" : mode === "assignees" ? "Assignees" : "Owner";
  const ownerLabel = isRaci ? RACI_ROLE_LABELS.accountable : "Owner";
  const multiLabel = (role: MultiRole) =>
    mode === "assignees" ? "Also working on it" : RACI_ROLE_LABELS[role];

  return (
    <div className={className}>
      <div className="space-y-4 rounded-md border p-4">
        <div>
          <Label className="text-sm font-medium">{heading}</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Anyone named here can edit this. People marked ClickUp have not signed in yet.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs">{ownerLabel}</Label>
            <UserCombobox
              value={value.ownerId ?? ""}
              onValueChange={handleAccountableChange}
              placeholder={isRaci ? "Who answers for this?" : "Who owns this?"}
              valueMode="id"
              allowCustom={false}
              includeClickUp
            />
            {isRaci && (
              <p className="text-[11px] text-muted-foreground">
                {RACI_ROLE_HINTS.accountable}
              </p>
            )}
          </div>

          {mode === "full" && (
            <div className="space-y-1">
              <Label className="text-xs">{RACI_ROLE_LABELS.sponsor}</Label>
              <UserCombobox
                value={value.executiveSponsorId ?? ""}
                onValueChange={(userId) =>
                  onChange({ ...value, executiveSponsorId: userId })
                }
                placeholder="Select a sponsor"
                valueMode="id"
                allowCustom={false}
                includeClickUp
              />
              <p className="text-[11px] text-muted-foreground">
                {RACI_ROLE_HINTS.sponsor} Not sent to ClickUp.
              </p>
            </div>
          )}
        </div>

        {multiRoles.map((role) => {
          const ids = idsFor(role);
          return (
            <div key={role} className="space-y-1.5">
              <Label className="text-xs">{multiLabel(role)}</Label>
              <UserCombobox
                value=""
                onValueChange={(userId) => addTo(role, userId)}
                placeholder={`Add ${multiLabel(role).toLowerCase()}`}
                valueMode="id"
                allowCustom={false}
                includeClickUp
                excludeIds={ownerExcluded ? [...ids, value.ownerId ?? ""] : ids}
              />
              {ids.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {ids.map((id) => (
                    <Badge key={id} variant="secondary" className="gap-1">
                      {personLabel(people, id)}
                      <button
                        type="button"
                        onClick={() => removeFrom(role, id)}
                        className="hover:text-destructive"
                        aria-label={`Remove ${personLabel(people, id)} from ${multiLabel(role)}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              {isRaci && (
                <p className="text-[11px] text-muted-foreground">
                  {RACI_ROLE_HINTS[role]}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
