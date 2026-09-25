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

const emptyForm = { name: "", description: "", leaderId: "" };

export default function DepartmentManagement() {
  const { toast } = useToast();
  const { hasRole } = useAuth();
  const { companyId } = usePlanYear();
  const { departments, loading } = useDepartments();
  const { users } = useActiveUsers();

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
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

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await addDoc(collection(db, "companies", companyId, "departments"), {
        name: form.name.trim(),
        description: form.description.trim(),
        leaderId: form.leaderId || "",
        leaderName: userName(form.leaderId) || "",
        memberIds: [],
        sortOrder: departments.length,
        companyId,
        createdAt: new Date().toISOString(),
      });
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
          leaderId: form.leaderId || "",
          leaderName: userName(form.leaderId) || "",
          updatedAt: new Date().toISOString(),
        }
      );
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
      leaderId: department.leaderId ?? "",
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
          Department leader
        </label>
        <UserCombobox
          value={form.leaderId}
          onValueChange={(v) => setForm({ ...form, leaderId: v })}
          placeholder="Select a leader"
          valueMode="id"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Leaders can edit any goal owned by someone in their department.
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
                const leader = userName(department.leaderId);

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
                        {leader ? (
                          <Badge variant="outline">Led by {leader}</Badge>
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
