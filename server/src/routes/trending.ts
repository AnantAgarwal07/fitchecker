import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { calculateTrendingVelocity } from "../services/scoring.js";

export const trendingRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/api/v1/trending", async (request, reply) => {
    const QuerySchema = z.object({
      category: z.string().optional(),
      q: z.string().optional(),
      limit: z.coerce.number().min(1).max(50).default(20),
    });

    const parsed = QuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.format() });
    }

    const { category, q, limit } = parsed.data;

    const where: any = {};
    if (category && category !== "all") {
      where.category = { equals: category, mode: "insensitive" };
    }

    // Full search across caption, tags, category, creator, and products (Phase 5)
    if (q && q.trim().length > 0) {
      const searchTrimmed = q.trim();
      const searchLower = searchTrimmed.toLowerCase();
      const searchUpper = searchTrimmed.toUpperCase();
      const searchCaps = searchTrimmed.charAt(0).toUpperCase() + searchTrimmed.slice(1).toLowerCase();

      const searchFilter = {
        OR: [
          { caption: { contains: searchTrimmed, mode: "insensitive" } },
          { category: { contains: searchTrimmed, mode: "insensitive" } },
          { tags: { hasSome: [searchTrimmed, searchLower, searchUpper, searchCaps] } },
          { user: { name: { contains: searchTrimmed, mode: "insensitive" } } },
          { user: { handle: { contains: searchTrimmed, mode: "insensitive" } } },
          {
            products: {
              some: {
                product: {
                  OR: [
                    { name: { contains: searchTrimmed, mode: "insensitive" } },
                    { brand: { contains: searchTrimmed, mode: "insensitive" } },
                  ],
                },
              },
            },
          },
        ],
      };

      if (!where.AND) {
        where.AND = [searchFilter];
      } else {
        where.AND.push(searchFilter);
      }
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

    // Check if any posts have actual trending metric records
    const hasMetrics = posts.some((p) => p.trendingMetrics && p.trendingMetrics.length > 0);

    // Score posts
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

    if (hasMetrics) {
      // Sort descending by velocity score
      scoredPosts.sort((a, b) => b.velocityScore - a.velocityScore);
    } else {
      // If there are no TrendingMetric rows, rank by likes and recency
      scoredPosts.sort((a, b) => {
        if (b.post.likesCount !== a.post.likesCount) {
          return b.post.likesCount - a.post.likesCount;
        }
        return new Date(b.post.createdAt).getTime() - new Date(a.post.createdAt).getTime();
      });
    }

    const topScored = scoredPosts.slice(0, limit);

    // Format response to match frontend TrendingReelCard expectations
    const trendingLooks = topScored.map(({ post, velocityScore }, index) => {
      const garments = (post.products || []).map((pp) => {
        const itemUrl = pp.product.productUrl || "https://www.myntra.com";
        return {
          id: pp.product.id,
          name: pp.product.name,
          brand: pp.product.brand || "Brand",
          price: Number(pp.product.currentPrice) || Number(post.price) || 0,
          image: pp.product.ProductImage[0]?.imageUrl || post.imageUrl,
          category: pp.product.category,
          shopUrl: itemUrl,
          shoppingUrl: itemUrl,
          productUrl: itemUrl,
        };
      });

      const primaryUrl = garments[0]?.shopUrl || "https://www.myntra.com";

      const defaultGarment = garments[0] || {
        id: `prod-${post.id}`,
        name: post.caption || "Featured Look",
        brand: post.user.name,
        price: Number(post.price) || 0,
        image: post.imageUrl,
        shopUrl: primaryUrl,
        shoppingUrl: primaryUrl,
        productUrl: primaryUrl,
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
        shoppingUrl: primaryUrl,
        shopUrl: primaryUrl,
      };
    });

    return reply.status(200).send({
      trendingLooks,
      total: trendingLooks.length,
    });
  });
};
