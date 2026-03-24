"use client";

import { useEffect, useState } from "react";
import { getAllUsers, updateUserRole, deleteUser, searchUsers } from "@/server/actions/admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  Search,
  MoreVertical,
  Shield,
  Trash2,
  UserCog,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react";
import AdminCreateUserForm from "./admin-create-user-form";
import type { AdminUser } from "./types";

export default function AdminUsersPanel() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [userToDelete, setUserToDelete] = useState<AdminUser | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const loadUsers = async (page = currentPage) => {
    setLoading(true);
    const result = await getAllUsers(page);
    setUsers(result.users);
    setTotalPages(result.totalPages);
    setLoading(false);
  };

  useEffect(() => {
    void loadUsers(currentPage);
  }, [currentPage]);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);

    if (query.length < 2) {
      void loadUsers();
      return;
    }

    setLoading(true);
    const results = await searchUsers(query);
    setUsers(results);
    setLoading(false);
  };

  const handleRoleChange = async (userId: string, currentRole: AdminUser["role"]) => {
    if (currentRole === "super_admin") {
      return;
    }

    const newRole = currentRole === "admin" ? "user" : "admin";
    await updateUserRole(userId, newRole);
    void loadUsers();
  };

  const handleDelete = async () => {
    if (!userToDelete) {
      return;
    }

    setDeleting(true);
    await deleteUser(userToDelete.id);
    setDeleting(false);
    setUserToDelete(null);
    void loadUsers();
  };

  const handleUserCreated = () => {
    setShowCreateForm(false);
    setSearchQuery("");

    if (currentPage !== 1) {
      setCurrentPage(1);
      return;
    }

    void loadUsers(1);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle>User Management</CardTitle>
            <CardDescription>View, create, and manage all platform users.</CardDescription>
          </div>
          <Button type="button" onClick={() => setShowCreateForm((value) => !value)}>
            <Plus className="mr-2 h-4 w-4" />
            {showCreateForm ? "Close form" : "Create user"}
          </Button>
        </div>
        <div className="pt-2">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users by email or name..."
              className="pl-10"
              value={searchQuery}
              onChange={(event) => handleSearch(event.target.value)}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {showCreateForm ? (
          <AdminCreateUserForm
            onCreated={handleUserCreated}
            onCancel={() => setShowCreateForm(false)}
          />
        ) : null}

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {users.map((user) => (
              <div key={user.id} className="flex items-center justify-between rounded-lg border p-4">
                <div className="flex items-center space-x-4">
                  <Avatar>
                    <AvatarImage src={user.image || undefined} />
                    <AvatarFallback>{user.name?.[0] || user.email[0].toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{user.name || "Unnamed User"}</p>
                      {user.role === "super_admin" ? (
                        <Badge variant="default">
                          <Shield className="mr-1 h-3 w-3" />
                          Super Admin
                        </Badge>
                      ) : user.role === "admin" ? (
                        <Badge variant="default">
                          <Shield className="mr-1 h-3 w-3" />
                          Admin
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                      <span>{user._count.scans} scans</span>
                      <span>{user._count.apiTokens} API tokens</span>
                      {user.personalSubscription ? (
                        <Badge variant="outline" className="text-xs">
                          {user.personalSubscription.plan}
                        </Badge>
                      ) : null}
                      <span>{user.memberships.length} organizations</span>
                    </div>
                  </div>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => handleRoleChange(user.id, user.role)}
                      disabled={user.role === "super_admin"}
                    >
                      <UserCog className="mr-2 h-4 w-4" />
                      Make {user.role === "super_admin" ? "Super Admin" : user.role === "admin" ? "User" : "Admin"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setUserToDelete(user)}
                      className="text-destructive"
                      disabled={user.role === "super_admin"}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete User
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}

            {users.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">
                {searchQuery ? "No users found" : "No users yet"}
              </p>
            ) : null}
          </div>
        )}

        {!loading && !searchQuery && totalPages > 1 ? (
          <div className="mt-6 flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        ) : null}
      </CardContent>

      <AlertDialog open={!!userToDelete} onOpenChange={() => setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {userToDelete?.name || userToDelete?.email}? This will permanently delete all their data including scans, API tokens, and organization memberships.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete User"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}