"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createOrganization } from "@/server/actions/organizations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Building2, CheckCircle2, Loader2, ShieldCheck, Sparkles, Users } from "lucide-react";
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
    <div className="min-h-screen bg-background">
      <div className="relative isolate overflow-hidden">
        <div className="mx-auto w-full max-w-[1680px] px-6 py-10 sm:px-8 sm:py-14 lg:px-12">
          <Button asChild variant="ghost" className="mb-8 w-fit px-3">
            <Link href="/organizations">
              <ArrowLeft className="size-4" />
              Back to Organizations
            </Link>
          </Button>

          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)] lg:items-start">
            <section className="max-w-2xl space-y-8">
              <div className="space-y-5">
                <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground shadow-sm backdrop-blur">
                  <Building2 className="size-3.5" />
                  Team Workspace
                </div>
                <div className="space-y-3">
                  <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
                    Create a workspace your team can recognize instantly.
                  </h1>
                  <p className="max-w-lg text-base leading-7 text-muted-foreground sm:text-lg">
                    Start with a clean organization name and a short slug. We will use it across invites,
                    navigation, and your shared security workspace.
                  </p>
                </div>
              </div>

              <ul className="space-y-4 text-sm text-muted-foreground">
                <li className="flex gap-3">
                  <Users className="mt-0.5 size-4 text-foreground" />
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">Invite your team</p>
                    <p className="leading-6">
                      Add up to 3 members during the trial and keep everyone in one workspace.
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <ShieldCheck className="mt-0.5 size-4 text-foreground" />
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">Shared protection</p>
                    <p className="leading-6">
                      Centralize live inbox checks, shared scans, and your team dashboard.
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <Sparkles className="mt-0.5 size-4 text-foreground" />
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">Upgrade anytime</p>
                    <p className="leading-6">
                      Start lean now and expand as the team grows or needs more automation.
                    </p>
                  </div>
                </li>
              </ul>
            </section>

            <Card>
              <CardHeader className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
                    <Building2 className="size-5" />
                  </div>
                  <div className="space-y-2">
                    <CardTitle className="text-2xl font-semibold tracking-tight">
                      Create Organization
                    </CardTitle>
                    <CardDescription className="max-w-md text-sm leading-6">
                      Set up the core details once, then invite teammates and start monitoring together.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                  {error && (
                    <Alert
                      variant="destructive"
                      className="border-destructive/30 bg-destructive/5 text-foreground"
                    >
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-5">
                    <div className="space-y-2.5">
                      <Label htmlFor="name">Organization Name</Label>
                      <Input
                        id="name"
                        placeholder="Acme Inc"
                        value={formData.name}
                        onChange={(e) => handleNameChange(e.target.value)}
                        required
                        disabled={loading}
                      />
                      <p className="text-sm leading-6 text-muted-foreground">
                        Use the name your team already recognizes internally.
                      </p>
                    </div>

                    <div className="space-y-2.5">
                      <Label htmlFor="slug">Organization Slug</Label>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="rounded-xl border border-border/70 bg-muted/40 px-3 py-2 text-sm font-medium text-muted-foreground">
                          phishguard.com/org/
                        </div>
                        <Input
                          id="slug"
                          placeholder="acme-inc"
                          value={formData.slug}
                          onChange={(e) =>
                            setFormData({ ...formData, slug: e.target.value })
                          }
                          pattern="[a-z0-9]+(-[a-z0-9]+)*"
                          required
                          disabled={loading}
                          className="flex-1"
                        />
                      </div>
                      <p className="text-sm leading-6 text-muted-foreground">
                        Lowercase letters, numbers, and hyphens only. This address cannot be changed later.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="size-4.5 text-foreground" />
                      <h4 className="text-sm font-semibold text-foreground">What's included on day one</h4>
                    </div>
                    <ul className="space-y-3 text-sm text-muted-foreground">
                      <li className="flex items-start gap-3">
                        <CheckCircle2 className="mt-0.5 size-4 text-foreground" />
                        <span>30-day team trial for up to 3 members</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <CheckCircle2 className="mt-0.5 size-4 text-foreground" />
                        <span>Live inbox checks with limited shared scans during trial</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <CheckCircle2 className="mt-0.5 size-4 text-foreground" />
                        <span>Basic ML detection and a shared team dashboard</span>
                      </li>
                    </ul>
                  </div>

                  <div className="flex flex-col-reverse gap-3 sm:flex-row">
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
                          <Loader2 className="size-4 animate-spin" />
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
        </div>
      </div>
    </div>
  );
}


