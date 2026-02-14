"use client";

import { useState } from "react";
import Link from "next/link";
import { Shield, User as UserIcon, Crown, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { updateUserRole, deleteUser } from "@/app/actions/scans";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type UserData = {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: Date;
  _count: {
    scans: number;
  };
};

export default function AdminUsersClient({ 
  users: initialUsers
}: { 
  users: UserData[];
}) {
  const [users, setUsers] = useState(initialUsers);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserData | null>(null);

  const handleRoleChange = async (userId: string, newRole: "user" | "admin") => {
    setUpdatingId(userId);
    try {
      await updateUserRole(userId, newRole);
      setUsers(
        users.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
      toast.success(`User role updated to ${newRole}`);
    } catch (error: any) {
      toast.error(error.message || "Failed to update role");
      console.error(error);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteClick = (user: UserData) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;

    setUpdatingId(userToDelete.id);
    try {
      const result = await deleteUser(userToDelete.id);
      setUsers(users.filter((u) => u.id !== userToDelete.id));
      toast.success(result.message || "User deleted successfully");
      setDeleteDialogOpen(false);
      setUserToDelete(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to delete user");
      console.error(error);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Manage Users</h1>
          <p className="text-muted-foreground">
            View and manage user accounts and roles
          </p>
        </div>
        <Link href="/admin/users/create">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Create User
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Users ({users.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {users.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between py-4 border-b last:border-0"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                    {user.role === "super_admin" ? (
                      <Crown className="w-6 h-6 text-yellow-600" />
                    ) : user.role === "admin" ? (
                      <Shield className="w-6 h-6 text-yellow-600" />
                    ) : (
                      <UserIcon className="w-6 h-6 text-blue-600" />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold">{user.name}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {user._count.scans} scans • Joined {new Date(user.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      user.role === "admin"
                        ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                        : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                    }`}
                  >
                    {user.role.toUpperCase()}
                  </span>
                  
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDeleteClick(user)}
                    disabled={updatingId === user.id || user.role === "super_admin"}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                  
                  <Button
                    size="sm"
                    variant={user.role === "admin" ? "outline" : "default"}
                    onClick={() =>
                      handleRoleChange(
                        user.id,
                        user.role === "admin" ? "user" : "admin"
                      )
                    }
                    disabled={updatingId === user.id || user.role === "super_admin"}
                  >
                    <Shield className="w-4 h-4 mr-2" />
                    {user.role === "super_admin"
                      ? "Super Admin"
                      : `Make ${user.role === "admin" ? "User" : "Admin"}`}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the user <strong>{userToDelete?.email}</strong> and all associated data:
              <ul className="mt-2 list-disc list-inside space-y-1">
                <li>{userToDelete?._count.scans || 0} scans</li>
                <li>All sessions and accounts</li>
                <li>Dashboard statistics</li>
              </ul>
              <p className="mt-2 text-red-600 font-semibold">This action cannot be undone.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={updatingId === userToDelete?.id}
            >
              {updatingId === userToDelete?.id ? "Deleting..." : "Delete User"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
