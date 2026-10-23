import { prisma } from "../db.js";
import { calculateMatchScore, UserMeasurementProfile } from "../services/scoring.js";
import { SCORING_CONFIG } from "../config/scoring.js";

export interface RecommenderOptions {
  forceRefresh?: boolean;
  limit?: number;
  category?: string;
  audience?: string;
}

const FEED_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

// Non-wearable categories to exclude
const EXCLUDED_CATEGORIES = [
  "beauty",
  "makeup",
  "skincare",
  "grooming",
  "Home Decor",
  "home decor",
  "Wallets",
  "wallets",
  "watches",
  "watch gift set",
  "Water Bottle",
];

/**
 * Invalidates feed cache for a specific user (e.g., when they update body measurements)
 */
export async function invalidateUserFeedCache(userId: string): Promise<void> {
  try {
    await prisma.feedCache.deleteMany({
      where: { userId },
    });
  } catch (err: any) {
    console.warn(`[Recommender] Failed to invalidate feed cache for ${userId}:`, err.message);
  }
}

/**
 * Applies diversity constraints:
 * - Max 2 items per brand in the top 10
 * - Max 3 items per category/productType in the top 10
 */
export function diversifyRecommendations<T extends { brand?: string | null; category?: string | null; productType?: string | null }>(
  items: T[],
  limit = 20
): T[] {
  const brandCounts: Record<string, number> = {};
  const categoryCounts: Record<string, number> = {};
  const diversified: T[] = [];
  const deferred: T[] = [];

  for (const item of items) {
    const brand = (item.brand || "Brand").toLowerCase();
    const cat = (item.productType || item.category || "Apparel").toLowerCase();

    const currentBrandCount = brandCounts[brand] || 0;
    const currentCatCount = categoryCounts[cat] || 0;

    // In top 10, strictly cap brand to 2 and category to 3
    if (diversified.length < 10) {
      if (currentBrandCount >= 2 || currentCatCount >= 3) {
        deferred.push(item);
        continue;
      }
    }

    brandCounts[brand] = currentBrandCount + 1;
    categoryCounts[cat] = currentCatCount + 1;
    diversified.push(item);

    if (diversified.length >= limit) break;
  }

  // Fill remaining slots up to limit from deferred items if needed (strictly respecting top-10 constraints)
  while (diversified.length < limit && deferred.length > 0) {
    const next = deferred.shift()!;
    const brand = (next.brand || "Brand").toLowerCase();
    const cat = (next.productType || next.category || "Apparel").toLowerCase();

    if (diversified.length < 10) {
      if ((brandCounts[brand] || 0) >= 2 || (categoryCounts[cat] || 0) >= 3) {
        continue;
      }
    }

    brandCounts[brand] = (brandCounts[brand] || 0) + 1;
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    diversified.push(next);
  }

  return diversified;

}

/**
 * Generates or retrieves personalized for-you recommendations (Phase C3)
 */
export async function getPersonalizedFeed(
  userId: string,
  options: RecommenderOptions = {}
) {
  const { forceRefresh = false, limit = 20, category, audience } = options;

  // 1. Check PostgreSQL FeedCache unless forceRefresh or filters are specified
  if (!forceRefresh && !category && !audience) {
    const cached = await prisma.feedCache.findUnique({
      where: { userId },
    });

    if (cached && Date.now() - cached.generatedAt.getTime() < FEED_CACHE_TTL_MS) {
      const cachedProducts = await prisma.product.findMany({
        where: { id: { in: cached.productIds.slice(0, limit) } },
        include: {
          ProductImage: {
            orderBy: { position: "asc" },
            take: 2,
          },
        },
      });

      // Preserve cached ordering
      const productMap = new Map(cachedProducts.map((p) => [p.id, p]));
      const ordered = cached.productIds
        .map((id) => productMap.get(id))
        .filter(Boolean) as typeof cachedProducts;

      if (ordered.length > 0) {
        return {
          products: ordered,
          cached: true,
          generatedAt: cached.generatedAt,
        };
      }
    }
  }

  // 2. Fetch User and Body Profile
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { bodyProfile: true },
  });

  const profile = user?.bodyProfile;
  const userProfile: UserMeasurementProfile = {
    heightCm: profile?.heightCm || 165,
    gender: profile?.gender || "women",
    bodyType: profile?.bodyType || "hourglass",
    fitPreference: profile?.fitPreference || "regular",
    styleVibe: profile?.styleVibe || "streetwear",
    chestCm: profile?.chestCm || profile?.bustChestCm || null,
    bustChestCm: profile?.bustChestCm || profile?.chestCm || null,
    waistCm: profile?.waistCm || null,
    hipsCm: profile?.hipsCm || null,
    shoulderCm: profile?.shoulderCm || null,
    inseamCm: profile?.inseamCm || null,
  };

  // 3. Candidate Retrieval: Fetch 80 wearable products
  const where: any = {
    category: { notIn: EXCLUDED_CATEGORIES },
  };

  if (category && category !== "all") {
    where.category = { equals: category, mode: "insensitive" };
  }

  if (audience) {
    where.audience = { equals: audience, mode: "insensitive" };
  } else if (userProfile.gender) {
    where.OR = [
      { audience: { equals: userProfile.gender, mode: "insensitive" } },
      { audience: { equals: "unisex", mode: "insensitive" } },
      { audience: null },
    ];
  }

  const candidates = await prisma.product.findMany({
    where,
    take: 80,
    orderBy: [{ rating: "desc" }, { id: "asc" }],
    include: {
      ProductImage: {
        orderBy: { position: "asc" },
        take: 2,
      },
    },
  });

  // 4. Personalized Ease-Based Scoring
  const scored = candidates.map((product) => {
    const scoreResult = calculateMatchScore(userProfile, product);
    return {
      product,
      matchScore: scoreResult.matchScore,
      fitNote: scoreResult.fitNote,
      fitDescriptor: scoreResult.fitDescriptor,
      fitReport: scoreResult.fitReport,
      measuredFit: scoreResult.measuredFit,
      recommendedSize: scoreResult.recommendedSize,
      breakdown: scoreResult.breakdown,
      brand: product.brand,
      category: product.category,
      productType: product.productType,
    };
  });

  // Sort descending by match score
  scored.sort((a, b) => b.matchScore - a.matchScore);

  // 5. Apply Diversification Constraints
  const diversified = diversifyRecommendations(scored, limit);

  // 6. Update PostgreSQL FeedCache asynchronously
  const topProductIds = diversified.map((d) => d.product.id);
  if (!category && !audience && topProductIds.length > 0) {
    prisma.feedCache
      .upsert({
        where: { userId },
        update: {
          productIds: topProductIds,
          generatedAt: new Date(),
          version: 1,
        },
        create: {
          userId,
          productIds: topProductIds,
          generatedAt: new Date(),
          version: 1,
        },
      })
      .catch((err) => console.warn(`[Recommender] Failed to persist feedCache:`, err.message));
  }

  return {
    recommendations: diversified.map((d) => ({
      ...d.product,
      matchScore: d.matchScore,
      fitScore: `${d.matchScore}%`,
      fitNote: d.fitNote,
      fitDescriptor: d.fitDescriptor,
      fitReport: d.fitReport,
      measuredFit: d.measuredFit,
      recommendedSize: d.recommendedSize,
      breakdown: d.breakdown,
    })),
    cached: false,
    userProfile,
  };
}
