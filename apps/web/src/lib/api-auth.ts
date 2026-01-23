import prisma from "@phish-guard-app/db";
import { headers } from "next/headers";
import crypto from "crypto";
import { getUserSubscriptionInfo } from "./subscription-helpers";

/**
 * Rate limiting state (in-memory for simplicity)
 * In production, use Redis or a proper rate limiting service
 */
const rateLimitStore = new Map<string, { count: number; resetAt: Date }>();

export interface ApiAuthResult {
  authorized: boolean;
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
  error?: string;
  remaining?: number;
}

/**
 * Generate a secure API token
 */
export function generateApiToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Verify API token and check rate limits
 */
export async function verifyApiToken(): Promise<ApiAuthResult> {
  const headersList = await headers();
  const authHeader = headersList.get("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      authorized: false,
      error: "Missing or invalid authorization header",
    };
  }

  const token = authHeader.substring(7); // Remove "Bearer "

  try {
    // Find the token in the database
    const apiToken = await prisma.apiToken.findUnique({
      where: { token },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
          },
        },
      },
    });

    if (!apiToken) {
      return {
        authorized: false,
        error: "Invalid API token",
      };
    }

    // Check if token is expired
    if (apiToken.expiresAt && apiToken.expiresAt < new Date()) {
      return {
        authorized: false,
        error: "API token has expired",
      };
    }

    // Get subscription info for dynamic rate limits
    const subInfo = await getUserSubscriptionInfo(apiToken.userId);
    const hourlyLimit = subInfo.limits.scansPerHour;

    // Rate limiting check (based on subscription plan)
    const now = new Date();
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Check if we need to reset the counter
    if (apiToken.lastResetAt < hourAgo) {
      // Reset the counter
      await prisma.apiToken.update({
        where: { id: apiToken.id },
        data: {
          requestCount: 1,
          lastResetAt: now,
          lastUsedAt: now,
        },
      });

      return {
        authorized: true,
        user: apiToken.user,
        remaining: hourlyLimit - 1,
      };
    }

    // Check if rate limit is exceeded (using subscription-based limit)
    if (apiToken.requestCount >= hourlyLimit) {
      const resetIn = Math.ceil(
        (apiToken.lastResetAt.getTime() + 60 * 60 * 1000 - now.getTime()) /
          1000 / 60
      );

      return {
        authorized: false,
        error: `Rate limit exceeded for your plan. Resets in ${resetIn} minutes.`,
      };
    }

    // Increment the counter
    await prisma.apiToken.update({
      where: { id: apiToken.id },
      data: {
        requestCount: apiToken.requestCount + 1,
        lastUsedAt: now,
      },
    });

    return {
      authorized: true,
      user: apiToken.user,
      remaining: hourlyLimit - apiToken.requestCount - 1,
    };
  } catch (error) {
    console.error("API auth error:", error);
    return {
      authorized: false,
      error: "Authentication failed",
    };
  }
}

/**
 * Create an API token for a user
 */
export async function createApiToken(
  userId: string,
  name: string = "Chrome Extension",
  expiresInDays?: number
): Promise<string> {
  const token = generateApiToken();
  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  await prisma.apiToken.create({
    data: {
      token,
      name,
      userId,
      createdById: userId,
      expiresAt,
      hourlyLimit: 100,
    },
  });

  return token;
}

/**
 * Revoke an API token
 */
export async function revokeApiToken(token: string): Promise<boolean> {
  try {
    await prisma.apiToken.delete({
      where: { token },
    });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * List all API tokens for a user
 */
export async function listUserApiTokens(userId: string) {
  return await prisma.apiToken.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      token: true,
      expiresAt: true,
      lastUsedAt: true,
      requestCount: true,
      hourlyLimit: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}
