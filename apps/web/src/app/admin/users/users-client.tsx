"use client";

import { useState } from "react";
import { Shield, User as UserIcon, Crown, Building2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { updateUserRole } from "@/app/actions/scans";
import { assignUserToOrganization, removeUserFromOrganization } from "@/app/actions/organizations";

type UserData = {
  id: string;
  name: string;
  email: string;
  role: string;
  organizationId?: string | null;
  createdAt: Date;
  _count: {
    scans: number;
  };
};

type OrganizationData = {
  id: string;
  name: string;
};

export default function AdminUsersClient({ 
  users: initialUsers, 
  organizations 
}: { 
  users: UserData[]; 
  organizations: OrganizationData[];
}) {
  const [users, setUsers] = useState(initialUsers);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [showOrgSelect, setShowOrgSelect] = useState<string | null>(null);

  const handleRoleChange = async (userId: string, newRole: "user" | "admin") => {
    setUpdatingId(userId);
    try {
      await updateUserRole(userId, newRole);
      setUsers(
        users.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
      toast.success(`User role updated to ${newRole}`);
    } catch (error) {
      toast.error("Failed to update role");
      console.error(error);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleAssignOrg = async (userId: string, orgId: string) => {
    setUpdatingId(userId);
    try {
      await assignUserToOrganization(userId, orgId);
      setUsers(
        users.map((u) => (u.id === userId ? { ...u, organizationId: orgId } : u))
      );
      toast.success("User assigned to organization");
      setShowOrgSelect(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to assign user");
      console.error(error);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRemoveOrg = async (userId: string) => {
    setUpdatingId(userId);
    try {
      await removeUserFromOrganization(userId);
      setUsers(
        users.map((u) => (u.id === userId ? { ...u, organizationId: null } : u))
      );
      toast.success("User removed from organization");
    } catch (error) {
      toast.error("Failed to remove user");
      console.error(error);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Manage Users</h1>
        <p className="text-muted-foreground">
          View and manage user accounts and roles
        </p>
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
                    {user.role === "admin" ? (
                      <Crown className="w-6 h-6 text-yellow-600" />
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
                    {user.organizationId && (
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        {organizations.find(o => o.id === user.organizationId)?.name || 'Organization'}
                      </p>
                    )}
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
                  
                  {user.organizationId ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRemoveOrg(user.id)}
                      disabled={updatingId === user.id}
                    >
                      Remove from Org
                    </Button>
                  ) : (
                    <div className="relative">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowOrgSelect(showOrgSelect === user.id ? null : user.id)}
                        disabled={updatingId === user.id}
                      >
                        <Building2 className="w-4 h-4 mr-2" />
                        Assign to Org
                      </Button>
                      {showOrgSelect === user.id && (
                        <div className="absolute right-0 mt-2 w-64 bg-background border rounded-lg shadow-lg z-10 p-2">
                          {organizations.map(org => (
                            <button
                              key={org.id}
                              onClick={() => handleAssignOrg(user.id, org.id)}
                              className="w-full text-left px-3 py-2 hover:bg-accent rounded-md text-sm"
                            >
                              {org.name}
                            </button>
                          ))}
                          {organizations.length === 0 && (
                            <p className="text-sm text-muted-foreground px-3 py-2">No organizations available</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  
                  <Button
                    size="sm"
                    variant={user.role === "admin" ? "outline" : "default"}
                    onClick={() =>
                      handleRoleChange(
                        user.id,
                        user.role === "admin" ? "user" : "admin"
                      )
                    }
                    disabled={updatingId === user.id}
                  >
                    <Shield className="w-4 h-4 mr-2" />
                    Make {user.role === "admin" ? "User" : "Admin"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
