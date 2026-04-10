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
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(9,9,11,0.08),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(9,9,11,0.05),transparent_32%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(250,250,250,0.09),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(250,250,250,0.06),transparent_28%)]" />
        <div className="container mx-auto max-w-6xl px-4 py-10 sm:py-14">
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

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm backdrop-blur">
                  <Users className="mb-3 size-5 text-foreground" />
                  <p className="text-sm font-semibold text-foreground">Invite your team</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Add up to 3 members during the trial and get everyone into one workspace.
                  </p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm backdrop-blur">
                  <ShieldCheck className="mb-3 size-5 text-foreground" />
                  <p className="text-sm font-semibold text-foreground">Shared protection</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Centralize live inbox checks, shared scans, and your team dashboard.
                  </p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm backdrop-blur">
                  <Sparkles className="mb-3 size-5 text-foreground" />
                  <p className="text-sm font-semibold text-foreground">Upgrade anytime</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Start lean now and expand as the team grows or needs more automation.
                  </p>
                </div>
              </div>

              <div className="rounded-3xl border border-border/70 bg-card/85 p-6 shadow-lg shadow-black/5 backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Workspace URL Preview
                </p>
                <p className="mt-3 text-lg font-semibold tracking-tight text-foreground sm:text-2xl">
                  phishguard.com/org/{formData.slug || "your-team"}
                </p>
                <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
                  Keep the slug short, memorable, and close to your organization name. It becomes the
                  address your teammates will recognize first.
                </p>
              </div>
            </section>

            <Card className="border-border/70 bg-card/90 shadow-2xl shadow-black/8 backdrop-blur">
              <CardHeader className="space-y-6 border-b border-border/70 pb-6">
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

                  <div className="rounded-2xl border border-border/70 bg-muted/35 p-5">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="size-4.5 text-foreground" />
                      <h4 className="text-sm font-semibold text-foreground">What's included on day one</h4>
                    </div>
                    <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
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


