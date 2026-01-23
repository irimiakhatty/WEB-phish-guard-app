"use server";

import prisma from "@phish-guard-app/db";
import { auth } from "@phish-guard-app/auth";
import { revalidatePath } from "next/cache";

export async function signUpWithOrganization(data: {
  email: string;
  password: string;
  name: string;
  organizationName?: string;
  accountType: "personal" | "organization";
}) {
  // Common validations
  if (!data.email || !data.password || !data.name) {
    throw new Error("All fields are required");
  }

  if (data.accountType === "organization" && !data.organizationName) {
    throw new Error("Organization name is required for business accounts");
  }

  // Check user existence
  const existingUser = await prisma.user.findUnique({
    where: { email: data.email },
  });

  if (existingUser) {
    throw new Error("User already exists");
  }

  let createdUserId: string | null = null;

  try {
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
        message: "Account created successfully"
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
    throw new Error(error.message || "Failed to create account");
  }
}
