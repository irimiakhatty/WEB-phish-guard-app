/*
  Warnings:

  - You are about to drop the `account` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `api_token` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `dashboard_stats` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `organization` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `organization_invite` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `organization_member` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `personal_subscription` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `scan` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `session` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `subscription` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `user` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `verification` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "account" DROP CONSTRAINT "account_userId_fkey";

-- DropForeignKey
ALTER TABLE "api_token" DROP CONSTRAINT "api_token_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "api_token" DROP CONSTRAINT "api_token_userId_fkey";

-- DropForeignKey
ALTER TABLE "dashboard_stats" DROP CONSTRAINT "dashboard_stats_userId_fkey";

-- DropForeignKey
ALTER TABLE "organization" DROP CONSTRAINT "organization_createdById_fkey";

-- DropForeignKey
ALTER TABLE "organization_invite" DROP CONSTRAINT "organization_invite_invitedById_fkey";

-- DropForeignKey
ALTER TABLE "organization_invite" DROP CONSTRAINT "organization_invite_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "organization_member" DROP CONSTRAINT "organization_member_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "organization_member" DROP CONSTRAINT "organization_member_userId_fkey";

-- DropForeignKey
ALTER TABLE "personal_subscription" DROP CONSTRAINT "personal_subscription_userId_fkey";

-- DropForeignKey
ALTER TABLE "scan" DROP CONSTRAINT "scan_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "scan" DROP CONSTRAINT "scan_userId_fkey";

-- DropForeignKey
ALTER TABLE "session" DROP CONSTRAINT "session_userId_fkey";

-- DropForeignKey
ALTER TABLE "subscription" DROP CONSTRAINT "subscription_organizationId_fkey";

-- DropTable
DROP TABLE "account";

-- DropTable
DROP TABLE "api_token";

-- DropTable
DROP TABLE "dashboard_stats";

-- DropTable
DROP TABLE "organization";

-- DropTable
DROP TABLE "organization_invite";

-- DropTable
DROP TABLE "organization_member";

-- DropTable
DROP TABLE "personal_subscription";

-- DropTable
DROP TABLE "scan";

-- DropTable
DROP TABLE "session";

-- DropTable
DROP TABLE "subscription";

-- DropTable
DROP TABLE "user";

-- DropTable
DROP TABLE "verification";

-- CreateTable
CREATE TABLE "EmailScan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "emailSubject" TEXT NOT NULL,
    "emailSender" TEXT NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isPhishing" BOOLEAN NOT NULL,
    "detectedBy" TEXT NOT NULL,
    "links" TEXT[],

    CONSTRAINT "EmailScan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "emailScanId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "link" TEXT,
    "actionAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_DepartmentUsers" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_DepartmentUsers_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");

-- CreateIndex
CREATE INDEX "_DepartmentUsers_B_index" ON "_DepartmentUsers"("B");

-- AddForeignKey
ALTER TABLE "EmailScan" ADD CONSTRAINT "EmailScan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailScan" ADD CONSTRAINT "EmailScan_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAction" ADD CONSTRAINT "UserAction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAction" ADD CONSTRAINT "UserAction_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAction" ADD CONSTRAINT "UserAction_emailScanId_fkey" FOREIGN KEY ("emailScanId") REFERENCES "EmailScan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DepartmentUsers" ADD CONSTRAINT "_DepartmentUsers_A_fkey" FOREIGN KEY ("A") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DepartmentUsers" ADD CONSTRAINT "_DepartmentUsers_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
