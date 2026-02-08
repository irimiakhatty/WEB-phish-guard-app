"use client";

import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { acceptInviteSignUp } from "@/app/actions/organizations";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";

type Props = {
  token: string;
  email: string;
  orgSlug: string;
  orgName: string;
  role: string;
};

export default function AcceptInviteForm({ token, email, orgSlug, orgName, role }: Props) {
  const router = useRouter();

  const form = useForm({
    defaultValues: {
      name: "",
      password: "",
      confirm: "",
    },
    onSubmit: async ({ value }) => {
      if (value.password !== value.confirm) {
        toast.error("Passwords do not match");
        return;
      }
      try {
        const res = await acceptInviteSignUp({
          token,
          name: value.name,
          password: value.password,
        });

        if (!res.success) {
          if (res.code === "USER_EXISTS") {
            toast.error("Account already exists. Please sign in to accept the invite.");
            router.push(`/login?email=${encodeURIComponent(email)}&invite=${token}`);
            return;
          }
          toast.error(res.error || "Failed to accept invite");
          return;
        }

        // sign in newly created user
        await authClient.signIn.email(
          { email, password: value.password },
          {
            onSuccess: () => {
              toast.success("Welcome! You're now a member.");
              router.push(`/org/${orgSlug}`);
            },
            onError: (err) => {
              toast.error(err.error.message || "Account created, please log in.");
              router.push(`/login?email=${encodeURIComponent(email)}`);
            },
          }
        );
      } catch (err: any) {
        toast.error(err?.message || "Failed to accept invite");
        console.error(err);
      }
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Join {orgName}</CardTitle>
        <CardDescription>
          You are invited as <strong>{role}</strong>. Create your account to continue.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Email</Label>
          <Input value={email} disabled />
        </div>

        <form.Field name="name">
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor={field.name}>Full name</Label>
              <Input
                id={field.name}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                placeholder="Your name"
              />
            </div>
          )}
        </form.Field>

        <form.Field name="password">
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor={field.name}>Password</Label>
              <Input
                id={field.name}
                type="password"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                placeholder="Create a password"
              />
            </div>
          )}
        </form.Field>

        <form.Field name="confirm">
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor={field.name}>Confirm password</Label>
              <Input
                id={field.name}
                type="password"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                placeholder="Repeat password"
              />
            </div>
          )}
        </form.Field>

        <Button className="w-full" onClick={(e) => { e.preventDefault(); form.handleSubmit(); }}>
          Accept & Create Account
        </Button>
      </CardContent>
    </Card>
  );
}
