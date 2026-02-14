"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "@tanstack/react-form";
import { toast } from "sonner";
import z from "zod";
import { Eye, EyeOff, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createFirstAdmin } from "@/app/actions/setup";
import { authClient } from "@/lib/auth-client";

export default function SetupAdminForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const form = useForm({
    defaultValues: {
      name: "",
      organizationName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
    onSubmit: async ({ value }) => {
      if (value.password !== value.confirmPassword) {
        toast.error("Passwords do not match");
        return;
      }

      setIsSubmitting(true);
      try {
        await createFirstAdmin({
          name: value.name,
          organizationName: value.organizationName,
          email: value.email,
          password: value.password,
        });

        toast.success("Organization admin created successfully! Logging in...");

        await authClient.signIn.email(
          {
            email: value.email,
            password: value.password,
          },
          {
            onSuccess: () => {
              router.push("/dashboard");
            },
            onError: () => {
              router.push("/login");
            },
          },
        );
      } catch (error: any) {
        toast.error(error.message || "Failed to create organization admin account");
        setIsSubmitting(false);
      }
    },
    validators: {
      onSubmit: z.object({
        name: z.string().min(2, "Name must be at least 2 characters"),
        organizationName: z.string().min(2, "Organization name must be at least 2 characters"),
        email: z.string().email("Invalid email address"),
        password: z.string().min(8, "Password must be at least 8 characters"),
        confirmPassword: z.string().min(8, "Password must be at least 8 characters"),
      }),
    },
  });

  return (
    <Card className="border-gray-200/70 dark:border-gray-800/70 shadow-xl bg-white/90 dark:bg-gray-900/80 backdrop-blur">
      <CardHeader className="space-y-3 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg">
          <Shield className="h-6 w-6" />
        </div>
        <CardTitle className="text-2xl font-semibold text-gray-900 dark:text-white">
          Create organization admin
        </CardTitle>
        <CardDescription className="text-sm">
          Set up the first admin for your organization workspace
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
            <form.Field name="name">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>Full Name</Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="John Doe"
                    disabled={isSubmitting}
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
            <form.Field name="organizationName">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>Organization Name</Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="Acme Corp"
                    disabled={isSubmitting}
                  />
                  {field.state.meta.errors.map((error) => (
                    <p key={error?.message} className="text-sm text-red-500">
                      {error?.message}
                    </p>
                  ))}
                  <p className="text-xs text-muted-foreground">
                    This creates the organization and assigns you as its admin.
                  </p>
                </div>
              )}
            </form.Field>
          </div>

          <div>
            <form.Field name="email">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>Email Address</Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="email"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="admin@example.com"
                    disabled={isSubmitting}
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
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="********"
                      disabled={isSubmitting}
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

          <div>
            <form.Field name="confirmPassword">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>Confirm Password</Label>
                  <div className="relative">
                    <Input
                      id={field.name}
                      name={field.name}
                      type={showConfirmPassword ? "text" : "password"}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="********"
                      disabled={isSubmitting}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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

          <Button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Creating Admin..." : "Create Org Admin Account"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
