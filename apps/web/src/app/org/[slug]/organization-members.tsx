"use client";

import { useState } from "react";
import { inviteMember, removeMember, updateMemberRole, cancelInvite, bulkInviteMembers } from "@/app/actions/organizations";
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

interface Member {
  id: string;
  userId: string;
  role: string;
  joinedAt: Date;
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
  createdAt: Date;
  expiresAt: Date;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  members: Member[];
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
  const [bulkInvites, setBulkInvites] = useState<Array<{ email: string; name?: string; department?: string; role?: "admin" | "member" }>>([]);
  const [bulkSummary, setBulkSummary] = useState<{ invited: number; added: number; skipped: number; total: number } | null>(null);
  const [bulkError, setBulkError] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<Member | null>(null);

  const parseCsvLine = (line: string) => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
        continue;
      }
      if (char === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (char === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
        continue;
      }
      current += char;
    }
    result.push(current.trim());
    return result;
  };

  const parseCsv = (text: string) => {
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (lines.length === 0) return [];

    const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
    const hasHeader = header.some((h) => ["email", "name", "department", "role"].includes(h));

    const rows = hasHeader ? lines.slice(1) : lines;
    const result: Array<{ email: string; name?: string; department?: string; role?: "admin" | "member" }> = [];

    rows.forEach((line) => {
      const cols = parseCsvLine(line);
      const getValue = (key: string, index: number) => {
        if (hasHeader) {
          const idx = header.indexOf(key);
          return idx >= 0 ? cols[idx] : "";
        }
        return cols[index] || "";
      };

      const email = getValue("email", 0);
      const name = getValue("name", 1);
      const department = getValue("department", 2);
      const roleRaw = getValue("role", 3);
      const role = roleRaw === "admin" ? "admin" : roleRaw === "member" ? "member" : undefined;

      if (!email) return;
      result.push({ email, name, department, role });
    });

    return result;
  };

  const handleCsvUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    setBulkError("");
    setBulkSummary(null);
    const file = event.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const parsed = parseCsv(text);
    if (parsed.length === 0) {
      setBulkError("No valid rows found in CSV.");
      setBulkInvites([]);
      return;
    }
    setBulkInvites(parsed);
  };

  const handleBulkInvite = async () => {
    if (!bulkInvites.length) return;
    setBulkLoading(true);
    setBulkError("");
    setBulkSummary(null);

    const result = await bulkInviteMembers(organization.id, bulkInvites);
    setBulkLoading(false);

    if (!result.success) {
      setBulkError(result.error || "Failed to send bulk invites");
      return;
    }

    setBulkSummary(result.summary || null);
    setBulkInvites([]);
    router.refresh();
  };

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
      alert(result.error);
    }
  };

  const handleChangeRole = async (memberId: string, newRole: "admin" | "member") => {
    const result = await updateMemberRole(organization.id, memberId, newRole);
    if (result.success) {
      router.refresh();
    } else {
      alert(result.error);
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    const result = await cancelInvite(inviteId);
    if (result.success) {
      router.refresh();
    } else {
      alert(result.error);
    }
  };

  return (
    <div className="space-y-6">
      {isAdmin && (
        <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-gray-200/80 dark:border-gray-800/80">
          <CardContent className="pt-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                <Users className="w-4 h-4 text-blue-600" />
                Members intelligence
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                View risk signals, training needs, and profiles in the dedicated members dashboard.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href={`/org/${organization.slug}/members`}>Open members dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      )}
      {/* Invite Form */}
      {isAdmin && (
        <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-gray-200/80 dark:border-gray-800/80">
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

      {isAdmin && (
        <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-gray-200/80 dark:border-gray-800/80">
          <CardHeader>
            <CardTitle className="flex items-center">
              <UserPlus className="w-5 h-5 mr-2" />
              Bulk Invite via CSV
            </CardTitle>
            <CardDescription>
              Upload a CSV with columns: email, name, department, role (only email is required).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {bulkError && (
              <Alert variant="destructive">
                <AlertDescription>{bulkError}</AlertDescription>
              </Alert>
            )}
            {bulkSummary && (
              <Alert>
                <AlertDescription>
                  Sent {bulkSummary.invited} invites, added {bulkSummary.added} existing users,
                  skipped {bulkSummary.skipped}. Total processed: {bulkSummary.total}.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="csv-upload">CSV File</Label>
              <Input
                id="csv-upload"
                type="file"
                accept=".csv"
                onChange={handleCsvUpload}
                disabled={bulkLoading}
              />
              {bulkInvites.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  {bulkInvites.length} rows ready to invite.
                </p>
              )}
            </div>

            <Button onClick={handleBulkInvite} disabled={bulkLoading || bulkInvites.length === 0}>
              {bulkLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Send Bulk Invites
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Current Members */}
      <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-gray-200/80 dark:border-gray-800/80">
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>{organization.members.length} active members</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {organization.members.map((member) => {
              const isCurrentUser = member.userId === currentUserId;

              return (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-4 border border-gray-200/70 dark:border-gray-800/70 rounded-lg bg-white/60 dark:bg-gray-900/60"
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
        <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-gray-200/80 dark:border-gray-800/80">
          <CardHeader>
            <CardTitle>Pending Invitations</CardTitle>
            <CardDescription>{organization.invites.length} pending invites</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {organization.invites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex items-center justify-between p-4 border border-gray-200/70 dark:border-gray-800/70 rounded-lg bg-white/60 dark:bg-gray-900/60"
                >
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
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Badge variant="secondary">{invite.role}</Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCancelInvite(invite.id)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
