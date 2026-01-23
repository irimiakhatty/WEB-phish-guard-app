-- AlterTable
ALTER TABLE "api_token" ADD COLUMN     "hourlyLimit" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN     "userId" TEXT,
ALTER COLUMN "organizationId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "api_token_userId_idx" ON "api_token"("userId");

-- AddForeignKey
ALTER TABLE "api_token" ADD CONSTRAINT "api_token_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
