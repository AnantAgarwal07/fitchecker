import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { calculateMatchScore, UserMeasurementProfile } from "../services/scoring.js";
import { authenticateUser } from "../middleware/auth.js";
import { diversifyRecommendations } from "../recommender/index.js";

export const forYouRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/for-you (Phase C3: Personalized Recommendations Feed)
  fastify.get("/api/v1/for-you", { preHandler: authenticateUser }, async (request, reply) => {
    const QuerySchema = z.object({
      userId: z.string().optional(),
      category: z.string().optional(),
      limit: z.coerce.number().min(1).max(50).default(20),
      forceRefresh: z.coerce.boolean().optional().default(false),
    });

    const parsed = QuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.format() });
    }

    const { category, limit } = parsed.data;
    const effectiveUserId = request.user?.id || parsed.data.userId || "u-ananya-sharma-001";

    // 1. Fetch user and comprehensive body profile (Phase B1 & C3)
    const user = await prisma.user.findUnique({
      where: { id: effectiveUserId },
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

    const where: any = {};
    if (category && category !== "all") {
      where.category = { equals: category, mode: "insensitive" };
    }

    // 2. Fetch candidate posts with tagged products
    const posts = await prisma.post.findMany({
      where,
      take: 60,
      include: {
        user: true,
        products: {
          include: {
            product: {
              include: {
                ProductImage: {
                  orderBy: { position: "asc" },
                },
              },
            },
          },
        },
      },
    });

    // 3. Score each outfit against user's physical measurements & style vibe
    const scoredOutfits = posts.map((post) => {
      const primaryProduct = post.products[0]?.product;

      const scoreResult = calculateMatchScore(
        userProfile,
        primaryProduct || {
          category: post.category,
          productType: "apparel",
          fit: "regular",
          occasion: "casual",
          audience: userProfile.gender === "men" ? "men" : "women",
        }
      );

      const garments = (post.products || []).map((pp) => ({
        id: pp.product.id,
        name: pp.product.name,
        brand: pp.product.brand || "Brand",
        price: Number(pp.product.currentPrice) || Number(post.price) || 0,
        image: pp.product.ProductImage[0]?.imageUrl || post.imageUrl,
        category: pp.product.category,
        productType: pp.product.productType,
        shopUrl: pp.product.productUrl,
      }));

      const defaultGarment = garments[0] || {
        id: `prod-${post.id}`,
        name: post.caption || "Recommended Outfit",
        brand: post.user.name,
        price: Number(post.price) || 0,
        image: post.imageUrl,
        category: post.category,
        shopUrl: "https://www.myntra.com",
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
        matchScore: scoreResult.matchScore,
        fitScore: `${scoreResult.matchScore}%`,
        fitNote: scoreResult.fitNote,
        fitDescriptor: scoreResult.fitDescriptor,
        fitReport: scoreResult.fitReport,
        breakdown: scoreResult.breakdown,
        creator: {
          id: post.user.id,
          name: post.user.name,
          handle: post.user.handle.startsWith("@") ? post.user.handle : `@${post.user.handle}`,
          avatar: post.user.avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
          verified: post.user.verified,
          isRetailer: post.user.isRetailer,
        },
        garments,
        defaultGarment,
      };
    });

    // 4. Sort descending by personalized match score
    scoredOutfits.sort((a, b) => b.matchScore - a.matchScore);

    // 5. Apply diversification (max 2 per brand, max 3 per category in top 10)
    const diversifiedOutfits = diversifyRecommendations(scoredOutfits, limit);

    return reply.status(200).send({
      outfits: diversifiedOutfits,
      total: diversifiedOutfits.length,
      userProfile: {
        heightCm: userProfile.heightCm,
        bodyType: userProfile.bodyType,
        fitPreference: userProfile.fitPreference,
        styleVibe: userProfile.styleVibe,
        chestCm: userProfile.chestCm,
        waistCm: userProfile.waistCm,
        hipsCm: userProfile.hipsCm,
      },
    });
  });
};
