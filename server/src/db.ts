import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

function getDatabaseUrl(): string | undefined {
  if (process.env.NODE_ENV === "test") {
    const testDbUrl = process.env.TEST_DATABASE_URL;
    const prodDbUrl = process.env.DATABASE_URL;

    if (!testDbUrl) {
      throw new Error("❌ D2 SAFETY ERROR: TEST_DATABASE_URL is not set for test execution.");
    }

    if (prodDbUrl && testDbUrl === prodDbUrl) {
      throw new Error(
        "❌ D2 SAFETY VIOLATION: TEST_DATABASE_URL equals production DATABASE_URL! Integration tests refuse to run against production database."
      );
    }

    return testDbUrl;
  }

  return process.env.DATABASE_URL;
}

const dbUrl = getDatabaseUrl();

export const prisma =
  global.prisma ||
  new PrismaClient({
    datasourceUrl: dbUrl,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}
