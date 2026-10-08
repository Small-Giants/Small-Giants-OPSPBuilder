"use client";

import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { UserCombobox } from "@/components/ui/user-combobox";
import { useActiveUsers } from "@/hooks/use-active-users";
import {
  RACI_ROLE_HINTS,
  RACI_ROLE_LABELS,
  withoutRaciMember,
  type RaciAssignment,
  type RaciRole,
} from "@/types";
import { X } from "lucide-react";

interface RaciFieldsProps {
  value: RaciAssignment;
  onChange: (next: RaciAssignment) => void;
  /** Hidden on rocks, where the sponsor is inherited from the parent goal. */
  showSponsor?: boolean;
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
 * RACI pickers shared by goals and rocks. Everyone named here can edit the
 * record, which matches `canWriteGoal` in firestore.rules.
 */
export function RaciFields({
  value,
  onChange,
  showSponsor = true,
  className,
}: RaciFieldsProps) {
  const { users } = useActiveUsers();

  const userLabel = (userId: string) => {
    const found = users.find((u) => u.id === userId);
    return found?.name || found?.email || userId;
  };

  const idsFor = (role: MultiRole): string[] =>
    (value[MULTI_FIELDS[role]] as string[] | undefined) ?? [];

  const handleAccountableChange = (userId: string) => {
    const owner = users.find((u) => u.id === userId);
    // One role per person, so taking Accountable drops them from the lists.
    onChange({
      ...withoutRaciMember(value, userId),
      ownerId: userId,
      ownerName: owner?.name || owner?.email || "",
    });
  };

  const addTo = (role: MultiRole, userId: string) => {
    if (!userId || userId === value.ownerId) return;
    if (idsFor(role).includes(userId)) return;

    // Clear the person out of every list first so they hold one role only.
    const cleared = withoutRaciMember(value, userId);
    const field = MULTI_FIELDS[role];
    onChange({
      ...cleared,
      [field]: [...((cleared[field] as string[] | undefined) ?? []), userId],
    });
  };

  const removeFrom = (role: MultiRole, userId: string) => {
    const field = MULTI_FIELDS[role];
    onChange({
      ...value,
      [field]: idsFor(role).filter((id) => id !== userId),
    });
  };

  return (
    <div className={className}>
      <div className="space-y-4 rounded-md border p-4">
        <div>
          <Label className="text-sm font-medium">Who is involved (RACI)</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Anyone named here can edit this.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs">{RACI_ROLE_LABELS.accountable}</Label>
            <UserCombobox
              value={value.ownerId ?? ""}
              onValueChange={handleAccountableChange}
              placeholder="Who answers for this?"
              valueMode="id"
            />
            <p className="text-[11px] text-muted-foreground">
              {RACI_ROLE_HINTS.accountable}
            </p>
          </div>

          {showSponsor && (
            <div className="space-y-1">
              <Label className="text-xs">{RACI_ROLE_LABELS.sponsor}</Label>
              <UserCombobox
                value={value.executiveSponsorId ?? ""}
                onValueChange={(userId) =>
                  onChange({ ...value, executiveSponsorId: userId })
                }
                placeholder="Select a sponsor"
                valueMode="id"
              />
              <p className="text-[11px] text-muted-foreground">
                {RACI_ROLE_HINTS.sponsor}
              </p>
            </div>
          )}
        </div>

        {MULTI_ORDER.map((role) => {
          const ids = idsFor(role);
          return (
            <div key={role} className="space-y-1.5">
              <Label className="text-xs">{RACI_ROLE_LABELS[role]}</Label>
              <UserCombobox
                value=""
                onValueChange={(userId) => addTo(role, userId)}
                placeholder={`Add ${RACI_ROLE_LABELS[role].toLowerCase()}`}
                valueMode="id"
              />
              {ids.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {ids.map((id) => (
                    <Badge key={id} variant="secondary" className="gap-1">
                      {userLabel(id)}
                      <button
                        type="button"
                        onClick={() => removeFrom(role, id)}
                        className="hover:text-destructive"
                        aria-label={`Remove ${userLabel(id)} from ${RACI_ROLE_LABELS[role]}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">
                {RACI_ROLE_HINTS[role]}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
