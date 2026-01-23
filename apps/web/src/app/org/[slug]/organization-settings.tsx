"use client";

import { useState } from "react";
import { updateOrganization, deleteOrganization } from "@/app/actions/organizations";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
} from "@/components/ui/alert-dialog";
import { Loader2, AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";

interface Organization {
  id: string;
  name: string;
  slug: string;
}

export default function OrganizationSettings({
  organization,
}: {
  organization: Organization;
}) {
  const router = useRouter();
  const [name, setName] = useState(organization.name);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [updateError, setUpdateError] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdateError("");
    setUpdateLoading(true);

    const result = await updateOrganization(organization.id, { name });
    setUpdateLoading(false);

    if (!result.success) {
      setUpdateError(result.error || "Failed to update organization");
      return;
    }

    router.refresh();
  };

  const handleDelete = async () => {
    if (deleteConfirmText !== organization.slug) {
      return;
    }

    setDeleteLoading(true);
    const result = await deleteOrganization(organization.id);

    if (result.success) {
      router.push("/organizations");
    } else {
      alert(result.error);
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle>General Settings</CardTitle>
          <CardDescription>Update your organization's basic information</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdate} className="space-y-4">
            {updateError && (
              <Alert variant="destructive">
                <AlertDescription>{updateError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Organization Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={updateLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Organization Slug</Label>
              <Input
                id="slug"
                value={organization.slug}
                disabled
                className="bg-muted"
              />
              <p className="text-sm text-muted-foreground">
                The organization slug cannot be changed
              </p>
            </div>

            <Button type="submit" disabled={updateLoading}>
              {updateLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2" />
            Danger Zone
          </CardTitle>
          <CardDescription>
            Permanently delete this organization and all its data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">Delete Organization</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription className="space-y-3">
                  <p>
                    This action cannot be undone. This will permanently delete the
                    organization and remove all associated data including:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li>All team members</li>
                    <li>All scans and history</li>
                    <li>Subscription and billing information</li>
                    <li>All settings and configuration</li>
                  </ul>
                  <div className="pt-4">
                    <Label htmlFor="confirm">
                      Type <span className="font-mono font-bold">{organization.slug}</span> to confirm:
                    </Label>
                    <Input
                      id="confirm"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      placeholder={organization.slug}
                      className="mt-2"
                    />
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setDeleteConfirmText("")}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  disabled={deleteConfirmText !== organization.slug || deleteLoading}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleteLoading ? (
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
        </CardContent>
      </Card>
    </div>
  );
}
