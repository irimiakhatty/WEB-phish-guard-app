"use client";

import { useEffect, useMemo, useState } from "react";
import { getAllOrganizations, searchOrganizations, deleteOrganizationAsAdmin } from "@/server/actions/admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getPlanById } from "@/lib/billing/subscription-plans";
import { AdminPlanBadge } from "./admin-plan-badge";
import {
  ORGANIZATION_SORT_OPTIONS,
  sortOrganizations,
  type OrganizationSortKey,
} from "./admin-list-sort";
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
  Trash2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Building2,
  Users,
  DollarSign,
  ArrowUpDown,
} from "lucide-react";
import Link from "next/link";
import type { AdminOrganization } from "./types";

export default function AdminOrganizationsPanel() {
  const [organizations, setOrganizations] = useState<AdminOrganization[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [orgToDelete, setOrgToDelete] = useState<AdminOrganization | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [sortKey, setSortKey] = useState<OrganizationSortKey>("newest");
  const currency = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }),
    []
  );
  const sortedOrganizations = useMemo(
    () => sortOrganizations(organizations, sortKey),
    [organizations, sortKey]
  );

  const loadOrganizations = async (page = currentPage) => {
    setLoading(true);
    const result = await getAllOrganizations(page);
    setOrganizations(result.organizations);
    setTotalPages(result.totalPages);
    setLoading(false);
  };

  useEffect(() => {
    void loadOrganizations(currentPage);
  }, [currentPage]);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      void loadOrganizations();
      return;
    }

    setLoading(true);
    const results = await searchOrganizations(query);
    setOrganizations(results);
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!orgToDelete) {
      return;
    }

    setDeleting(true);
    await deleteOrganizationAsAdmin(orgToDelete.id);
    setDeleting(false);
    setOrgToDelete(null);
    void loadOrganizations();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Organization Management</CardTitle>
        <CardDescription>Review and manage every organization in one place.</CardDescription>
        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search organizations by name or slug..."
              className="pl-10"
              value={searchQuery}
              onChange={(event) => handleSearch(event.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 sm:w-56">
            <ArrowUpDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <Label htmlFor="organization-sort" className="sr-only">
              Sort organizations
            </Label>
            <Select
              value={sortKey}
              onValueChange={(value) => setSortKey(value as OrganizationSortKey)}
            >
              <SelectTrigger id="organization-sort" className="w-full">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                {ORGANIZATION_SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {sortedOrganizations.map((organization) => (
              <div key={organization.id} className="flex items-center justify-between rounded-lg border p-4">
                <div className="flex items-center space-x-4">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <Building2 className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Link href={`/org/${organization.slug}`} className="font-semibold hover:underline">
                        {organization.name}
                      </Link>
                      <Badge variant="outline" className="text-xs">
                        @{organization.slug}
                      </Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center">
                        <Users className="mr-1 h-3 w-3" />
                        {organization._count.members} members
                      </span>
                      <span>{organization._count.scans} scans</span>
                      <AdminPlanBadge planId={organization.subscription?.plan || "team_free"} />
                      <span className="flex items-center">
                        <DollarSign className="mr-1 h-3 w-3" />
                        {(() => {
                          const planId = organization.subscription?.plan ?? "team_free";
                          const plan = getPlanById(planId);
                          const estimatedMrr =
                            organization.subscription?.status === "active" ? plan.price : 0;
                          return `${currency.format(estimatedMrr)}/mo`;
                        })()}
                      </span>
                    </div>
                    {organization.members[0] ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Admin: {organization.members[0].user.email}
                      </p>
                    ) : null}
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
                      render={<Link href={`/org/${organization.slug}`}>View Organization</Link>}
                    />
                    <DropdownMenuItem onClick={() => setOrgToDelete(organization)} className="text-destructive">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Organization
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}

            {sortedOrganizations.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">
                {searchQuery ? "No organizations found" : "No organizations yet"}
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

      <AlertDialog open={!!orgToDelete} onOpenChange={() => setOrgToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete organization?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {orgToDelete?.name}? This will permanently delete all organization data including members, scans, and subscription information.
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
                "Delete Organization"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
