import type { Route } from "next";
import { useEffect, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import z from "zod";
import { ArrowLeft, Building2, Eye, EyeOff, Shield, User } from "lucide-react";

import { signUpWithOrganization } from "@/server/actions/auth";
import { authClient } from "@/lib/auth/auth-client";
import {
  getPasswordRuleStates,
  isPasswordStrong,
  PASSWORD_MIN_LENGTH,
  PASSWORD_POLICY_ERROR,
} from "@/lib/auth/password-policy";

import Loader from "./loader";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";

const signUpSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.email("Invalid email address"),
    password: z
      .string()
      .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
      .refine(isPasswordStrong, PASSWORD_POLICY_ERROR),
    accountType: z.enum(["personal", "organization"]),
    organizationName: z.string(),
  })
  .superRefine((data, ctx) => {
    if (
      data.accountType === "organization" &&
      data.organizationName.trim().length < 2
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Organization name is required",
        path: ["organizationName"],
      });
    }
  });

function getErrorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "Invalid value";
}

function resolveSafeNextPath(raw: string | null, fallback: string): string {
  if (!raw || !raw.startsWith("/")) {
    return fallback;
  }

  return raw;
}

export default function SignUpForm({
  onSwitchToSignIn,
  defaultAccountType = "personal",
}: {
  onSwitchToSignIn: () => void;
  defaultAccountType?: "personal" | "organization";
}) {
  const formId = "phishguard-sign-up-form";
  const router = useRouter();
  const { isPending } = authClient.useSession();
  const [showPassword, setShowPassword] = useState(false);

  // Prefill from query params (invite flow)
  const searchParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const inviteEmail = searchParams.get("email") || "";
  const inviteOrg = searchParams.get("org");
  const isInvite = Boolean(searchParams.get("invite"));
  const nextPath = searchParams.get("next") || searchParams.get("redirect");

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
        const signUpResult = await signUpWithOrganization({
          email: value.email,
          password: value.password,
          name: value.name,
          organizationName: value.organizationName,
          accountType: value.accountType,
        });

        if (!signUpResult.success) {
          toast.error(signUpResult.error);
          return;
        }

        await authClient.signIn.email(
          {
            email: value.email,
            password: value.password,
          },
          {
            onSuccess: () => {
              const fallbackPath =
                value.accountType === "organization"
                  ? "/subscriptions/business"
                  : "/subscriptions/personal";
              router.push(resolveSafeNextPath(nextPath, fallbackPath) as Route);
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
      onSubmit: signUpSchema,
    },
  });

  useEffect(() => {
    form.setFieldValue("accountType", defaultAccountType);
  }, [defaultAccountType, form]);

  if (isPending) {
    return <Loader />;
  }

  return (
    <Card className="gap-4 border border-white/10 bg-white/5 shadow-2xl shadow-black/60 backdrop-blur-sm max-h-[calc(100svh-10rem)]">
      <CardHeader className="space-y-2 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-white/5 text-cyan-100">
          <Shield className="h-6 w-6" />
        </div>
        <CardTitle className="text-2xl font-semibold text-white">
          Create your account
        </CardTitle>
        <CardDescription className="text-sm text-zinc-300">
          Choose your account type and get started in minutes
        </CardDescription>
      </CardHeader>
      <CardContent className="min-h-0 overflow-y-auto">
        <form
          id={formId}
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
          className="space-y-3"
        >
          <div>
            <form.Field name="accountType">
              {(field) => (
                <div className="mb-1 grid grid-cols-2 gap-3">
                  <div
                    className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border p-3 transition-all ${
                      field.state.value === "personal"
                        ? "border-zinc-900 bg-zinc-100 ring-1 ring-zinc-900 dark:border-zinc-100 dark:bg-zinc-900/60 dark:ring-zinc-100"
                        : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-500"
                    }`}
                    onClick={() => field.handleChange("personal")}
                  >
                    <User
                      className={`h-5 w-5 ${
                        field.state.value === "personal"
                          ? "text-zinc-900 dark:text-zinc-100"
                          : "text-zinc-500"
                      }`}
                    />
                    <span
                      className={`text-sm font-medium leading-none ${
                        field.state.value === "personal"
                          ? "text-zinc-900 dark:text-zinc-100"
                          : "text-zinc-600 dark:text-zinc-400"
                      }`}
                    >
                      Personal
                    </span>
                  </div>
                  <div
                    className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border p-3 transition-all ${
                      field.state.value === "organization"
                        ? "border-zinc-900 bg-zinc-100 ring-1 ring-zinc-900 dark:border-zinc-100 dark:bg-zinc-900/60 dark:ring-zinc-100"
                        : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-500"
                    }`}
                    onClick={() => field.handleChange("organization")}
                  >
                    <Building2
                      className={`h-5 w-5 ${
                        field.state.value === "organization"
                          ? "text-zinc-900 dark:text-zinc-100"
                          : "text-zinc-500"
                      }`}
                    />
                    <span
                      className={`text-sm font-medium leading-none ${
                        field.state.value === "organization"
                          ? "text-zinc-900 dark:text-zinc-100"
                          : "text-zinc-600 dark:text-zinc-400"
                      }`}
                    >
                      Organization
                    </span>
                  </div>
                </div>
              )}
            </form.Field>
          </div>

          <form.Subscribe selector={(state) => state.values.accountType}>
              {(accountType) =>
                accountType === "organization" ? (
                <div className="rounded-lg border border-zinc-300/80 bg-zinc-100/80 px-4 py-3 text-sm text-zinc-900 dark:border-zinc-700/80 dark:bg-zinc-900/40 dark:text-zinc-100">
                  <p className="font-medium">Organization setup</p>
                  <p className="mt-1 text-zinc-700 dark:text-zinc-300">
                    Create the workspace and become the first admin. Invite members and manage settings after sign up.
                  </p>
                </div>
              ) : null
            }
          </form.Subscribe>

          <div>
            <form.Field name="name">
              {(field) => (
                <div className="space-y-1.5">
                  <Label htmlFor={field.name}>Full Name</Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    placeholder="John Doe"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                  {field.state.meta.errors.map((error, idx) => (
                    <p key={idx} className="text-sm text-red-500">
                      {getErrorMessage(error)}
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
                      <div className="space-y-1.5">
                        <Label htmlFor={field.name}>Organization Name</Label>
                        <Input
                          id={field.name}
                          name={field.name}
                          placeholder="My Company Ltd."
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                        />
                        {field.state.meta.errors.map((error, idx) => (
                          <p key={idx} className="text-sm text-red-500">
                            {getErrorMessage(error)}
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
                <div className="space-y-1.5">
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
                  {field.state.meta.errors.map((error, idx) => (
                    <p key={idx} className="text-sm text-red-500">
                      {getErrorMessage(error)}
                    </p>
                  ))}
                </div>
              )}
            </form.Field>
          </div>

          <div>
            <form.Field name="password">
              {(field) => (
                <div className="space-y-1.5">
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
                  <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
                    {getPasswordRuleStates(field.state.value).map((rule) => (
                      <li
                        key={rule.id}
                        className={`flex items-center gap-2 text-[11px] ${
                          rule.passed
                            ? "text-emerald-700 dark:text-emerald-400"
                            : "text-muted-foreground"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            rule.passed ? "bg-emerald-500" : "bg-gray-400"
                          }`}
                        />
                        {rule.label}
                      </li>
                    ))}
                  </ul>
                  {field.state.meta.errors.map((error, idx) => (
                    <p key={idx} className="text-sm text-red-500">
                      {getErrorMessage(error)}
                    </p>
                  ))}
                </div>
              )}
            </form.Field>
          </div>

        </form>

        <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
          {([canSubmit, isSubmitting]) => (
            <div className="sticky bottom-0 -mx-6 mt-4 border-t border-white/10 bg-black/50 px-6 pb-1 pt-4 backdrop-blur-sm">
              <Button
                type="submit"
                form={formId}
                className="w-full"
                disabled={!canSubmit || isSubmitting}
              >
                {isSubmitting ? "Creating account..." : "Sign Up"}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={onSwitchToSignIn}
                className="mt-3 w-full border-white/15 bg-transparent text-white hover:bg-white/5"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to sign in
              </Button>
            </div>
          )}
        </form.Subscribe>
      </CardContent>
    </Card>
  );
}

