import { useEffect, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import z from "zod";
import { ArrowLeft, Building2, Eye, EyeOff, Shield, User } from "lucide-react";

import { signUpWithOrganization } from "@/app/actions/auth";
import { authClient } from "@/lib/auth-client";
import {
  getPasswordRuleStates,
  isPasswordStrong,
  PASSWORD_MIN_LENGTH,
  PASSWORD_POLICY_ERROR,
} from "@/lib/password-policy";

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
    <Card className="border-zinc-200/80 bg-card shadow-xl dark:border-zinc-800/80">
      <CardHeader className="space-y-3 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900">
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
                        ? "border-zinc-900 bg-zinc-100 ring-1 ring-zinc-900 dark:border-zinc-100 dark:bg-zinc-900/60 dark:ring-zinc-100"
                        : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-500"
                    }`}
                    onClick={() => field.handleChange("personal")}
                  >
                    <User
                      className={`h-6 w-6 ${
                        field.state.value === "personal"
                          ? "text-zinc-900 dark:text-zinc-100"
                          : "text-zinc-500"
                      }`}
                    />
                    <span
                      className={`text-sm font-medium ${
                        field.state.value === "personal"
                          ? "text-zinc-900 dark:text-zinc-100"
                          : "text-zinc-600 dark:text-zinc-400"
                      }`}
                    >
                      Personal
                    </span>
                  </div>
                  <div
                    className={`cursor-pointer border rounded-lg p-4 flex flex-col items-center justify-center gap-2 transition-all ${
                      field.state.value === "organization"
                        ? "border-zinc-900 bg-zinc-100 ring-1 ring-zinc-900 dark:border-zinc-100 dark:bg-zinc-900/60 dark:ring-zinc-100"
                        : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-500"
                    }`}
                    onClick={() => field.handleChange("organization")}
                  >
                    <Building2
                      className={`h-6 w-6 ${
                        field.state.value === "organization"
                          ? "text-zinc-900 dark:text-zinc-100"
                          : "text-zinc-500"
                      }`}
                    />
                    <span
                      className={`text-sm font-medium ${
                        field.state.value === "organization"
                          ? "text-zinc-900 dark:text-zinc-100"
                          : "text-zinc-600 dark:text-zinc-400"
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
                <div className="rounded-lg border border-zinc-300/80 bg-zinc-100/80 px-4 py-3 text-sm text-zinc-900 dark:border-zinc-700/80 dark:bg-zinc-900/40 dark:text-zinc-100">
                  <p className="font-medium">Organization admin setup</p>
                  <p className="mt-1 text-zinc-700 dark:text-zinc-300">
                    You will create the organization workspace and become its first admin.
                  </p>
                  <p className="mt-1 text-zinc-700 dark:text-zinc-300">
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
                  <ul className="mt-2 space-y-1">
                    {getPasswordRuleStates(field.state.value).map((rule) => (
                      <li
                        key={rule.id}
                        className={`flex items-center gap-2 text-xs ${
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

          <form.Subscribe>
            {(state) => (
              <Button
                type="submit"
                className="w-full"
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
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to sign in
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
