/**
 * Smoke Test Script: Virtual Try-On Pipeline (PRD Phase D2)
 * Validates end-to-end execution of try-on generation, fit calculation,
 * per-area ease reports, and database persistence.
 *
 * Usage: npx tsx scripts/smoke-tryon.ts
 */

import "dotenv/config";
import { prisma } from "../src/db.js";
import { startTryOnSession, executeTryOnJob } from "../src/services/tryOnPipeline.js";

async function runSmokeTest() {
  console.log("🔥 [Smoke Test] Starting Virtual Try-On Pipeline Smoke Test...");
  const startTime = Date.now();

  // 1. Pick a wearable product with a sizeChart
  const product = await prisma.product.findFirst({
    where: {
      sizeChart: { not: null as any },
      category: { notIn: ["beauty", "wallets", "watches"] },
    },
    include: { ProductImage: true },
  });

  if (!product) {
    throw new Error("No wearable product with sizeChart found in database!");
  }

  console.log(`📦 [Smoke Test] Selected Product #${product.id}: "${product.name}" (${product.brand || "Brand"})`);

  // 2. Select or create test user
  const userId = "u-ananya-sharma-001";
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { bodyProfile: true },
  });

  if (!user) {
    throw new Error(`Test user ${userId} not found in database!`);
  }

  console.log(`👤 [Smoke Test] User: ${user.name} (@${user.handle}), Height: ${user.bodyProfile?.heightCm || 165}cm`);

  // 3. Queue a Try-On Session
  const mode = process.env.TRYON_MODE || "demo";
  console.log(`⚙️ [Smoke Test] Running in ${mode.toUpperCase()} try-on mode...`);

  const jobInfo = await startTryOnSession({
    userId,
    productId: product.id,
    userPhotoUrl: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600",
    userHeightCm: user.bodyProfile?.heightCm || 165,
    sizeSelected: "M",
  });

  console.log(`📋 [Smoke Test] Queued Job #${jobInfo.jobId} for Session #${jobInfo.tryOnSessionId}`);

  // 4. Execute Try-On Pipeline directly
  await executeTryOnJob(jobInfo.jobId, "smoke-test-runner");

  // 5. Inspect database results
  const completedSession = await prisma.tryOnSession.findUnique({
    where: { id: jobInfo.tryOnSessionId },
    include: { product: true },
  });

  if (!completedSession) {
    throw new Error(`TryOnSession #${jobInfo.tryOnSessionId} not found in database after execution!`);
  }

  const completedJob = await prisma.renderJob.findUnique({
    where: { id: jobInfo.jobId },
  });

  console.log("\n📊 [Smoke Test] Execution Results:");
  console.log(`- Job Status: ${completedJob?.status}`);
  console.log(`- Session Status: ${completedSession.status}`);
  console.log(`- Mode: ${completedSession.mode}`);
  console.log(`- Rendered Image: ${completedSession.renderedImageUrl}`);
  console.log(`- Match Score: ${completedSession.fitScore}%`);
  console.log(`- Fit Descriptor: "${completedSession.fitDescriptor}"`);
  console.log(`- Fit Note: "${completedSession.fitNote}"`);
  console.log(`- Per-Area Fit Report:`, JSON.stringify(completedSession.fitReport, null, 2));

  // 6. Assertions
  if (completedSession.status !== "COMPLETED") {
    throw new Error(`Assertion Failed: Session status is ${completedSession.status}, expected COMPLETED`);
  }

  if (!completedSession.renderedImageUrl || !completedSession.renderedImageUrl.startsWith("http")) {
    throw new Error("Assertion Failed: renderedImageUrl is missing or invalid");
  }

  if (typeof completedSession.fitScore !== "number" || completedSession.fitScore < 60 || completedSession.fitScore > 99) {
    throw new Error(`Assertion Failed: fitScore ${completedSession.fitScore} is outside valid 60-99 range`);
  }

  if (!completedSession.fitDescriptor || completedSession.fitDescriptor.length < 5) {
    throw new Error("Assertion Failed: fitDescriptor is missing or too short");
  }

  const totalTime = Date.now() - startTime;
  console.log(`\n🎉 [Smoke Test] ALL ASSERTIONS PASSED! Completed in ${totalTime}ms.`);
}

runSmokeTest()
  .catch((err) => {
    console.error("❌ [Smoke Test] FAILED:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
