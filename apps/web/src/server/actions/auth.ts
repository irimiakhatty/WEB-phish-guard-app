"use server";

import prisma from "@phish-guard-app/db";
import { auth } from "@phish-guard-app/auth";
import { isPasswordStrong, PASSWORD_POLICY_ERROR } from "@/lib/auth/password-policy";
import { FREE_TRIAL_DAYS, getPlanById } from "@/lib/billing/subscription-plans";
import { sanitizeOrganizationName, toOrganizationNameKey } from "@/lib/shared/organization-name";

type SignUpResult =
  | { success: true; message: string }
  | { success: false; error: string; code?: string };

const FREE_TRIAL_MS = FREE_TRIAL_DAYS * 24 * 60 * 60 * 1000;

function toFriendlySignUpError(error: unknown): SignUpResult {
  const err = error as {
    code?: string;
    message?: string;
    meta?: { table?: string; target?: string[] };
  };
  const hasOrganizationNameUniqueViolation =
    err?.meta?.target?.some(
      (target) =>
        target === "nameNormalized" ||
        target === "name_normalized" ||
        target === "organization_name_normalized_key",
    ) ?? false;

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

  if (err?.code === "P2002" && hasOrganizationNameUniqueViolation) {
    return {
      success: false,
      code: err.code,
      error: "Organization name already exists. Choose a different name.",
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
  if (!isPasswordStrong(data.password)) {
    return { success: false, error: PASSWORD_POLICY_ERROR };
  }

  if (data.accountType === "organization" && !data.organizationName) {
    return {
      success: false,
      error: "Organization name is required for business accounts",
    };
  }

  const sanitizedOrganizationName =
    data.accountType === "organization" && data.organizationName
      ? sanitizeOrganizationName(data.organizationName)
      : null;
  const organizationNameKey =
    data.accountType === "organization" && data.organizationName
      ? toOrganizationNameKey(data.organizationName)
      : null;

  let createdUserId: string | null = null;

  try {
    if (data.accountType === "organization" && organizationNameKey) {
      const existingOrganization = await prisma.organization.findUnique({
        where: {
          nameNormalized: organizationNameKey,
        },
        select: { id: true },
      });

      if (existingOrganization) {
        return {
          success: false,
          error: "Organization name already exists. Choose a different name.",
        };
      }
    }

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

    if (
      data.accountType === "organization" &&
      sanitizedOrganizationName &&
      organizationNameKey
    ) {
        const teamTrialPlan = getPlanById("team_free");
        const teamTrialFeatures = teamTrialPlan.features as {
            maxMembers?: number;
            scansPerMonth?: number;
            scansPerHourPerUser?: number;
            maxApiTokens?: number;
        };
        const orgName = sanitizedOrganizationName;
        const orgSlug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Date.now().toString().slice(-4);

        await prisma.organization.create({
            data: {
                name: orgName,
                nameNormalized: organizationNameKey,
                slug: orgSlug,
                createdById: user.user.id,
                subscription: {
                    create: {
                        plan: "team_free",
                        status: "trialing",
                        maxMembers: teamTrialFeatures.maxMembers ?? 3,
                        scansPerMonth: teamTrialFeatures.scansPerMonth ?? 500,
                        scansPerHourPerUser: teamTrialFeatures.scansPerHourPerUser ?? 25,
                        maxApiTokens: teamTrialFeatures.maxApiTokens ?? 1,
                        currentPeriodEnd: new Date(Date.now() + FREE_TRIAL_MS),
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
        const personalTrialPlan = getPlanById("free");
        const personalTrialFeatures = personalTrialPlan.features as {
            scansPerMonth?: number;
            scansPerHour?: number;
            maxApiTokens?: number;
        };
        await prisma.personalSubscription.create({
            data: {
                userId: user.user.id,
                plan: "free",
                status: "trialing",
                scansPerMonth: personalTrialFeatures.scansPerMonth ?? 100,
                scansPerHour: personalTrialFeatures.scansPerHour ?? 25,
                maxApiTokens: personalTrialFeatures.maxApiTokens ?? 1,
                currentPeriodEnd: new Date(Date.now() + FREE_TRIAL_MS),
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
