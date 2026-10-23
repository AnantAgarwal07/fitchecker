-- CreateTable
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "bio" TEXT,
    "location" TEXT,
    "isRetailer" BOOLEAN NOT NULL DEFAULT false,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "BodyProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "heightCm" DOUBLE PRECISION,
    "gender" TEXT,
    "bodyType" TEXT,
    "bustChestCm" DOUBLE PRECISION,
    "waistCm" DOUBLE PRECISION,
    "hipsCm" DOUBLE PRECISION,
    "inseamCm" DOUBLE PRECISION,
    "shoulderCm" DOUBLE PRECISION,
    "fitPreference" TEXT DEFAULT 'regular',
    "styleVibe" TEXT,
    "fullBodyPhotoUrl" TEXT,
    "landmarksJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BodyProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Post" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "caption" TEXT,
    "imageUrl" TEXT NOT NULL,
    "fallbackImageUrl" TEXT,
    "category" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "price" DECIMAL(12,2),
    "rating" DOUBLE PRECISION DEFAULT 4.5,
    "likesCount" INTEGER NOT NULL DEFAULT 0,
    "sharesCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PostProduct" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "productId" INTEGER NOT NULL,
    "xPercent" DOUBLE PRECISION,
    "yPercent" DOUBLE PRECISION,
    "garmentType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PostLike" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Follow" (
    "id" TEXT NOT NULL,
    "followerId" TEXT NOT NULL,
    "followingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Follow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TryOnSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "inputPhotoUrl" TEXT,
    "renderedImageUrl" TEXT,
    "fitScore" DOUBLE PRECISION,
    "fitNote" TEXT,
    "sizeSelected" TEXT,
    "isSaved" BOOLEAN NOT NULL DEFAULT false,
    "isPrivate" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TryOnSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "RenderJob" (
    "id" TEXT NOT NULL,
    "tryOnSessionId" TEXT NOT NULL,
    "modelName" TEXT NOT NULL DEFAULT 'gemini-2.5-flash-image',
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "promptUsed" TEXT,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RenderJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TrendingMetric" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "viewsCount" INTEGER NOT NULL DEFAULT 0,
    "likesCount" INTEGER NOT NULL DEFAULT 0,
    "sharesCount" INTEGER NOT NULL DEFAULT 0,
    "tryOnCount" INTEGER NOT NULL DEFAULT 0,
    "timeWindow" TEXT NOT NULL DEFAULT '24h',
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrendingMetric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_handle_key" ON "User"("handle");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "User_handle_idx" ON "User"("handle");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "BodyProfile_userId_key" ON "BodyProfile"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BodyProfile_userId_idx" ON "BodyProfile"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Post_userId_idx" ON "Post"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Post_category_idx" ON "Post"("category");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Post_createdAt_idx" ON "Post"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Post_likesCount_idx" ON "Post"("likesCount");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PostProduct_postId_idx" ON "PostProduct"("postId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PostProduct_productId_idx" ON "PostProduct"("productId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PostLike_userId_idx" ON "PostLike"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PostLike_postId_userId_key" ON "PostLike"("postId", "userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Follow_followerId_idx" ON "Follow"("followerId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Follow_followingId_idx" ON "Follow"("followingId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Follow_followerId_followingId_key" ON "Follow"("followerId", "followingId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TryOnSession_userId_idx" ON "TryOnSession"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TryOnSession_productId_idx" ON "TryOnSession"("productId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TryOnSession_status_idx" ON "TryOnSession"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RenderJob_tryOnSessionId_idx" ON "RenderJob"("tryOnSessionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RenderJob_status_idx" ON "RenderJob"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TrendingMetric_postId_idx" ON "TrendingMetric"("postId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TrendingMetric_score_idx" ON "TrendingMetric"("score");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TrendingMetric_timeWindow_idx" ON "TrendingMetric"("timeWindow");

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BodyProfile_userId_fkey') THEN
    ALTER TABLE "BodyProfile" ADD CONSTRAINT "BodyProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Post_userId_fkey') THEN
    ALTER TABLE "Post" ADD CONSTRAINT "Post_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PostProduct_postId_fkey') THEN
    ALTER TABLE "PostProduct" ADD CONSTRAINT "PostProduct_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PostProduct_productId_fkey') THEN
    ALTER TABLE "PostProduct" ADD CONSTRAINT "PostProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PostLike_postId_fkey') THEN
    ALTER TABLE "PostLike" ADD CONSTRAINT "PostLike_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PostLike_userId_fkey') THEN
    ALTER TABLE "PostLike" ADD CONSTRAINT "PostLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Follow_followerId_fkey') THEN
    ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Follow_followingId_fkey') THEN
    ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TryOnSession_userId_fkey') THEN
    ALTER TABLE "TryOnSession" ADD CONSTRAINT "TryOnSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TryOnSession_productId_fkey') THEN
    ALTER TABLE "TryOnSession" ADD CONSTRAINT "TryOnSession_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RenderJob_tryOnSessionId_fkey') THEN
    ALTER TABLE "RenderJob" ADD CONSTRAINT "RenderJob_tryOnSessionId_fkey" FOREIGN KEY ("tryOnSessionId") REFERENCES "TryOnSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TrendingMetric_postId_fkey') THEN
    ALTER TABLE "TrendingMetric" ADD CONSTRAINT "TrendingMetric_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
