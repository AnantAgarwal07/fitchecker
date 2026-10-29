-- Drop old FeedCache table safely if exists and create new composite FeedCache
DROP TABLE IF EXISTS "FeedCache";

CREATE TABLE "FeedCache" (
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'all',
    "items" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedCache_pkey" PRIMARY KEY ("userId","category")
);
