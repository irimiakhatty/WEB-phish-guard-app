/*
  Warnings:

  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `UserAction` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "EmailScan" DROP CONSTRAINT "EmailScan_userId_fkey";

-- DropForeignKey
ALTER TABLE "UserAction" DROP CONSTRAINT "UserAction_departmentId_fkey";

-- DropForeignKey
ALTER TABLE "UserAction" DROP CONSTRAINT "UserAction_emailScanId_fkey";

-- DropForeignKey
ALTER TABLE "UserAction" DROP CONSTRAINT "UserAction_userId_fkey";

-- DropForeignKey
ALTER TABLE "_DepartmentUsers" DROP CONSTRAINT "_DepartmentUsers_B_fkey";

-- DropTable
DROP TABLE "User";

-- DropTable
DROP TABLE "UserAction";

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "emailScanId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "link" TEXT,
    "actionAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- AddForeignKey
ALTER TABLE "EmailScan" ADD CONSTRAINT "EmailScan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_emailScanId_fkey" FOREIGN KEY ("emailScanId") REFERENCES "EmailScan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DepartmentUsers" ADD CONSTRAINT "_DepartmentUsers_B_fkey" FOREIGN KEY ("B") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
