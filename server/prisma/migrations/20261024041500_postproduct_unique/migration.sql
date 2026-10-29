-- Delete duplicate rows in PostProduct keeping the latest one
DELETE FROM "PostProduct"
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY "postId", "productId" ORDER BY "createdAt" DESC, id DESC) as rnum
    FROM "PostProduct"
  ) t
  WHERE t.rnum > 1
);

-- Create unique constraint for Prisma upsert ON CONFLICT
ALTER TABLE "PostProduct" ADD CONSTRAINT "PostProduct_postId_productId_key" UNIQUE ("postId", "productId");
