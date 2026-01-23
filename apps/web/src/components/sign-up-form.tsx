import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import z from "zod";
import { Building2, User } from "lucide-react";

import { signUpWithOrganization } from "@/app/actions/auth";
import { authClient } from "@/lib/auth-client";

import Loader from "./loader";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";

export default function SignUpForm({ onSwitchToSignIn }: { onSwitchToSignIn: () => void }) {
  const router = useRouter();
  const { isPending } = authClient.useSession();

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
      name: "",
      organizationName: "",
      accountType: "personal" as "personal" | "organization",
    },
    onSubmit: async ({ value }) => {
      try {
        // Create user and organization on server
        await signUpWithOrganization({
          email: value.email,
          password: value.password,
          name: value.name,
          organizationName: value.organizationName,
          accountType: value.accountType,
        });

        // Sign in on client to establish session
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
      onSubmit: z.object({
        name: z.string().min(2, "Name must be at least 2 characters"),
        email: z.email("Invalid email address"),
        password: z.string().min(8, "Password must be at least 8 characters"),
        accountType: z.enum(["personal", "organization"]),
        organizationName: z.string().optional(),
      }).superRefine((data, ctx) => {
        if (data.accountType === "organization" && (!data.organizationName || data.organizationName.length < 2)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Organization name is required",
            path: ["organizationName"],
          });
        }
      }),
    },
  });

  if (isPending) {
    return <Loader />;
  }

  return (
    <div className="flex items-center justify-center py-16 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2 text-center">
          <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white">Create an account</CardTitle>
          <CardDescription>
            Enter your information to get started with PhishGuard
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
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div
                      className={`cursor-pointer border rounded-lg p-4 flex flex-col items-center justify-center gap-2 transition-all ${
                        field.state.value === "personal"
                          ? "border-blue-600 bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-600"
                          : "border-gray-200 hover:border-blue-400 dark:border-gray-700"
                      }`}
                      onClick={() => field.handleChange("personal")}
                    >
                      <User className={`h-6 w-6 ${field.state.value === "personal" ? "text-blue-600" : "text-gray-500"}`} />
                      <span className={`text-sm font-medium ${field.state.value === "personal" ? "text-blue-900 dark:text-blue-100" : "text-gray-600 dark:text-gray-400"}`}>Personal</span>
                    </div>
                    <div
                      className={`cursor-pointer border rounded-lg p-4 flex flex-col items-center justify-center gap-2 transition-all ${
                        field.state.value === "organization"
                          ? "border-blue-600 bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-600"
                          : "border-gray-200 hover:border-blue-400 dark:border-gray-700"
                      }`}
                      onClick={() => field.handleChange("organization")}
                    >
                      <Building2 className={`h-6 w-6 ${field.state.value === "organization" ? "text-blue-600" : "text-gray-500"}`} />
                      <span className={`text-sm font-medium ${field.state.value === "organization" ? "text-blue-900 dark:text-blue-100" : "text-gray-600 dark:text-gray-400"}`}>Organization</span>
                    </div>
                  </div>
                )}
              </form.Field>
            </div>

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
                          <p className="text-[0.8rem] text-muted-foreground">
                            This will create a new organization where you are the admin.
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
                    <Input
                      id={field.name}
                      name={field.name}
                      type="password"
                      placeholder="••••••••"
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

          <div className="mt-6 text-center text-sm">
            <span className="text-gray-600 dark:text-gray-400">Already have an account? </span>
            <Button
              variant="link"
              onClick={onSwitchToSignIn}
              className="p-0 h-auto font-semibold"
            >
              Sign in
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
