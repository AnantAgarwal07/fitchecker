import { prisma } from "../db.js";
import { calculateMatchScore, UserMeasurementProfile } from "../services/scoring.js";

export interface RecommenderOptions {
  forceRefresh?: boolean;
  refresh?: boolean;
  limit?: number;
  category?: string;
  q?: string;
}

export interface CachedFeedItem {
  postId: string;
  score: number;
  fitNote?: string;
  brand?: string;
  category?: string;
}

const FEED_STALE_HOURS = Number(process.env.FEED_STALE_HOURS) || 6;
const FEED_STALE_MS = FEED_STALE_HOURS * 60 * 60 * 1000;

/**
 * Normalizes user-facing category / occasion labels to standard database keys.
 * Maps 'Office wear' / 'workwear' to 'formal'.
 */
export function normalizeCategory(category?: string | null): string {
  if (!category || category === "all") return "all";
  const lower = category.trim().toLowerCase();
  if (lower === "office wear" || lower === "office" || lower === "workwear") return "formal";
  if (lower === "ethnic") return "ethnic wear";
  if (lower === "party") return "party wear";
  if (lower === "college") return "college outfits";
  if (lower === "dress") return "dresses";
  return lower;
}

/**
 * Fetches user physical measurement profile for scoring.
 */
export async function getUserMeasurementProfile(userId: string): Promise<UserMeasurementProfile> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { bodyProfile: true },
  });

  const profile = user?.bodyProfile;
  return {
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
}

/**
 * Applies diversity constraints:
 * - Max 2 items per brand in the top 10
 * - Max 3 items per category in the top 10
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

  // Fill remaining slots up to limit from deferred items
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
 * Hydrates post IDs with ONE efficient database query loading exactly 1 ProductImage.
 */
