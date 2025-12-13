import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { SettingsIcon, UserIcon, LogOutIcon, CheckIcon, XIcon, Loader2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";

export default function Settings() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user?.name || "");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!user) return;
    
    setIsSaving(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { name });
      toast({
        title: "Success",
        description: "Your name has been updated",
      });
      setIsEditing(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update name",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setName(user?.name || "");
    setIsEditing(false);
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to logout",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="border-b border-border pb-4">
        <div className="flex items-center gap-3 mb-2">
          <SettingsIcon className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Manage your account settings and preferences
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <UserIcon className="w-5 h-5" />
            Account Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              Email
            </label>
            <Input
              value={user?.email || ""}
              disabled
              className="text-muted-foreground cursor-not-allowed"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Email cannot be changed
            </p>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              Name
            </label>
            {isEditing ? (
              <div className="flex gap-2">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="flex-1"
                  placeholder="Enter your name"
                  autoFocus
                  disabled={isSaving}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleSave}
                  className="h-10 w-10 text-green-600 hover:text-green-500"
                  disabled={isSaving}
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckIcon className="h-4 w-4" />}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleCancel}
                  className="h-10 w-10 text-destructive hover:text-destructive"
                  disabled={isSaving}
                >
                  <XIcon className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  value={user?.name || "Not set"}
                  disabled
                  className="flex-1 text-muted-foreground"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                >
                  Edit
                </Button>
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              Role
            </label>
            <Input
              value={user?.role || "user"}
              disabled
              className="text-muted-foreground cursor-not-allowed capitalize"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={handleLogout}
            className="w-full border-destructive/30 text-destructive hover:bg-destructive/10"
          >
            <LogOutIcon className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
