import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { AlertTriangle, Shield, User, UserCheck, Loader2, Trash2, RotateCcw, Users, UserX } from 'lucide-react';
import { db } from "@/lib/firebase";
import { collection, doc, onSnapshot, updateDoc } from "firebase/firestore";

interface UserData {
  id: string;
  email: string;
  name?: string;
  role: 'superadmin' | 'admin' | 'user';
  createdAt: string;
  lastLogin?: string;
  deletedAt?: string;
  deletedBy?: string;
}

export default function AdminPanel() {
  const { user: currentUser, hasRole } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hasRole('admin')) {
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const fetchedUsers: UserData[] = [];
      snapshot.forEach((doc) => {
        fetchedUsers.push({ id: doc.id, ...doc.data() } as UserData);
      });
      setUsers(fetchedUsers);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching users:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [hasRole]);

  // Filter users into active and deleted
  const activeUsers = users.filter(u => !u.deletedAt);
  const deletedUsers = users.filter(u => !!u.deletedAt);

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (userId === currentUser?.uid) {
      toast({
        title: "Cannot Change Own Role",
        description: "You cannot change your own role.",
        variant: "destructive",
      });
      return;
    }

    if ((newRole === 'superadmin' || users.find(u => u.id === userId)?.role === 'superadmin') 
        && !hasRole('superadmin')) {
      toast({
        title: "Insufficient Permissions",
        description: "Only superadmins can manage superadmin roles.",
        variant: "destructive",
      });
      return;
    }

    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, { role: newRole });
      toast({
        title: "Role Updated",
        description: "User role has been successfully updated.",
      });
    } catch (error) {
      console.error("Error updating role:", error);
      toast({
        title: "Error",
        description: "Failed to update user role.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    if (userId === currentUser?.uid) {
      toast({
        title: "Cannot Delete Yourself",
        description: "You cannot delete your own account.",
        variant: "destructive",
      });
      return;
    }

    const targetUser = users.find(u => u.id === userId);
    if (targetUser?.role === 'superadmin' && !hasRole('superadmin')) {
      toast({
        title: "Insufficient Permissions",
        description: "Only superadmins can delete superadmin accounts.",
        variant: "destructive",
      });
      return;
    }

    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, { 
        deletedAt: new Date().toISOString(),
        deletedBy: currentUser?.email || currentUser?.uid
      });
      toast({
        title: "User Deleted",
        description: `${userEmail} has been moved to deleted users.`,
      });
    } catch (error) {
      console.error("Error deleting user:", error);
      toast({
        title: "Error",
        description: "Failed to delete user.",
        variant: "destructive",
      });
    }
  };

  const handleRestoreUser = async (userId: string, userEmail: string) => {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, { 
        deletedAt: null,
        deletedBy: null,
        restoredAt: new Date().toISOString(),
        restoredBy: currentUser?.email || currentUser?.uid
      });
      toast({
        title: "User Restored",
        description: `${userEmail} has been restored to active users.`,
      });
    } catch (error) {
      console.error("Error restoring user:", error);
      toast({
        title: "Error",
        description: "Failed to restore user.",
        variant: "destructive",
      });
    }
  };

  if (!hasRole('admin')) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Access Denied
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              You need admin or superadmin privileges to access this page.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'superadmin': return <Shield className="w-4 h-4 text-red-500" />;
      case 'admin': return <UserCheck className="w-4 h-4 text-blue-500" />;
      default: return <User className="w-4 h-4 text-gray-500" />;
    }
  };

  const getRoleBadgeVariant = (role: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (role) {
      case 'superadmin': return 'destructive';
      case 'admin': return 'default';
      default: return 'secondary';
    }
  };

  const renderActiveUsersTable = () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Email</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Created</TableHead>
          <TableHead>Last Login</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {activeUsers.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
              No active users found.
            </TableCell>
          </TableRow>
        ) : (
          activeUsers.map((user) => (
            <TableRow key={user.id}>
              <TableCell className="font-medium">
                {user.email}
                {user.id === currentUser?.uid && (
                  <Badge variant="outline" className="ml-2">You</Badge>
                )}
              </TableCell>
              <TableCell>{user.name || '-'}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {getRoleIcon(user.role)}
                  <Badge variant={getRoleBadgeVariant(user.role)}>
                    {user.role}
                  </Badge>
                </div>
              </TableCell>
              <TableCell>
                {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}
              </TableCell>
              <TableCell>
                {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {user.id !== currentUser?.uid && (
                    <>
                      <Select
                        value={user.role}
                        onValueChange={(value) => handleRoleChange(user.id, value)}
                        disabled={user.role === 'superadmin' && !hasRole('superadmin')}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">User</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                          {hasRole('superadmin') && (
                            <SelectItem value="superadmin">Superadmin</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      
                      {/* Delete button - only for superadmins */}
                      {hasRole('superadmin') && (
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
                              <AlertDialogTitle>Delete User</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete <strong>{user.email}</strong>? 
                                This will prevent them from accessing the application. 
                                You can restore them later from the Deleted Users tab.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteUser(user.id, user.email)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );

  const renderDeletedUsersTable = () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Email</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Deleted On</TableHead>
          <TableHead>Deleted By</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {deletedUsers.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
              No deleted users.
            </TableCell>
          </TableRow>
        ) : (
          deletedUsers.map((user) => (
            <TableRow key={user.id} className="opacity-75">
              <TableCell className="font-medium">{user.email}</TableCell>
              <TableCell>{user.name || '-'}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {getRoleIcon(user.role)}
                  <Badge variant="outline">
                    {user.role}
                  </Badge>
                </div>
              </TableCell>
              <TableCell>
                {user.deletedAt ? new Date(user.deletedAt).toLocaleDateString() : '-'}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {user.deletedBy || '-'}
              </TableCell>
              <TableCell>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="text-green-600 hover:text-green-700 hover:bg-green-50"
                    >
                      <RotateCcw className="w-4 h-4 mr-1" />
                      Restore
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Restore User</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to restore <strong>{user.email}</strong>? 
                        They will be able to sign in and access the application again.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleRestoreUser(user.id, user.email)}
                        className="bg-green-600 text-white hover:bg-green-700"
                      >
                        Restore
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>User Management</CardTitle>
          <CardDescription>
            Manage user accounts and permissions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <Tabs defaultValue="active" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="active" className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Active Users
                  <Badge variant="secondary" className="ml-1">{activeUsers.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="deleted" className="flex items-center gap-2">
                  <UserX className="w-4 h-4" />
                  Deleted Users
                  {deletedUsers.length > 0 && (
                    <Badge variant="destructive" className="ml-1">{deletedUsers.length}</Badge>
                  )}
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="active">
                {renderActiveUsersTable()}
              </TabsContent>
              
              <TabsContent value="deleted">
                {renderDeletedUsersTable()}
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
