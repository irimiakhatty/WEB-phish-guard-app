-- CreateTable
CREATE TABLE "api_token" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Chrome Extension',
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "hourlyLimit" INTEGER NOT NULL DEFAULT 100,
    "lastResetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_token_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "api_token_token_key" ON "api_token"("token");

-- CreateIndex
CREATE INDEX "api_token_userId_idx" ON "api_token"("userId");

-- CreateIndex
CREATE INDEX "api_token_token_idx" ON "api_token"("token");

-- AddForeignKey
ALTER TABLE "api_token" ADD CONSTRAINT "api_token_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
