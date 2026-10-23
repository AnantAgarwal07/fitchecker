import "dotenv/config";
import { prisma } from "../db.js";
import { calculateTrendingVelocity } from "../services/scoring.js";

async function recalculateTrending() {
  console.log("⏱️ [Cron] Starting hourly trending velocity recalculation...");
  const startTime = Date.now();

  try {
    const posts = await prisma.post.findMany({
      include: {
        trendingMetrics: {
          take: 1,
          orderBy: { calculatedAt: "desc" },
        },
      },
    });

    console.log(`📊 [Cron] Recalculating metrics across ${posts.length} posts...`);

    let updatedCount = 0;

    for (const post of posts) {
      const metric = post.trendingMetrics[0];
      const velocityScore = calculateTrendingVelocity({
        viewsCount: metric?.viewsCount || post.likesCount * 8,
        likesCount: post.likesCount,
        sharesCount: post.sharesCount,
        tryOnCount: metric?.tryOnCount || Math.floor(post.sharesCount / 2),
        createdAt: post.createdAt,
      });

      await prisma.trendingMetric.create({
        data: {
          postId: post.id,
          score: velocityScore,
          viewsCount: metric?.viewsCount || post.likesCount * 8,
          likesCount: post.likesCount,
          sharesCount: post.sharesCount,
          tryOnCount: metric?.tryOnCount || Math.floor(post.sharesCount / 2),
          timeWindow: "24h",
        },
      });

      updatedCount++;
    }

    const durationMs = Date.now() - startTime;
    console.log(`✅ [Cron] Successfully updated ${updatedCount} trending metrics in ${durationMs}ms.`);
  } catch (error: any) {
    console.error("❌ [Cron] Recalculation failed:", error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

recalculateTrending();
