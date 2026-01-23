-- AlterTable
ALTER TABLE "subscription" ALTER COLUMN "maxMembers" SET DEFAULT 3,
ALTER COLUMN "scansPerMonth" SET DEFAULT 500,
ALTER COLUMN "scansPerHourPerUser" SET DEFAULT 25,
ALTER COLUMN "maxApiTokens" SET DEFAULT 1;

-- CreateTable
CREATE TABLE "personal_subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "status" TEXT NOT NULL DEFAULT 'active',
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "stripePriceId" TEXT,
    "currentPeriodStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "canceledAt" TIMESTAMP(3),
    "scansPerMonth" INTEGER NOT NULL DEFAULT 100,
    "scansPerHour" INTEGER NOT NULL DEFAULT 25,
    "maxApiTokens" INTEGER NOT NULL DEFAULT 1,
    "features" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personal_subscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "personal_subscription_userId_key" ON "personal_subscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "personal_subscription_stripeCustomerId_key" ON "personal_subscription"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "personal_subscription_stripeSubscriptionId_key" ON "personal_subscription"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "personal_subscription_userId_idx" ON "personal_subscription"("userId");

-- CreateIndex
CREATE INDEX "personal_subscription_stripeCustomerId_idx" ON "personal_subscription"("stripeCustomerId");

-- AddForeignKey
ALTER TABLE "personal_subscription" ADD CONSTRAINT "personal_subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
