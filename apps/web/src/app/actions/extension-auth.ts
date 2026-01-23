"use server";

import prisma from "@phish-guard-app/db";
import { requireAuth } from "@/lib/auth-helpers";
import { getUserSubscriptionInfo } from "@/lib/subscription-helpers";

export async function getExtensionAuthData() {
  const { user } = await requireAuth();
  
  // Get detailed subscription info
  const subInfo = await getUserSubscriptionInfo(user.id);

  // Calculate usage for current period
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  let scansUsed = 0;
  
  if (subInfo.organizationId) {
     // Count all scans for the organization in this month
     scansUsed = await prisma.scan.count({
        where: {
            organizationId: subInfo.organizationId,
            createdAt: { gte: startOfMonth }
        }
     });
  } else {
     // Personal scans
     scansUsed = await prisma.scan.count({
        where: {
            userId: user.id,
            organizationId: null, // Personal
            createdAt: { gte: startOfMonth }
        }
     });
  }
  
  const limit = subInfo.limits.scansPerMonth;
  const scansRemaining = Math.max(0, limit - scansUsed);

  return {
    user: {
        id: user.id,
        email: user.email, 
        name: user.name,
        plan: subInfo.planId,
    },
    subscription: {
        scansRemaining, 
        limit
    }
  };
}
