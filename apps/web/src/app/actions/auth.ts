"use server";

import prisma from "@phish-guard-app/db";
import { auth } from "@phish-guard-app/auth";

type SignUpResult =
  | { success: true; message: string }
  | { success: false; error: string; code?: string };

function toFriendlySignUpError(error: unknown): SignUpResult {
  const err = error as {
    code?: string;
    message?: string;
    meta?: { table?: string };
  };

  if (err?.code === "P2021" || err?.code === "P2022") {
    return {
      success: false,
      code: err.code,
      error:
        "Database schema is not initialized in production. Run Prisma db push/migrations, then redeploy.",
    };
  }

  if (err?.code === "P1001") {
    return {
      success: false,
      code: err.code,
      error: "Cannot connect to database. Verify DATABASE_URL in Vercel.",
    };
  }

  if (typeof err?.message === "string" && err.message.length > 0) {
    return {
      success: false,
      error: err.message,
      code: err.code,
    };
  }

  return {
    success: false,
    error: "Failed to create account. Please try again.",
  };
}

export async function signUpWithOrganization(data: {
  email: string;
  password: string;
  name: string;
  organizationName?: string;
  accountType: "personal" | "organization";
}): Promise<SignUpResult> {
  // Common validations
  if (!data.email || !data.password || !data.name) {
    return { success: false, error: "All fields are required" };
  }

  if (data.accountType === "organization" && !data.organizationName) {
    return {
      success: false,
      error: "Organization name is required for business accounts",
    };
  }

  let createdUserId: string | null = null;

  try {
    // Check user existence first. Keep this inside try so DB errors are returned
    // as user-friendly messages instead of bubbling as HTTP 500.
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      return { success: false, error: "User already exists" };
    }

    // Create user using better-auth API (server-side)
    const user = await auth.api.signUpEmail({
      body: {
        email: data.email,
        password: data.password,
        name: data.name,
      },
    });

    if (!user) {
      throw new Error("Failed to create user");
    }
    createdUserId = user.user.id;

    if (data.accountType === "organization" && data.organizationName) {
        const orgName = data.organizationName;
        const orgSlug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Date.now().toString().slice(-4);

        await prisma.organization.create({
            data: {
                name: orgName,
                slug: orgSlug,
                createdById: user.user.id,
                subscription: {
                    create: {
                        plan: "team_free",
                        status: "active",
                        maxMembers: 3,
                        scansPerMonth: 500,
                        scansPerHourPerUser: 25,
                        maxApiTokens: 1,
                        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
                    }
                },
                members: {
                    create: {
                        userId: user.user.id,
                        role: "admin",
                    }
                }
            }
        });
    } else {
        // Personal Account - Create Personal Subscription
        await prisma.personalSubscription.create({
            data: {
                userId: user.user.id,
                plan: "free",
                status: "active",
                scansPerMonth: 100,
                scansPerHour: 25,
                maxApiTokens: 1,
                currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
            }
        });
    }
    
    return {
      success: true,
      message: "Account created successfully",
    };

  } catch (error: any) {

    if (createdUserId) {
        try {
            await prisma.user.delete({ where: { id: createdUserId } });
        } catch (e) {
            console.error("Rollback failed", e);
        }
    }

    console.error("Sign up error:", error);
    return toFriendlySignUpError(error);
  }
}
