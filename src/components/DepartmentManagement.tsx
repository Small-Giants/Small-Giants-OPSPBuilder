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
import { useDepartments } from "@/hooks/use-departments";
import { useActiveUsers } from "@/hooks/use-active-users";
import { departmentLeaderIds } from "@/types";
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

interface DepartmentForm {
  name: string;
  description: string;
  leaderIds: string[];
  memberIds: string[];
}

const emptyForm: DepartmentForm = {
  name: "",
  description: "",
  leaderIds: [],
  memberIds: [],
};

export default function DepartmentManagement() {
  const { toast } = useToast();
  const { hasRole } = useAuth();
  const { companyId } = usePlanYear();
  const { departments, loading } = useDepartments();
  const { users } = useActiveUsers();

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<DepartmentForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const isAdmin = hasRole("admin");

  const membersByDepartment = useMemo(() => {
    const map = new Map<string, typeof users>();
    users.forEach((user) => {
      if (!user.departmentId) return;
      const existing = map.get(user.departmentId) ?? [];
      existing.push(user);
      map.set(user.departmentId, existing);
    });
    return map;
  }, [users]);

  const unassignedCount = users.filter((u) => !u.departmentId).length;

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
   * user rather than a field on the department.
   */
  const applyMembership = async (departmentId: string, memberIds: string[]) => {
    const desired = new Set(memberIds);
    const current = new Set(
      (membersByDepartment.get(departmentId) ?? []).map((m) => m.id)
    );

    const writes: Promise<unknown>[] = [];
    desired.forEach((userId) => {
      if (!current.has(userId)) {
        writes.push(updateDoc(doc(db, "users", userId), { departmentId }));
      }
    });
    current.forEach((userId) => {
      if (!desired.has(userId)) {
        writes.push(updateDoc(doc(db, "users", userId), { departmentId: "" }));
      }
    });
    await Promise.all(writes);
  };

  /** Leaders are members of the department they lead. */
  const formMemberIds = () =>
    Array.from(new Set([...form.leaderIds, ...form.memberIds]));

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const created = await addDoc(
        collection(db, "companies", companyId, "departments"),
        {
          name: form.name.trim(),
          description: form.description.trim(),
          leaderIds: form.leaderIds,
          sortOrder: departments.length,
          companyId,
          createdAt: new Date().toISOString(),
        }
      );
      await applyMembership(created.id, formMemberIds());
      toast({ title: "Department created", description: form.name.trim() });
      resetForm();
    } catch {
      toast({
        title: "Error",
        description: "Failed to create department.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (departmentId: string) => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await updateDoc(
        doc(db, "companies", companyId, "departments", departmentId),
        {
          name: form.name.trim(),
          description: form.description.trim(),
          leaderIds: form.leaderIds,
          updatedAt: new Date().toISOString(),
        }
      );
      await applyMembership(departmentId, formMemberIds());
      toast({ title: "Department updated" });
      resetForm();
    } catch {
      toast({
        title: "Error",
        description: "Failed to update department.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (departmentId: string, name: string) => {
    try {
      await deleteDoc(
        doc(db, "companies", companyId, "departments", departmentId)
      );
      toast({
        title: "Department deleted",
        description: `${name} was removed. People previously in it are now unassigned.`,
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to delete department.",
        variant: "destructive",
      });
    }
  };

  const startEdit = (departmentId: string) => {
    const department = departments.find((d) => d.id === departmentId);
    if (!department) return;
    setForm({
      name: department.name ?? "",
      description: department.description ?? "",
      leaderIds: departmentLeaderIds(department),
      memberIds: (membersByDepartment.get(departmentId) ?? []).map((m) => m.id),
    });
    setAdding(false);
    setEditingId(departmentId);
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
              You need admin privileges to manage departments.
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
        placeholder="Department name"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        autoFocus
      />
      <Textarea
        placeholder="What this department is accountable for (optional)"
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
        rows={2}
      />
      <div>
        <label className="text-sm font-medium mb-1 block">
          Department leaders
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
          Leaders can edit any goal owned by someone in their department, and
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
          Someone already in another department moves here when you add them.
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
              Departments
            </CardTitle>
            <CardDescription>
              Departments group people and own the second layer of the goal
              hierarchy.
            </CardDescription>
          </div>
          {!adding && !editingId && (
            <Button onClick={() => { setForm(emptyForm); setAdding(true); }}>
              <PlusIcon className="w-4 h-4 mr-2" />
              Add Department
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {adding && renderForm(handleCreate, "Create Department")}

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : departments.length === 0 && !adding ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No departments yet. Add one to start building department goals.
            </p>
          ) : (
            <div className="space-y-3">
              {departments.map((department) => {
                const members = membersByDepartment.get(department.id) ?? [];
                const leaders = departmentLeaderIds(department)
                  .map(userName)
                  .filter(Boolean);

                if (editingId === department.id) {
                  return (
                    <div key={department.id}>
                      {renderForm(
                        () => handleUpdate(department.id),
                        "Save Changes"
                      )}
                    </div>
                  );
                }

                return (
                  <div
                    key={department.id}
                    className="flex items-start justify-between rounded-md border p-4"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{department.name}</span>
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
                      {department.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {department.description}
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
                        onClick={() => startEdit(department.id)}
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
                              Delete {department.name}?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              {members.length > 0
                                ? `${members.length} ${members.length === 1 ? "person is" : "people are"} assigned to this department and will become unassigned. Goals owned by this department will keep their data but lose their department link.`
                                : "Goals owned by this department will keep their data but lose their department link."}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() =>
                                handleDelete(department.id, department.name)
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
              to a department. Assign them from User Management.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
