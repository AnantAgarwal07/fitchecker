-- AlterTable
ALTER TABLE "BodyProfile" ADD COLUMN     "chestCm" DOUBLE PRECISION,
ADD COLUMN     "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
ADD COLUMN     "measuredAt" TIMESTAMP(3),
ADD COLUMN     "sleeveCm" DOUBLE PRECISION,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'DEFAULT',
ADD COLUMN     "weightKg" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "visibility" TEXT NOT NULL DEFAULT 'PUBLIC';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "sizeChart" JSONB;

-- AlterTable
ALTER TABLE "RenderJob" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastError" TEXT,
ADD COLUMN     "lockedAt" TIMESTAMP(3),
ADD COLUMN     "lockedBy" TEXT,
ADD COLUMN     "maxAttempts" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "nextRunAt" TIMESTAMP(3),
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'TRYON';

-- AlterTable
ALTER TABLE "TryOnSession" ADD COLUMN     "errorReason" TEXT,
ADD COLUMN     "fitDescriptor" TEXT,
ADD COLUMN     "fitReport" JSONB,
ADD COLUMN     "mode" TEXT NOT NULL DEFAULT 'demo',
ADD COLUMN     "model" TEXT,
ADD COLUMN     "userPhotoId" TEXT,
ADD COLUMN     "visibility" TEXT NOT NULL DEFAULT 'PRIVATE';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "clerkId" TEXT,
ADD COLUMN     "consentPhotoAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "UserPhoto" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "UserPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Interaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "productId" INTEGER,
    "postId" TEXT,
    "targetUserId" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Interaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedCache" (
    "userId" TEXT NOT NULL,
    "productIds" INTEGER[],
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,
    "source" TEXT NOT NULL DEFAULT 'recommender',

    CONSTRAINT "FeedCache_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "UserPhoto_userId_idx" ON "UserPhoto"("userId");

-- CreateIndex
CREATE INDEX "SavedItem_userId_idx" ON "SavedItem"("userId");

-- CreateIndex
CREATE INDEX "SavedItem_productId_idx" ON "SavedItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedItem_userId_productId_key" ON "SavedItem"("userId", "productId");

-- CreateIndex
CREATE INDEX "Interaction_userId_createdAt_idx" ON "Interaction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Interaction_type_idx" ON "Interaction"("type");

-- CreateIndex
CREATE INDEX "RenderJob_nextRunAt_idx" ON "RenderJob"("nextRunAt");

-- CreateIndex
CREATE INDEX "TryOnSession_visibility_idx" ON "TryOnSession"("visibility");

-- CreateIndex
CREATE UNIQUE INDEX "TryOnSession_userPhotoId_productId_sizeSelected_model_key" ON "TryOnSession"("userPhotoId", "productId", "sizeSelected", "model");

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkId_key" ON "User"("clerkId");

-- CreateIndex
CREATE INDEX "User_clerkId_idx" ON "User"("clerkId");

-- AddForeignKey
ALTER TABLE "UserPhoto" ADD CONSTRAINT "UserPhoto_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TryOnSession" ADD CONSTRAINT "TryOnSession_userPhotoId_fkey" FOREIGN KEY ("userPhotoId") REFERENCES "UserPhoto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedItem" ADD CONSTRAINT "SavedItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedItem" ADD CONSTRAINT "SavedItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;
