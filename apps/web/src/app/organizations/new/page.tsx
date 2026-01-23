"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createOrganization } from "@/app/actions/organizations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Building2, Loader2 } from "lucide-react";
import Link from "next/link";

export default function NewOrganizationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
  });

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  };

  const handleNameChange = (name: string) => {
    setFormData({
      name,
      slug: formData.slug || generateSlug(name),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await createOrganization(formData);

      if (!result.success) {
        setError(result.error || "Failed to create organization");
        setLoading(false);
        return;
      }

      router.push(`/org/${result.organization?.slug}`);
    } catch (err) {
      setError("An unexpected error occurred");
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-2xl">
      <Link href="/organizations">
        <Button variant="ghost" className="mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Organizations
        </Button>
      </Link>

      <Card>
        <CardHeader>
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Building2 className="w-6 h-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-2xl">Create Organization</CardTitle>
              <CardDescription className="mt-1">
                Set up a new organization to collaborate with your team
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Organization Name</Label>
              <Input
                id="name"
                placeholder="Acme Inc"
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                required
                disabled={loading}
              />
              <p className="text-sm text-muted-foreground">
                The display name of your organization
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Organization Slug</Label>
              <div className="flex items-center">
                <span className="text-sm text-muted-foreground mr-2">
                  phishguard.com/org/
                </span>
                <Input
                  id="slug"
                  placeholder="acme-inc"
                  value={formData.slug}
                  onChange={(e) =>
                    setFormData({ ...formData, slug: e.target.value })
                  }
                  pattern="[a-z0-9-]+"
                  required
                  disabled={loading}
                  className="flex-1"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Lowercase letters, numbers, and hyphens only. This cannot be changed later.
              </p>
            </div>

            <div className="bg-muted p-4 rounded-lg">
              <h4 className="font-semibold mb-2 text-sm">What's included:</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>✓ Free plan with 3 team members</li>
                <li>✓ 500 scans per month</li>
                <li>✓ Basic ML detection</li>
                <li>✓ Team dashboard</li>
                <li>✓ Upgrade anytime for more features</li>
              </ul>
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/organizations")}
                disabled={loading}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Organization"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