export async function hydratePosts(
  items: Array<{ postId: string; score: number; fitNote?: string }>
): Promise<any[]> {
  if (!items || items.length === 0) return [];

  const postIds = items.map((i) => i.postId);

  const posts = await prisma.post.findMany({
    where: {
      id: { in: postIds },
    },
    select: {
      id: true,
      caption: true,
      category: true,
      imageUrl: true,
      fallbackImageUrl: true,
      price: true,
      rating: true,
      likesCount: true,
      sharesCount: true,
      user: {
        select: {
          id: true,
          name: true,
          handle: true,
          avatarUrl: true,
          verified: true,
          isRetailer: true,
        },
      },
      products: {
        select: {
          product: {
            select: {
              id: true,
              name: true,
              brand: true,
              category: true,
              productType: true,
              currentPrice: true,
              productUrl: true,
              ProductImage: {
                take: 1,
                orderBy: { position: "asc" },
                select: {
                  imageUrl: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const postMap = new Map(posts.map((p) => [p.id, p]));

  return items
    .map((item) => {
      const post = postMap.get(item.postId);
      if (!post) return null;

      const garments = (post.products || []).map((pp) => {
        const itemUrl = pp.product.productUrl || "https://www.myntra.com";
        return {
          id: pp.product.id,
          name: pp.product.name,
          brand: pp.product.brand || "Brand",
          price: Number(pp.product.currentPrice) || Number(post.price) || 0,
          image: pp.product.ProductImage[0]?.imageUrl || post.imageUrl,
          category: pp.product.category,
          productType: pp.product.productType,
          shopUrl: itemUrl,
          shoppingUrl: itemUrl,
          productUrl: itemUrl,
        };
      });

      const primaryUrl = garments[0]?.shopUrl || "https://www.myntra.com";

      const defaultGarment = garments[0] || {
        id: `prod-${post.id}`,
        name: post.caption || "Recommended Outfit",
        brand: post.user.name,
        price: Number(post.price) || 0,
        image: post.imageUrl,
        category: post.category,
        shopUrl: primaryUrl,
        shoppingUrl: primaryUrl,
        productUrl: primaryUrl,
      };

      return {
        id: post.id,
        name: post.caption || "Curated Look",
        category: post.category || "casual",
        brand: defaultGarment.brand,
        productType: defaultGarment.category,
        image: post.imageUrl,
        fallbackImage: post.fallbackImageUrl || post.imageUrl,
        price: Number(post.price) || defaultGarment.price,
        rating: post.rating || 4.7,
        likes: post.likesCount,
        shares: `${post.sharesCount}`,
        caption: post.caption,
        matchScore: item.score,
        fitScore: `${item.score}%`,
        fitNote: item.fitNote || "Proportionally matched to your silhouette",
        breakdown: {
          styleMatch: Math.min(99, item.score + 2),
          sizeConfidence: item.score,
          proportionScore: Math.max(70, Math.min(99, item.score - 2)),
        },
        creator: {
          id: post.user.id,
          name: post.user.name,
          handle: post.user.handle.startsWith("@") ? post.user.handle : `@${post.user.handle}`,
          avatar: post.user.avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
          verified: post.user.verified,
          isRetailer: post.user.isRetailer,
        },
        garments,
        defaultGarment,
        shoppingUrl: primaryUrl,
        shopUrl: primaryUrl,
      };
    })
    .filter(Boolean);
}

/**
 * Computes personalized feed, diversifies results, and writes to FeedCache table.
 */
export async function computeAndStoreFeed(
  userId: string,
  category = "all",
  limit = 20
): Promise<{ items: CachedFeedItem[]; userProfile: UserMeasurementProfile }> {
  const debugTiming = process.env.DEBUG_TIMING === "true";
  const t0 = performance.now();

  const normCategory = normalizeCategory(category);
  const userProfile = await getUserMeasurementProfile(userId);

  // 1. Prefilter candidates in SQL by category & audience matching user gender
  const where: any = {
    visibility: "PUBLIC",
  };

  if (normCategory !== "all") {
    where.category = { equals: normCategory, mode: "insensitive" };
  }

  // Audience matching user's gender
  if (userProfile.gender === "women") {
    where.products = {
      some: {
        product: {
          OR: [
            { audience: { in: ["women", "unisex"] } },
            { audience: null },
          ],
        },
      },
    };
  } else if (userProfile.gender === "men") {
    where.products = {
      some: {
        product: {
          OR: [
            { audience: { in: ["men", "unisex"] } },
            { audience: null },
          ],
        },
      },
    };
  }

  const candidates = await prisma.post.findMany({
    where,
    take: 60,
    select: {
      id: true,
      category: true,
      user: {
        select: {
          name: true,
        },
      },
      products: {
        select: {
          product: {
            select: {
              id: true,
              category: true,
              productType: true,
              fit: true,
              occasion: true,
              audience: true,
              currentPrice: true,
              brand: true,
              rawDetails: true,
              sizeChart: true,
            },
          },
        },
      },
    },
  });

  const tCandidates = performance.now();

  // 2. Score candidates against user body profile
  const scoredCandidates: Array<{
    postId: string;
    score: number;
    fitNote: string;
    brand: string;
    category: string;
  }> = candidates.map((post) => {
    const primaryProduct = post.products[0]?.product;

    const scoreResult = calculateMatchScore(
      userProfile,
      primaryProduct || {
        category: post.category,
        productType: "apparel",
        fit: "regular",
        occasion: post.category,
        audience: userProfile.gender === "men" ? "men" : "women",
      }
    );

    return {
      postId: post.id,
      score: scoreResult.matchScore,
      fitNote: scoreResult.fitNote,
      brand: primaryProduct?.brand || post.user.name,
      category: post.category || "casual",
    };
  });

  // Sort descending by match score
  scoredCandidates.sort((a, b) => b.score - a.score);

  // Apply diversification
  const diversified = diversifyRecommendations(scoredCandidates, limit);
  const tScoring = performance.now();

  const cacheItems: CachedFeedItem[] = diversified.map((d) => ({
    postId: d.postId,
    score: d.score,
    fitNote: d.fitNote,
    brand: d.brand,
    category: d.category,
  }));

  // 3. Upsert into FeedCache table
  await prisma.feedCache.upsert({
    where: {
      userId_category: {
        userId,
        category: normCategory,
      },
    },
    update: {
      items: cacheItems as any,
      generatedAt: new Date(),
    },
    create: {
      userId,
      category: normCategory,
      items: cacheItems as any,
      generatedAt: new Date(),
    },
  });

  const tCache = performance.now();

  if (debugTiming) {
    console.log(
      `[ForYou Timing] Candidate query: ${(tCandidates - t0).toFixed(1)}ms | Scoring & Diversification: ${(tScoring - tCandidates).toFixed(1)}ms | Cache write: ${(tCache - tScoring).toFixed(1)}ms | Total: ${(tCache - t0).toFixed(1)}ms`
    );
  }

  return { items: cacheItems, userProfile };
}

/**
 * Returns immediate starter feed of popular & recent looks for new users.
 */
export async function getStarterFeed(
  category = "all",
  userProfile: UserMeasurementProfile,
  limit = 20
): Promise<any[]> {
  const normCategory = normalizeCategory(category);
  const where: any = { visibility: "PUBLIC" };

  if (normCategory !== "all") {
    where.category = { equals: normCategory, mode: "insensitive" };
  }

  const starterPosts = await prisma.post.findMany({
    where,
    take: limit,
    orderBy: [{ likesCount: "desc" }, { createdAt: "desc" }],
    include: {
      user: true,
      products: {
        include: {
          product: {
            include: {
              ProductImage: {
                take: 1,
                orderBy: { position: "asc" },
              },
            },
          },
        },
      },
    },
  });

  return starterPosts.map((post) => {
    const garments = (post.products || []).map((pp) => {
      const itemUrl = pp.product.productUrl || "https://www.myntra.com";
      return {
        id: pp.product.id,
        name: pp.product.name,
        brand: pp.product.brand || "Brand",
        price: Number(pp.product.currentPrice) || Number(post.price) || 0,
        image: pp.product.ProductImage[0]?.imageUrl || post.imageUrl,
        category: pp.product.category,
        productType: pp.product.productType,
        shopUrl: itemUrl,
        shoppingUrl: itemUrl,
        productUrl: itemUrl,
      };
    });

    const primaryUrl = garments[0]?.shopUrl || "https://www.myntra.com";

    const defaultGarment = garments[0] || {
      id: `prod-${post.id}`,
      name: post.caption || "Recommended Outfit",
      brand: post.user.name,
      price: Number(post.price) || 0,
      image: post.imageUrl,
      category: post.category,
      shopUrl: primaryUrl,
      shoppingUrl: primaryUrl,
      productUrl: primaryUrl,
    };

    return {
      id: post.id,
      name: post.caption || "Curated Look",
      category: post.category || "casual",
      brand: defaultGarment.brand,
      productType: defaultGarment.category,
      image: post.imageUrl,
      fallbackImage: post.fallbackImageUrl || post.imageUrl,
      price: Number(post.price) || defaultGarment.price,
      rating: post.rating || 4.7,
      likes: post.likesCount,
      shares: `${post.sharesCount}`,
      caption: post.caption,
      matchScore: 85,
      fitScore: "85%",
      fitNote: `Popular ${post.category || "curated"} style to jumpstart your feed`,
      creator: {
        id: post.user.id,
        name: post.user.name,
        handle: post.user.handle.startsWith("@") ? post.user.handle : `@${post.user.handle}`,
        avatar: post.user.avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
        verified: post.user.verified,
        isRetailer: post.user.isRetailer,
      },
      garments,
      defaultGarment,
      shoppingUrl: primaryUrl,
      shopUrl: primaryUrl,
    };
  });
}

/**
 * Unified entry point for personalized recommendations:
 * Implements Stale-While-Revalidate and Starter Feed.
 */
export async function getPersonalizedFeed(
  userId: string,
  options: RecommenderOptions = {}
) {
  const debugTiming = process.env.DEBUG_TIMING === "true";
  const t0 = performance.now();

  const isRefresh = options.refresh === true || options.forceRefresh === true;
  const normCategory = normalizeCategory(options.category);
  const limit = options.limit || 20;

  // 1. If not forcing a refresh, check FeedCache table
  if (!isRefresh) {
    const cached = await prisma.feedCache.findUnique({
      where: {
        userId_category: {
          userId,
          category: normCategory,
        },
      },
    });

    if (cached) {
      const isStale = Date.now() - cached.generatedAt.getTime() > FEED_STALE_MS;

      // If stale, trigger background recomputation without blocking response
      if (isStale) {
        setImmediate(() => {
          computeAndStoreFeed(userId, normCategory, limit).catch((err) =>
            console.warn(`[ForYou] Background stale recompute failed for ${userId}:`, err.message)
          );
        });
      }

      // Hydrate cached post IDs
      const tHydrateStart = performance.now();
      const items = (cached.items as any[]) || [];
      let outfits = await hydratePosts(items.slice(0, limit));
      if (options.q && options.q.trim().length > 0) {
        outfits = filterOutfitsByQuery(outfits, options.q);
      }
      const tHydrateEnd = performance.now();

      if (debugTiming) {
        console.log(
          `[ForYou Timing] Cache HIT | Category: ${normCategory} | Hydration: ${(tHydrateEnd - tHydrateStart).toFixed(1)}ms | Total: ${(tHydrateEnd - t0).toFixed(1)}ms | Stale: ${isStale}`
        );
      }

      const userProfile = await getUserMeasurementProfile(userId);

      return {
        outfits,
        total: outfits.length,
        cached: true,
        isStarter: false,
        isStale,
        serverDurationMs: Math.round(tHydrateEnd - t0),
        generatedAt: cached.generatedAt,
        userProfile: {
          ...userProfile,
          traits: [
            `${userProfile.heightCm} cm Frame`,
            `${userProfile.bodyType} Silhouette`,
            `${userProfile.fitPreference} Cut`,
            `${userProfile.styleVibe} Vibe`,
          ],
        },
      };
    }

    // 2. No cache exists (New User) -> Return starter feed immediately and compute real feed in background
    const userProfile = await getUserMeasurementProfile(userId);
    let starterOutfits = await getStarterFeed(normCategory, userProfile, limit);
    if (options.q && options.q.trim().length > 0) {
      starterOutfits = filterOutfitsByQuery(starterOutfits, options.q);
    }

    setImmediate(() => {
      computeAndStoreFeed(userId, normCategory, limit).catch((err) =>
        console.warn(`[ForYou] Background initial feed computation failed for ${userId}:`, err.message)
      );
    });

    if (debugTiming) {
      console.log(
        `[ForYou Timing] Starter Feed (New User) | Category: ${normCategory} | Total: ${(performance.now() - t0).toFixed(1)}ms`
      );
    }

    return {
      outfits: starterOutfits,
      total: starterOutfits.length,
      cached: false,
      isStarter: true,
      isStale: false,
      generatedAt: new Date(),
      userProfile: {
        ...userProfile,
        traits: [
          `${userProfile.heightCm} cm Frame`,
          `${userProfile.bodyType} Silhouette`,
          `${userProfile.fitPreference} Cut`,
          `${userProfile.styleVibe} Vibe`,
        ],
      },
    };
  }

  // 3. Forced refresh -> Compute synchronously and store
  const { items, userProfile } = await computeAndStoreFeed(userId, normCategory, limit);
  const tHydrateStart = performance.now();
  let outfits = await hydratePosts(items.slice(0, limit));
  if (options.q && options.q.trim().length > 0) {
    outfits = filterOutfitsByQuery(outfits, options.q);
  }
  const tHydrateEnd = performance.now();

  if (debugTiming) {
    console.log(
      `[ForYou Timing] Forced Refresh | Category: ${normCategory} | Total: ${(tHydrateEnd - t0).toFixed(1)}ms`
    );
  }

  return {
    outfits,
    total: outfits.length,
    cached: false,
    isStarter: false,
    isStale: false,
    generatedAt: new Date(),
    userProfile: {
      ...userProfile,
      traits: [
        `${userProfile.heightCm} cm Frame`,
        `${userProfile.bodyType} Silhouette`,
        `${userProfile.fitPreference} Cut`,
        `${userProfile.styleVibe} Vibe`,
      ],
    },
  };
}

function filterOutfitsByQuery(outfits: any[], query: string): any[] {
  const q = query.trim().toLowerCase();
  return outfits.filter((item) => {
    return (
      (item.name && item.name.toLowerCase().includes(q)) ||
      (item.caption && item.caption.toLowerCase().includes(q)) ||
      (item.category && item.category.toLowerCase().includes(q)) ||
      (item.creator?.name && item.creator.name.toLowerCase().includes(q)) ||
      (item.creator?.handle && item.creator.handle.toLowerCase().includes(q)) ||
      (item.brand && item.brand.toLowerCase().includes(q)) ||
      (item.garments && item.garments.some((g: any) => g.name?.toLowerCase().includes(q) || g.brand?.toLowerCase().includes(q))) ||
      (item.tags && item.tags.some((t: string) => t.toLowerCase().includes(q)))
    );
  });
}

/**
 * Recomputes and updates the feed cache for a user (called after body profile update / onboarding).
 */
export async function refreshUserFeed(userId: string, category = "all"): Promise<void> {
  await computeAndStoreFeed(userId, normalizeCategory(category));
}

/**
 * Backwards compatibility helper: deletes feed cache entries for a user.
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
