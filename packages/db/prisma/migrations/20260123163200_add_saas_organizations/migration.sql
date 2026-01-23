/*
  Warnings:

  - You are about to drop the column `hourlyLimit` on the `api_token` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `api_token` table. All the data in the column will be lost.
  - Added the required column `createdById` to the `api_token` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organizationId` to the `api_token` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "api_token" DROP CONSTRAINT "api_token_userId_fkey";

-- DropIndex
DROP INDEX "api_token_userId_idx";

-- AlterTable
ALTER TABLE "api_token" DROP COLUMN "hourlyLimit",
DROP COLUMN "userId",
ADD COLUMN     "createdById" TEXT NOT NULL,
ADD COLUMN     "organizationId" TEXT NOT NULL,
ALTER COLUMN "name" SET DEFAULT 'API Token';

-- AlterTable
ALTER TABLE "scan" ADD COLUMN     "organizationId" TEXT,
ADD COLUMN     "source" TEXT;

-- CreateTable
CREATE TABLE "organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "domain" TEXT,
    "logo" TEXT,
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_member" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_invite" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "token" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_invite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "status" TEXT NOT NULL DEFAULT 'active',
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "stripePriceId" TEXT,
    "currentPeriodStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "canceledAt" TIMESTAMP(3),
    "maxMembers" INTEGER NOT NULL DEFAULT 5,
    "scansPerMonth" INTEGER NOT NULL DEFAULT 1000,
    "scansPerHourPerUser" INTEGER NOT NULL DEFAULT 50,
    "maxApiTokens" INTEGER NOT NULL DEFAULT 3,
    "features" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organization_slug_key" ON "organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "organization_domain_key" ON "organization"("domain");

-- CreateIndex
CREATE INDEX "organization_slug_idx" ON "organization"("slug");

-- CreateIndex
CREATE INDEX "organization_domain_idx" ON "organization"("domain");

-- CreateIndex
CREATE INDEX "organization_member_organizationId_idx" ON "organization_member"("organizationId");

-- CreateIndex
CREATE INDEX "organization_member_userId_idx" ON "organization_member"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "organization_member_organizationId_userId_key" ON "organization_member"("organizationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "organization_invite_token_key" ON "organization_invite"("token");

-- CreateIndex
CREATE INDEX "organization_invite_organizationId_idx" ON "organization_invite"("organizationId");

-- CreateIndex
CREATE INDEX "organization_invite_email_idx" ON "organization_invite"("email");

-- CreateIndex
CREATE INDEX "organization_invite_token_idx" ON "organization_invite"("token");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_organizationId_key" ON "subscription"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_stripeCustomerId_key" ON "subscription"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_stripeSubscriptionId_key" ON "subscription"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "subscription_organizationId_idx" ON "subscription"("organizationId");

-- CreateIndex
CREATE INDEX "subscription_stripeCustomerId_idx" ON "subscription"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "api_token_organizationId_idx" ON "api_token"("organizationId");

-- CreateIndex
CREATE INDEX "scan_organizationId_idx" ON "scan"("organizationId");

-- AddForeignKey
ALTER TABLE "organization" ADD CONSTRAINT "organization_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_member" ADD CONSTRAINT "organization_member_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_member" ADD CONSTRAINT "organization_member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_invite" ADD CONSTRAINT "organization_invite_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_invite" ADD CONSTRAINT "organization_invite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_token" ADD CONSTRAINT "api_token_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan" ADD CONSTRAINT "scan_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
