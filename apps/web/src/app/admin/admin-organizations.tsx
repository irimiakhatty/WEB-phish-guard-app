"use client";

import { useEffect, useState } from "react";
import { getAllOrganizations, searchOrganizations, deleteOrganizationAsAdmin } from "../actions/admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { Search, MoreVertical, Trash2, Loader2, ChevronLeft, ChevronRight, Building2, Users } from "lucide-react";
import Link from "next/link";

export default function AdminOrganizations() {
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [orgToDelete, setOrgToDelete] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadOrganizations();
  }, [currentPage]);

  const loadOrganizations = async () => {
    setLoading(true);
    const result = await getAllOrganizations(currentPage);
    setOrganizations(result.organizations);
    setTotalPages(result.totalPages);
    setLoading(false);
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      loadOrganizations();
      return;
    }

    const results = await searchOrganizations(query);
    setOrganizations(results);
  };

  const handleDelete = async () => {
    if (!orgToDelete) return;

    setDeleting(true);
    await deleteOrganizationAsAdmin(orgToDelete.id);
    setDeleting(false);
    setOrgToDelete(null);
    loadOrganizations();
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
        <CardTitle>Organization Management</CardTitle>
        <CardDescription>View and manage all platform organizations</CardDescription>
        <div className="pt-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search organizations by name or slug..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {organizations.map((org) => (
            <div
              key={org.id}
              className="flex items-center justify-between p-4 border rounded-lg"
            >
              <div className="flex items-center space-x-4">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Building2 className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Link href={`/org/${org.slug}`} className="font-semibold hover:underline">
                      {org.name}
                    </Link>
                    <Badge variant="outline" className="text-xs">
                      @{org.slug}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center">
                      <Users className="w-3 h-3 mr-1" />
                      {org._count.members} members
                    </span>
                    <span>{org._count.scans} scans</span>
                    <Badge variant="secondary" className="text-xs">
                      {org.subscription?.planId || "team_free"}
                    </Badge>
                  </div>
                  {org.members[0] && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Admin: {org.members[0].user.email}
                    </p>
                  )}
                </div>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href={`/org/${org.slug}`}>
                      View Organization
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setOrgToDelete(org)}
                    className="text-destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Organization
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}

          {organizations.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              {searchQuery ? "No organizations found" : "No organizations yet"}
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
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
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
