"use client";

import { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { UserCombobox } from "@/components/ui/user-combobox";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { usePlanYear } from "@/contexts/PlanYearContext";
import { useTeams } from "@/hooks/use-teams";
import { useActiveUsers } from "@/hooks/use-active-users";
import { teamLeaderIds } from "@/types";
import { db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import {
  AlertTriangle,
  Building2,
  Loader2,
  PencilIcon,
  PlusIcon,
  Trash2,
  Users,
  XIcon,
} from "lucide-react";

interface TeamForm {
  name: string;
  description: string;
  leaderIds: string[];
  memberIds: string[];
}

const emptyForm: TeamForm = {
  name: "",
  description: "",
  leaderIds: [],
  memberIds: [],
};

export default function TeamManagement() {
  const { toast } = useToast();
  const { hasRole } = useAuth();
  const { companyId } = usePlanYear();
  const { teams, loading } = useTeams();
  const { users } = useActiveUsers();

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TeamForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const isAdmin = hasRole("admin");

  const membersByTeam = useMemo(() => {
    const map = new Map<string, typeof users>();
    users.forEach((user) => {
      if (!user.teamId) return;
      const existing = map.get(user.teamId) ?? [];
      existing.push(user);
      map.set(user.teamId, existing);
    });
    return map;
  }, [users]);

  const unassignedCount = users.filter((u) => !u.teamId).length;

  const userName = (userId?: string) => {
    if (!userId) return null;
    const user = users.find((u) => u.id === userId);
    return user?.name || user?.email || null;
  };

  const resetForm = () => {
    setForm(emptyForm);
    setAdding(false);
    setEditingId(null);
  };

  /**
   * Membership lives on the user document, so assigning people is a write per
   * user rather than a field on the team.
   */
  const applyMembership = async (teamId: string, memberIds: string[]) => {
    const desired = new Set(memberIds);
    const current = new Set(
      (membersByTeam.get(teamId) ?? []).map((m) => m.id)
    );

    const writes: Promise<unknown>[] = [];
    desired.forEach((userId) => {
      if (!current.has(userId)) {
        writes.push(updateDoc(doc(db, "users", userId), { teamId }));
      }
    });
    current.forEach((userId) => {
      if (!desired.has(userId)) {
        writes.push(updateDoc(doc(db, "users", userId), { teamId: "" }));
      }
    });
    await Promise.all(writes);
  };

  /** Leaders are members of the team they lead. */
  const formMemberIds = () =>
    Array.from(new Set([...form.leaderIds, ...form.memberIds]));

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const created = await addDoc(
        collection(db, "companies", companyId, "teams"),
        {
          name: form.name.trim(),
          description: form.description.trim(),
          leaderIds: form.leaderIds,
          sortOrder: teams.length,
          companyId,
          createdAt: new Date().toISOString(),
        }
      );
      await applyMembership(created.id, formMemberIds());
      toast({ title: "Team created", description: form.name.trim() });
      resetForm();
    } catch {
      toast({
        title: "Error",
        description: "Failed to create team.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (teamId: string) => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await updateDoc(
        doc(db, "companies", companyId, "teams", teamId),
        {
          name: form.name.trim(),
          description: form.description.trim(),
          leaderIds: form.leaderIds,
          updatedAt: new Date().toISOString(),
        }
      );
      await applyMembership(teamId, formMemberIds());
      toast({ title: "Team updated" });
      resetForm();
    } catch {
      toast({
        title: "Error",
        description: "Failed to update team.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (teamId: string, name: string) => {
    try {
      await deleteDoc(
        doc(db, "companies", companyId, "teams", teamId)
      );
      toast({
        title: "Team deleted",
        description: `${name} was removed. People previously in it are now unassigned.`,
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to delete team.",
        variant: "destructive",
      });
    }
  };

  const startEdit = (teamId: string) => {
    const team = teams.find((d) => d.id === teamId);
    if (!team) return;
    setForm({
      name: team.name ?? "",
      description: team.description ?? "",
      leaderIds: teamLeaderIds(team),
      memberIds: (membersByTeam.get(teamId) ?? []).map((m) => m.id),
    });
    setAdding(false);
    setEditingId(teamId);
  };

  if (!isAdmin) {
    return (
      <div className="container mx-auto p-6">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Access Denied
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              You need admin privileges to manage teams.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const addLeader = (userId: string) => {
    if (!userId || form.leaderIds.includes(userId)) return;
    setForm({
      ...form,
      leaderIds: [...form.leaderIds, userId],
      memberIds: form.memberIds.includes(userId)
        ? form.memberIds
        : [...form.memberIds, userId],
    });
  };

  const addMember = (userId: string) => {
    if (!userId || form.memberIds.includes(userId)) return;
    setForm({ ...form, memberIds: [...form.memberIds, userId] });
  };

  const renderChips = (ids: string[], onRemove: (id: string) => void) =>
    ids.length === 0 ? null : (
      <div className="flex flex-wrap gap-1 mb-2">
        {ids.map((id) => (
          <Badge key={id} variant="secondary" className="gap-1">
            {userName(id) ?? "Unknown"}
            <button
              type="button"
              onClick={() => onRemove(id)}
              className="hover:text-destructive"
              aria-label={`Remove ${userName(id) ?? "person"}`}
            >
              <XIcon className="w-3 h-3" />
            </button>
          </Badge>
        ))}
      </div>
    );

  const renderForm = (onSave: () => void, saveLabel: string) => (
    <div className="space-y-3 rounded-md border border-dashed p-4">
      <Input
        placeholder="Team name"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        autoFocus
      />
      <Textarea
        placeholder="What this team is accountable for (optional)"
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
        rows={2}
      />
      <div>
        <label className="text-sm font-medium mb-1 block">
          Team leaders
        </label>
        {renderChips(form.leaderIds, (id) =>
          setForm({ ...form, leaderIds: form.leaderIds.filter((x) => x !== id) })
        )}
        <UserCombobox
          value=""
          onValueChange={(v) => addLeader(v)}
          placeholder="Add a leader"
          valueMode="id"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Leaders can edit any goal owned by someone in their team, and
          are counted as members of it.
        </p>
      </div>
      <div>
        <label className="text-sm font-medium mb-1 block">Team members</label>
        {renderChips(
          form.memberIds.filter((id) => !form.leaderIds.includes(id)),
          (id) =>
            setForm({
              ...form,
              memberIds: form.memberIds.filter((x) => x !== id),
            })
        )}
        <UserCombobox
          value=""
          onValueChange={(v) => addMember(v)}
          placeholder="Add a team member"
          valueMode="id"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Someone already in another team moves here when you add them.
        </p>
      </div>
      <div className="flex gap-2">
        <Button onClick={onSave} disabled={!form.name.trim() || saving}>
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {saveLabel}
        </Button>
        <Button variant="outline" onClick={resetForm}>
          <XIcon className="w-4 h-4 mr-1" />
          Cancel
        </Button>
      </div>
    </div>
  );

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Teams
            </CardTitle>
            <CardDescription>
              Teams group people and own the second layer of the goal
              hierarchy.
            </CardDescription>
          </div>
          {!adding && !editingId && (
            <Button onClick={() => { setForm(emptyForm); setAdding(true); }}>
              <PlusIcon className="w-4 h-4 mr-2" />
              Add Team
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {adding && renderForm(handleCreate, "Create Team")}

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : teams.length === 0 && !adding ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No teams yet. Add one to start building team goals.
            </p>
          ) : (
            <div className="space-y-3">
              {teams.map((team) => {
                const members = membersByTeam.get(team.id) ?? [];
                const leaders = teamLeaderIds(team)
                  .map(userName)
                  .filter(Boolean);

                if (editingId === team.id) {
                  return (
                    <div key={team.id}>
                      {renderForm(
                        () => handleUpdate(team.id),
                        "Save Changes"
                      )}
                    </div>
                  );
                }

                return (
                  <div
                    key={team.id}
                    className="flex items-start justify-between rounded-md border p-4"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{team.name}</span>
                        <Badge variant="secondary" className="gap-1">
                          <Users className="w-3 h-3" />
                          {members.length}
                        </Badge>
                        {leaders.length > 0 ? (
                          <Badge variant="outline">
                            Led by {leaders.join(", ")}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-amber-600">
                            No leader
                          </Badge>
                        )}
                      </div>
                      {team.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {team.description}
                        </p>
                      )}
                      {members.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-2 truncate">
                          {members
                            .map((m) => m.name || m.email)
                            .filter(Boolean)
                            .join(", ")}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 ml-4">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => startEdit(team.id)}
                      >
                        <PencilIcon className="w-4 h-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Delete {team.name}?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              {members.length > 0
                                ? `${members.length} ${members.length === 1 ? "person is" : "people are"} assigned to this team and will become unassigned. Goals owned by this team will keep their data but lose their team link.`
                                : "Goals owned by this team will keep their data but lose their team link."}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() =>
                                handleDelete(team.id, team.name)
                              }
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {unassignedCount > 0 && (
            <p className="text-xs text-muted-foreground">
              {unassignedCount}{" "}
              {unassignedCount === 1 ? "person is" : "people are"} not assigned
              to a team. Assign them from User Management.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
