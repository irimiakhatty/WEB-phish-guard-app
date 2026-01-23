"use client";

import { useEffect, useState } from "react";
import { getAllUsers, updateUserRole, deleteUser, searchUsers } from "../actions/admin";
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
import { Search, MoreVertical, Shield, Trash2, UserCog, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";

export default function AdminUsers() {
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [userToDelete, setUserToDelete] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadUsers();
  }, [currentPage]);

  const loadUsers = async () => {
    setLoading(true);
    const result = await getAllUsers(currentPage);
    setUsers(result.users);
    setTotalPages(result.totalPages);
    setLoading(false);
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      loadUsers();
      return;
    }

    setSearching(true);
    const results = await searchUsers(query);
    setUsers(results);
    setSearching(false);
  };

  const handleRoleChange = async (userId: string, currentRole: string) => {
    const newRole = currentRole === "admin" ? "user" : "admin";
    await updateUserRole(userId, newRole);
    loadUsers();
  };

  const handleDelete = async () => {
    if (!userToDelete) return;

    setDeleting(true);
    await deleteUser(userToDelete.id);
    setDeleting(false);
    setUserToDelete(null);
    loadUsers();
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>User Management</CardTitle>
        <CardDescription>View and manage all platform users</CardDescription>
        <div className="pt-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search users by email or name..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {users.map((user) => (
            <div
              key={user.id}
              className="flex items-center justify-between p-4 border rounded-lg"
            >
              <div className="flex items-center space-x-4">
                <Avatar>
                  <AvatarImage src={user.image || undefined} />
                  <AvatarFallback>
                    {user.name?.[0] || user.email[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{user.name || "Unnamed User"}</p>
                    {user.role === "admin" && (
                      <Badge variant="default">
                        <Shield className="w-3 h-3 mr-1" />
                        Admin
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                  <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                    <span>{user._count.scans} scans</span>
                    <span>{user._count.apiTokens} API tokens</span>
                    {user.personalSubscription && (
                      <Badge variant="outline" className="text-xs">
                        {user.personalSubscription.planId}
                      </Badge>
                    )}
                    {user.memberships.length > 0 && (
                      <span>{user.memberships.length} organizations</span>
                    )}
                  </div>
                </div>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => handleRoleChange(user.id, user.role)}
                  >
                    <UserCog className="w-4 h-4 mr-2" />
                    Make {user.role === "admin" ? "User" : "Admin"}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setUserToDelete(user)}
                    className="text-destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete User
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}

          {users.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              {searchQuery ? "No users found" : "No users yet"}
            </p>
          )}
        </div>

        {/* Pagination */}
        {!searchQuery && totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </CardContent>

      {/* Delete Confirmation */}
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
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
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
