"use client";

import { useState } from "react";
import {
  inviteMember,
  removeMember,
  updateMemberRole,
  cancelInvite,
  resendInvite,
  copyInviteLink,
  createOrganizationDepartment,
  deleteOrganizationDepartment,
  assignMemberDepartment,
} from "@/server/actions/organizations";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Mail, Shield, User, MoreVertical, Trash2, UserCog, Clock, Loader2, Users } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

interface Member {
  id: string;
  userId: string;
  role: string;
  joinedAt: Date;
  department?: {
    id: string;
    name: string;
  } | null;
  user: {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
  };
}

interface Invite {
  id: string;
  email: string;
  role: string;
  status?: "pending" | "sent" | "failed" | "accepted" | "canceled" | "expired";
  sendAttempts?: number | null;
  lastSentAt?: Date | null;
  lastError?: string | null;
  createdAt: Date;
  expiresAt: Date;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  members: Member[];
  organizationDepartments: Array<{
    id: string;
    name: string;
    nameNormalized: string;
  }>;
  invites: Invite[];
  subscription: {
    maxMembers: number;
  } | null;
}

export default function OrganizationMembers({
  organization,
  isAdmin,
  currentUserId,
}: {
  organization: Organization;
  isAdmin: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState("");
  const [departmentName, setDepartmentName] = useState("");
  const [departmentLoading, setDepartmentLoading] = useState(false);
  const [departmentError, setDepartmentError] = useState("");
  const [departmentSuccess, setDepartmentSuccess] = useState("");
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null);
  const [departmentToDelete, setDepartmentToDelete] = useState<{ id: string; name: string } | null>(null);
  const [departmentDeleting, setDepartmentDeleting] = useState(false);
  const [memberDepartmentLoadingId, setMemberDepartmentLoadingId] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<Member | null>(null);
  const [inviteActionId, setInviteActionId] = useState<string | null>(null);
  const [inviteActionType, setInviteActionType] = useState<"resend" | "copy" | "cancel" | null>(null);

  const inviteStatusClass: Record<NonNullable<Invite["status"]>, string> = {
    pending: "bg-gray-100 text-gray-700 border-gray-200",
    sent: "bg-emerald-100 text-emerald-700 border-emerald-200",
    failed: "bg-red-100 text-red-700 border-red-200",
    accepted: "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700",
    canceled: "bg-zinc-100 text-zinc-700 border-zinc-200",
    expired: "bg-amber-100 text-amber-700 border-amber-200",
  };

  const departmentMemberCounts = new Map<string, number>();
  organization.members.forEach((member) => {
    const key = member.department?.id || "unassigned";
    departmentMemberCounts.set(key, (departmentMemberCounts.get(key) || 0) + 1);
  });

  const unassignedDepartment =
    organization.organizationDepartments.find(
      (department) => department.nameNormalized === "unassigned"
    ) || null;
  const legacyUnassignedMembersCount = departmentMemberCounts.get("unassigned") || 0;
  const unassignedDepartmentMembersCount = unassignedDepartment
    ? departmentMemberCounts.get(unassignedDepartment.id) || 0
    : 0;
  const unassignedMembersCount = legacyUnassignedMembersCount + unassignedDepartmentMembersCount;

  const visibleDepartments = organization.organizationDepartments.filter(
    (department) => department.nameNormalized !== "unassigned"
  );

  const selectedDepartmentName =
    selectedDepartmentId === "unassigned"
      ? "Unassigned"
      : selectedDepartmentId
      ? visibleDepartments.find((department) => department.id === selectedDepartmentId)?.name ||
        "Department"
      : null;

  const filteredMembers = selectedDepartmentId
    ? selectedDepartmentId === "unassigned"
      ? organization.members.filter((member) => {
          if (!member.department?.id) return true;
          return unassignedDepartment ? member.department.id === unassignedDepartment.id : false;
        })
      : organization.members.filter((member) => member.department?.id === selectedDepartmentId)
    : organization.members;

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError("");
    setInviteSuccess("");
    setInviteLoading(true);

    const result = await inviteMember(organization.id, {
      email: inviteEmail,
      role: inviteRole,
    });

    setInviteLoading(false);

    if (!result.success) {
      setInviteError(result.error || "Failed to send invite");
      if ("inviteLink" in result && result.inviteLink) {
        setInviteSuccess("Invite created. Email failed, but you can copy the invite link from pending invites.");
      }
      return;
    }

    setInviteSuccess(result.message || "Invite sent successfully");
    setInviteEmail("");
    setInviteRole("member");
    router.refresh();
  };

  const handleRemoveMember = async () => {
    if (!memberToRemove) return;

    setRemovingMemberId(memberToRemove.id);
    const result = await removeMember(organization.id, memberToRemove.id);
    setRemovingMemberId(null);
    setMemberToRemove(null);

    if (result.success) {
      router.refresh();
    } else {
      toast.error(result.error || "Failed to remove member");
    }
  };

  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    setDepartmentError("");
    setDepartmentSuccess("");
    setDepartmentLoading(true);

    const result = await createOrganizationDepartment({
      organizationId: organization.id,
      name: departmentName,
    });

    setDepartmentLoading(false);

    if (!result.success) {
      setDepartmentError(result.error || "Failed to create department");
      return;
    }

    setDepartmentName("");
    setDepartmentSuccess(
      "reused" in result && result.reused ? "Department already existed." : "Department created."
    );
    router.refresh();
  };

  const handleDeleteDepartment = async () => {
    if (!departmentToDelete) return;

    setDepartmentDeleting(true);
    const target = departmentToDelete;
    const result = await deleteOrganizationDepartment({
      organizationId: organization.id,
      departmentId: target.id,
    });
    setDepartmentDeleting(false);

    if (!result.success) {
      toast.error(result.error || "Failed to delete department");
      return;
    }

    toast.success(`Deleted "${target.name}". Members moved to Unassigned.`);
    setDepartmentToDelete(null);
    if (selectedDepartmentId === target.id) {
      setSelectedDepartmentId(null);
    }
    router.refresh();
  };

  const handleAssignDepartment = async (memberId: string, departmentId: string) => {
    setMemberDepartmentLoadingId(memberId);
    const result = await assignMemberDepartment({
      organizationId: organization.id,
      memberId,
      departmentId: departmentId === "unassigned" ? "unassigned" : departmentId,
    });
    setMemberDepartmentLoadingId(null);

    if (!result.success) {
      toast.error(result.error || "Failed to assign department");
      return;
    }

    toast.success("Department updated");
    router.refresh();
  };

  const handleChangeRole = async (memberId: string, newRole: "admin" | "member") => {
    const result = await updateMemberRole(organization.id, memberId, newRole);
    if (result.success) {
      router.refresh();
    } else {
      toast.error(result.error || "Failed to change role");
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    setInviteActionId(inviteId);
    setInviteActionType("cancel");
    const result = await cancelInvite(inviteId);
    setInviteActionId(null);
    setInviteActionType(null);
    if (result.success) {
      toast.success("Invite canceled");
      router.refresh();
    } else {
      toast.error(result.error || "Failed to cancel invite");
    }
  };

  const handleResendInvite = async (inviteId: string) => {
    setInviteActionId(inviteId);
    setInviteActionType("resend");
    const result = await resendInvite(inviteId);
    setInviteActionId(null);
    setInviteActionType(null);

    if (result.success) {
      toast.success(result.message || "Invitation resent");
      router.refresh();
      return;
    }

    toast.error(result.error || "Email could not be sent");
  };

  const handleCopyInviteLink = async (inviteId: string) => {
    setInviteActionId(inviteId);
    setInviteActionType("copy");
    const result = await copyInviteLink(inviteId);
    setInviteActionId(null);
    setInviteActionType(null);

    if (!result.success || !("inviteLink" in result) || !result.inviteLink) {
      toast.error(result.error || "Could not generate invite link");
      return;
    }

    try {
      await navigator.clipboard.writeText(result.inviteLink);
      toast.success("Invite link copied");
    } catch {
      window.prompt("Copy invite link:", result.inviteLink);
      toast("Copy the invite link manually");
    }
  };

  return (
    <div className="space-y-6">
      {isAdmin && (
        <Card>
          <CardContent className="pt-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                <Users className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
                Members intelligence
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                View risk signals, exposure trends, and profiles in the dedicated members dashboard.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href={`/org/${organization.slug}/members`}>Open members dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Departments</CardTitle>
            <CardDescription>
              Organize members by department for clearer risk analytics and response priorities.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {departmentError ? (
              <Alert variant="destructive">
                <AlertDescription>{departmentError}</AlertDescription>
              </Alert>
            ) : null}
            {departmentSuccess ? (
              <Alert>
                <AlertDescription>{departmentSuccess}</AlertDescription>
              </Alert>
            ) : null}

            <form onSubmit={handleCreateDepartment} className="flex flex-col md:flex-row gap-3">
              <Input
                placeholder="e.g. Finance, HR, IT Security"
                value={departmentName}
                onChange={(e) => setDepartmentName(e.target.value)}
                disabled={departmentLoading}
                required
              />
              <Button type="submit" disabled={departmentLoading}>
                {departmentLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Add department"
                )}
              </Button>
            </form>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {visibleDepartments.map((department) => {
                const isSelected = selectedDepartmentId === department.id;
                return (
                  <div
                    key={department.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedDepartmentId(department.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedDepartmentId(department.id);
                      }
                    }}
                    className={`rounded-xl bg-muted/30 p-3 text-left transition-colors hover:bg-muted/40 cursor-pointer ${
                      isSelected ? "ring-2 ring-primary/40" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-sm text-gray-900 dark:text-gray-100">
                          {department.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Members: {departmentMemberCounts.get(department.id) || 0}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDepartmentToDelete({ id: department.id, name: department.name });
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
              <button
                type="button"
                onClick={() => setSelectedDepartmentId("unassigned")}
                className={`rounded-xl bg-muted/20 p-3 text-left transition-colors hover:bg-muted/30 ${
                  selectedDepartmentId === "unassigned" ? "ring-2 ring-primary/40" : ""
                }`}
              >
                <p className="font-medium text-sm text-gray-900 dark:text-gray-100">Unassigned</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Members: {unassignedMembersCount}
                </p>
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invite Form */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <UserPlus className="w-5 h-5 mr-2" />
              Invite Members
            </CardTitle>
            <CardDescription>
              Invite people to join your organization ({organization.members.length}/
              {organization.subscription?.maxMembers || 3} members)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInvite} className="space-y-4">
              {inviteError && (
                <Alert variant="destructive">
                  <AlertDescription>{inviteError}</AlertDescription>
                </Alert>
              )}
              {inviteSuccess && (
                <Alert>
                  <AlertDescription>{inviteSuccess}</AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="colleague@company.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                    disabled={inviteLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select
                    value={inviteRole}
                    onValueChange={(value: "admin" | "member") => setInviteRole(value)}
                    disabled={inviteLoading}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button type="submit" disabled={inviteLoading}>
                {inviteLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4 mr-2" />
                    Send Invitation
                  </>
                )}
              </Button>
            </form>
          </CardContent>
      </Card>
      )}

      {/* Current Members */}
      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle>Team Members</CardTitle>
            <CardDescription>
              {filteredMembers.length} member{filteredMembers.length === 1 ? "" : "s"}
              {selectedDepartmentName ? ` in ${selectedDepartmentName}` : " active"}
            </CardDescription>
          </div>
          {selectedDepartmentId ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSelectedDepartmentId(null)}
            >
              Show all
            </Button>
          ) : null}
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredMembers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No members match this department yet.</p>
            ) : null}
            {filteredMembers.map((member) => {
              const isCurrentUser = member.userId === currentUserId;

              return (
                <div
                  key={member.id}
                  className="flex items-center justify-between rounded-xl bg-muted/30 p-4"
                >
                  <div className="flex items-center space-x-4">
                    <Avatar>
                      <AvatarImage src={member.user.image || undefined} />
                      <AvatarFallback>
                        {member.user.name?.[0] || member.user.email[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">
                          {member.user.name || "Unnamed User"}
                        </p>
                        {isCurrentUser && (
                          <Badge variant="outline" className="text-xs">
                            You
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {member.user.email}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Joined{" "}
                        {new Date(member.joinedAt).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          timeZone: "UTC",
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {isAdmin ? (
                      <div className="w-[180px]">
                        <Select
                          value={
                            !member.department?.id
                              ? "unassigned"
                              : unassignedDepartment &&
                                member.department.id === unassignedDepartment.id
                              ? "unassigned"
                              : member.department.id
                          }
                          onValueChange={(value) => handleAssignDepartment(member.id, value)}
                          disabled={memberDepartmentLoadingId === member.id}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassigned">Unassigned</SelectItem>
                            {visibleDepartments.map((department) => (
                              <SelectItem key={department.id} value={department.id}>
                                {department.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <Badge variant="outline">{member.department?.name || "Unassigned"}</Badge>
                    )}

                    <Badge variant={member.role === "admin" ? "default" : "secondary"}>
                      {member.role === "admin" ? (
                        <>
                          <Shield className="w-3 h-3 mr-1" />
                          Admin
                        </>
                      ) : (
                        <>
                          <User className="w-3 h-3 mr-1" />
                          Member
                        </>
                      )}
                    </Badge>

                    {isAdmin && !isCurrentUser && (
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() =>
                              handleChangeRole(
                                member.id,
                                member.role === "admin" ? "member" : "admin"
                              )
                            }
                          >
                            <UserCog className="w-4 h-4 mr-2" />
                            Make {member.role === "admin" ? "Member" : "Admin"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setMemberToRemove(member)}
                            className="text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Pending Invites */}
      {isAdmin && organization.invites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Invitations</CardTitle>
            <CardDescription>{organization.invites.length} active invites</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {organization.invites.map((invite) => {
                const actionLoading = inviteActionId === invite.id;
                const inviteStatus = (invite.status || "pending") as NonNullable<Invite["status"]>;

                return (
                  <div
                    key={invite.id}
                    className="flex flex-col gap-4 rounded-xl bg-muted/30 p-4"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center space-x-4">
                        <div className="p-2 bg-muted rounded-full">
                          <Mail className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-semibold">{invite.email}</p>
                          <p className="text-sm text-muted-foreground">
                            <Clock className="w-3 h-3 inline mr-1" />
                            Expires {new Date(invite.expiresAt).toLocaleDateString()}
                          </p>
                          {invite.lastError ? (
                            <p className="text-xs text-red-600 mt-1">{invite.lastError}</p>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{invite.role}</Badge>
                        <span
                          className={`text-xs font-medium px-2 py-1 rounded-full border ${inviteStatusClass[inviteStatus]}`}
                        >
                          {inviteStatus}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleResendInvite(invite.id)}
                        disabled={actionLoading}
                      >
                        {actionLoading && inviteActionType === "resend" ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : null}
                        Resend
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopyInviteLink(invite.id)}
                        disabled={actionLoading}
                      >
                        {actionLoading && inviteActionType === "copy" ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : null}
                        Copy link
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCancelInvite(invite.id)}
                        disabled={actionLoading}
                      >
                        {actionLoading && inviteActionType === "cancel" ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : null}
                        Cancel
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        Attempts: {invite.sendAttempts ?? 0}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delete Department Dialog */}
      <AlertDialog
        open={!!departmentToDelete}
        onOpenChange={() => setDepartmentToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete department?</AlertDialogTitle>
            <AlertDialogDescription>
              Delete {departmentToDelete?.name}? Members assigned to this department will be moved to Unassigned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={departmentDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteDepartment}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={departmentDeleting}
            >
              {departmentDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete department"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove Confirmation Dialog */}
      <AlertDialog
        open={!!memberToRemove}
        onOpenChange={() => setMemberToRemove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove team member?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {memberToRemove?.user.name || memberToRemove?.user.email} from this organization? They will lose access immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveMember}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removingMemberId ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Removing...
                </>
              ) : (
                "Remove Member"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
