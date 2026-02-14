import { useEffect, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import z from "zod";
import { Building2, Eye, EyeOff, Shield, User } from "lucide-react";

import { signUpWithOrganization } from "@/app/actions/auth";
import { authClient } from "@/lib/auth-client";

import Loader from "./loader";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";

export default function SignUpForm({
  onSwitchToSignIn,
  defaultAccountType = "personal",
}: {
  onSwitchToSignIn: () => void;
  defaultAccountType?: "personal" | "organization";
}) {
  const router = useRouter();
  const { isPending } = authClient.useSession();
  const [showPassword, setShowPassword] = useState(false);

  // Prefill from query params (invite flow)
  const searchParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const inviteEmail = searchParams.get("email") || "";
  const inviteOrg = searchParams.get("org");
  const isInvite = Boolean(searchParams.get("invite"));

  const form = useForm({
    defaultValues: {
      email: inviteEmail,
      password: "",
      name: "",
      organizationName: inviteOrg || "",
      accountType: inviteOrg ? "organization" : (defaultAccountType as "personal" | "organization"),
    },
    onSubmit: async ({ value }) => {
      try {
        await signUpWithOrganization({
          email: value.email,
          password: value.password,
          name: value.name,
          organizationName: value.organizationName,
          accountType: value.accountType,
        });

        await authClient.signIn.email(
          {
            email: value.email,
            password: value.password,
          },
          {
            onSuccess: () => {
              router.push("/dashboard");
              toast.success("Account created successfully");
            },
            onError: (error) => {
              toast.error(error.error.message || error.error.statusText);
            },
          },
        );
      } catch (error: any) {
        toast.error(error.message || "Failed to create account");
      }
    },
    validators: {
      onSubmit: z
        .object({
          name: z.string().min(2, "Name must be at least 2 characters"),
          email: z.email("Invalid email address"),
          password: z.string().min(8, "Password must be at least 8 characters"),
          accountType: z.enum(["personal", "organization"]),
          organizationName: z.string().optional(),
        })
        .superRefine((data, ctx) => {
          if (
            data.accountType === "organization" &&
            (!data.organizationName || data.organizationName.length < 2)
          ) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Organization name is required",
              path: ["organizationName"],
            });
          }
        }),
    },
  });

  useEffect(() => {
    form.setFieldValue("accountType", defaultAccountType);
  }, [defaultAccountType, form]);

  if (isPending) {
    return <Loader />;
  }

  return (
    <Card className="border-gray-200/70 dark:border-gray-800/70 shadow-xl bg-white/90 dark:bg-gray-900/80 backdrop-blur">
      <CardHeader className="space-y-3 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg">
          <Shield className="h-6 w-6" />
        </div>
        <CardTitle className="text-2xl font-semibold text-gray-900 dark:text-white">
          Create your account
        </CardTitle>
        <CardDescription className="text-sm">
          Choose your account type and get started in minutes
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
          className="space-y-4"
        >
          <div>
            <form.Field name="accountType">
              {(field) => (
                <div className="grid grid-cols-2 gap-3 mb-2">
                  <div
                    className={`cursor-pointer border rounded-lg p-4 flex flex-col items-center justify-center gap-2 transition-all ${
                      field.state.value === "personal"
                        ? "border-blue-600 bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-600"
                        : "border-gray-200 hover:border-blue-400 dark:border-gray-700"
                    }`}
                    onClick={() => field.handleChange("personal")}
                  >
                    <User
                      className={`h-6 w-6 ${
                        field.state.value === "personal"
                          ? "text-blue-600"
                          : "text-gray-500"
                      }`}
                    />
                    <span
                      className={`text-sm font-medium ${
                        field.state.value === "personal"
                          ? "text-blue-900 dark:text-blue-100"
                          : "text-gray-600 dark:text-gray-400"
                      }`}
                    >
                      Personal
                    </span>
                  </div>
                  <div
                    className={`cursor-pointer border rounded-lg p-4 flex flex-col items-center justify-center gap-2 transition-all ${
                      field.state.value === "organization"
                        ? "border-blue-600 bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-600"
                        : "border-gray-200 hover:border-blue-400 dark:border-gray-700"
                    }`}
                    onClick={() => field.handleChange("organization")}
                  >
                    <Building2
                      className={`h-6 w-6 ${
                        field.state.value === "organization"
                          ? "text-blue-600"
                          : "text-gray-500"
                      }`}
                    />
                    <span
                      className={`text-sm font-medium ${
                        field.state.value === "organization"
                          ? "text-blue-900 dark:text-blue-100"
                          : "text-gray-600 dark:text-gray-400"
                      }`}
                    >
                      Organization Admin
                    </span>
                  </div>
                </div>
              )}
            </form.Field>
          </div>

          <form.Subscribe selector={(state) => state.values.accountType}>
            {(accountType) =>
              accountType === "organization" ? (
                <div className="rounded-lg border border-blue-200/70 bg-blue-50/80 px-4 py-3 text-sm text-blue-900">
                  <p className="font-medium">Organization admin setup</p>
                  <p className="mt-1 text-blue-700">
                    You will create the organization workspace and become its first admin.
                  </p>
                  <p className="mt-1 text-blue-700">
                    After sign up, you can invite members and manage security settings.
                  </p>
                </div>
              ) : null
            }
          </form.Subscribe>

          <div>
            <form.Field name="name">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>Full Name</Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    placeholder="John Doe"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                  {field.state.meta.errors.map((error) => (
                    <p key={error?.message} className="text-sm text-red-500">
                      {error?.message}
                    </p>
                  ))}
                </div>
              )}
            </form.Field>
          </div>

          <form.Subscribe selector={(state) => state.values.accountType}>
            {(accountType) =>
              accountType === "organization" ? (
                <div>
                  <form.Field name="organizationName">
                    {(field) => (
                      <div className="space-y-2">
                        <Label htmlFor={field.name}>Organization Name</Label>
                        <Input
                          id={field.name}
                          name={field.name}
                          placeholder="My Company Ltd."
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                        />
                        {field.state.meta.errors.map((error) => (
                          <p key={error?.message} className="text-sm text-red-500">
                            {error?.message}
                          </p>
                        ))}
                        <p className="text-xs text-muted-foreground">
                          This creates a new organization and sets you as the admin.
                        </p>
                      </div>
                    )}
                  </form.Field>
                </div>
              ) : null
            }
          </form.Subscribe>

          <div>
            <form.Field name="email">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>Email</Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="email"
                    placeholder="you@example.com"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                  {field.state.meta.errors.map((error) => (
                    <p key={error?.message} className="text-sm text-red-500">
                      {error?.message}
                    </p>
                  ))}
                </div>
              )}
            </form.Field>
          </div>

          <div>
            <form.Field name="password">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>Password</Label>
                  <div className="relative">
                    <Input
                      id={field.name}
                      name={field.name}
                      type={showPassword ? "text" : "password"}
                      placeholder="********"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {field.state.meta.errors.map((error) => (
                    <p key={error?.message} className="text-sm text-red-500">
                      {error?.message}
                    </p>
                  ))}
                </div>
              )}
            </form.Field>
          </div>

          <form.Subscribe>
            {(state) => (
              <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700"
                disabled={!state.canSubmit || state.isSubmitting}
              >
                {state.isSubmitting ? "Creating account..." : "Sign Up"}
              </Button>
            )}
          </form.Subscribe>
        </form>

        <div className="mt-6">
          <Button
            variant="outline"
            onClick={onSwitchToSignIn}
            className="w-full"
          >
            Back to sign in
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
