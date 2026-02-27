"use server";

import prisma from "@phish-guard-app/db";
import { auth } from "@phish-guard-app/auth";
import { requireAdmin } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import { hash } from "@node-rs/argon2";
import { randomUUID } from "crypto";
import { isPasswordStrong, PASSWORD_POLICY_ERROR } from "@/lib/password-policy";

/**
 * Admin creates a new user
 */
export async function createUserByAdmin(data: {
  email: string;
  password: string;
  name: string;
  role: "user" | "admin";
}) {
  await requireAdmin();

  // Validate input
  if (!data.email || !data.password || !data.name) {
    throw new Error("All fields are required");
  }

  if (!isPasswordStrong(data.password)) {
    throw new Error(PASSWORD_POLICY_ERROR);
  }

  // Check if email is already taken
  const existingUser = await prisma.user.findUnique({
    where: { email: data.email },
  });

  if (existingUser) {
    throw new Error("This email is already registered");
  }

  try {
    // Hash password using argon2 (same as better-auth)
    const hashedPassword = await hash(data.password, {
      memoryCost: 19456,
      timeCost: 2,
      outputLen: 32,
      parallelism: 1,
    });

    // Generate unique ID
    const userId = randomUUID();

    // Create user directly in database without creating a session
    const user = await prisma.user.create({
      data: {
        id: userId,
        email: data.email,
        name: data.name,
        role: data.role,
        emailVerified: true,
      },
    });

    // Create account record with hashed password
    await prisma.account.create({
      data: {
        id: randomUUID(),
        userId: user.id,
        accountId: user.id,
        providerId: "credential",
        password: hashedPassword,
      },
    });

    revalidatePath("/admin/users");
    
    return {
      success: true,
      message: `User ${data.email} created successfully as ${data.role}`,
    };
  } catch (error: any) {
    console.error("Error creating user:", error);
    throw new Error(error.message || "Failed to create user account");
  }
}
