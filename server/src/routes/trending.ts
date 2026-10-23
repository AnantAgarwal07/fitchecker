import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { calculateTrendingVelocity } from "../services/scoring.js";

export const trendingRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/api/v1/trending", async (request, reply) => {
    const QuerySchema = z.object({
      category: z.string().optional(),
      limit: z.coerce.number().min(1).max(50).default(20),
    });

    const parsed = QuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.format() });
    }

    const { category, limit } = parsed.data;

    const where: any = {};
    if (category && category !== "all") {
      where.category = { equals: category, mode: "insensitive" };
    }

    const posts = await prisma.post.findMany({
      where,
      take: 50,
      include: {
        user: true,
        trendingMetrics: {
          take: 1,
          orderBy: { calculatedAt: "desc" },
        },
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

    // Score dynamically using calculateTrendingVelocity
    const scoredPosts = posts.map((post) => {
      const metric = post.trendingMetrics[0];
      const velocityScore = calculateTrendingVelocity({
        viewsCount: metric?.viewsCount || post.likesCount * 6,
        likesCount: post.likesCount,
        sharesCount: post.sharesCount,
        tryOnCount: metric?.tryOnCount || Math.floor(post.sharesCount / 2),
        createdAt: post.createdAt,
      });

      return {
        post,
        velocityScore,
      };
    });

    // Sort descending by velocity score
    scoredPosts.sort((a, b) => b.velocityScore - a.velocityScore);
    const topScored = scoredPosts.slice(0, limit);

    // Format response to match frontend TrendingReelCard expectations
    const trendingLooks = topScored.map(({ post, velocityScore }, index) => {
      const garments = (post.products || []).map((pp) => ({
        id: pp.product.id,
        name: pp.product.name,
        brand: pp.product.brand || "Brand",
        price: Number(pp.product.currentPrice) || Number(post.price) || 0,
        image: pp.product.ProductImage[0]?.imageUrl || post.imageUrl,
        category: pp.product.category,
        shopUrl: pp.product.productUrl,
      }));

      const defaultGarment = garments[0] || {
        id: `prod-${post.id}`,
        name: post.caption || "Featured Look",
        brand: post.user.name,
        price: Number(post.price) || 0,
        image: post.imageUrl,
        shopUrl: "https://www.myntra.com",
      };

      return {
        id: `trend-${post.id}`,
        outfitId: post.id,
        category: post.category || "casual",
        title: post.caption || "Trending Style",
        rankingBadge: `TRENDING #${index + 1} WORLDWIDE`,
        image: post.imageUrl,
        fallbackImage: post.fallbackImageUrl || post.imageUrl,
        alt: `${post.caption || "Look"} by ${post.user.name}`,
        creator: {
          id: post.user.id,
          name: post.user.name,
          handle: post.user.handle.startsWith("@") ? post.user.handle : `@${post.user.handle}`,
          role: post.user.isRetailer ? "Official Brand" : "Pro Stylist",
          avatar: post.user.avatarUrl || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
          verified: post.user.verified,
          isRetailer: post.user.isRetailer,
          isFollowing: false,
        },
        likes: post.likesCount > 1000 ? `${(post.likesCount / 1000).toFixed(1)}k` : `${post.likesCount}`,
        likesNumber: post.likesCount,
        shares: `${post.sharesCount}`,
        capsuleName: `${post.user.name} Collection`,
        price: Number(post.price) || defaultGarment.price,
        priceRange: `₹${Math.max(199, (Number(post.price) || 500) - 200)} – ₹${Number(post.price) || 800}`,
        rating: post.rating || 4.7,
        velocityScore,
        garments,
        defaultGarment,
      };
    });

    return reply.status(200).send({
      trendingLooks,
      total: trendingLooks.length,
    });
  });
};
