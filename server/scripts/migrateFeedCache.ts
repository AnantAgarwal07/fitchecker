import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config();

const dropSql = `DROP TABLE IF EXISTS "FeedCache";`;
const createSql = `
CREATE TABLE "FeedCache" (
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'all',
    "items" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FeedCache_pkey" PRIMARY KEY ("userId","category")
);
`;

async function main() {
  const urls = [
    { name: "DEV_DATABASE", url: process.env.DATABASE_URL },
    { name: "TEST_DATABASE", url: process.env.TEST_DATABASE_URL },
  ];

  for (const { name, url } of urls) {
    if (!url) continue;
    console.log(`Applying FeedCache migration to ${name}...`);
    const prisma = new PrismaClient({
      datasources: { db: { url } },
    });
    try {
      await prisma.$executeRawUnsafe(dropSql);
      await prisma.$executeRawUnsafe(createSql);
      console.log(`✅ Success for ${name}`);
    } catch (e: any) {
      console.error(`❌ Failed for ${name}:`, e.message);
    } finally {
      await prisma.$disconnect();
    }
  }
}

main().catch(console.error);
