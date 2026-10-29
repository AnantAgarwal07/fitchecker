import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { authenticateUser, requireAuth } from "../middleware/auth.js";


// Helper to format time ago string like "2h ago", "1d ago"
function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// Helper to format post response into frontend PostCard shape
function formatPostResponse(post: any) {
  const taggedProducts = (post.products || []).map((pp: any) => {
    const primaryImg = pp.product?.ProductImage?.[0]?.imageUrl || post.imageUrl;
    const itemUrl = pp.product?.productUrl || "https://www.myntra.com";
    return {
      id: pp.product?.id || pp.productId,
      name: pp.product?.name || "Garment",
      brand: pp.product?.brand || "Brand",
      price: Number(pp.product?.currentPrice) || Number(post.price) || 0,
      originalPrice: Number(pp.product?.originalPrice) || Number(post.price) || 0,
      image: primaryImg,
      garmentType: pp.garmentType || pp.product?.productType || "apparel",
      category: pp.product?.category || post.category,
      xPercent: pp.xPercent,
      yPercent: pp.yPercent,
      shopUrl: itemUrl,
      shoppingUrl: itemUrl,
      productUrl: itemUrl,
    };
  });

  const primaryShoppingUrl = taggedProducts[0]?.shopUrl || "https://www.myntra.com";

  return {
    id: post.id,
    user: {
      id: post.user.id,
      name: post.user.name,
      handle: post.user.handle.startsWith("@") ? post.user.handle : `@${post.user.handle}`,
      location: post.user.location || "Global",
      avatar: post.user.avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
      verified: post.user.verified,
      isRetailer: post.user.isRetailer,
    },
    image: post.imageUrl,
    fallbackImage: post.fallbackImageUrl || post.imageUrl,
    alt: `${post.caption || "Outfit"} by ${post.user.name}`,
    caption: post.caption || "",
    tags: post.tags || [],
    likes: post.likesCount,
    shares: post.sharesCount > 1000 ? `${(post.sharesCount / 1000).toFixed(1)}k` : `${post.sharesCount}`,
    sharesNumber: post.sharesCount,
    timeAgo: formatTimeAgo(post.createdAt),
    category: post.category || "casual",
    price: Number(post.price) || (taggedProducts[0]?.price ?? 0),
    rating: post.rating || 4.5,
    taggedCount: taggedProducts.length,
    products: taggedProducts,
    garments: taggedProducts,
    shoppingUrl: primaryShoppingUrl,
    shopUrl: primaryShoppingUrl,
  };
}

export const postRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/posts
  fastify.get("/api/v1/posts", { preHandler: authenticateUser }, async (request, reply) => {
    const QuerySchema = z.object({
      tab: z.enum(["all", "following", "trending", "casual", "streetwear", "ethnic wear", "formal", "party wear", "dresses", "college outfits"]).optional().default("all"),
      category: z.string().optional(),
      userId: z.string().optional(),
      q: z.string().optional(),
      limit: z.coerce.number().min(1).max(50).default(20),
      page: z.coerce.number().min(1).default(1),
    });

    const parsed = QuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.format() });
    }

    const { tab, category, userId, q, limit, page } = parsed.data;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (userId) {
      where.userId = userId;
    }

    // Filter by category or tab
    const effectiveCategory = category || (tab !== "all" && tab !== "following" && tab !== "trending" ? tab : undefined);
    if (effectiveCategory) {
      where.category = { equals: effectiveCategory, mode: "insensitive" };
    }

    // Filter by following if tab === "following" (Phase C1)
    if (tab === "following") {
      const followerId = request.user?.id;
      if (!followerId) {
        return reply.status(200).send({
          posts: [],
          pagination: { total: 0, page, limit, totalPages: 0, hasMore: false },
        });
      }
      const following = await prisma.follow.findMany({
        where: { followerId },
        select: { followingId: true },
      });
      const followingIds = following.map((f) => f.followingId);
      where.userId = { in: followingIds.length > 0 ? followingIds : ["__none__"] };
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


    // Order by trending velocity or recency
    const orderBy: any = tab === "trending"
      ? [{ likesCount: "desc" }, { createdAt: "desc" }]
      : [{ createdAt: "desc" }];

    const [total, posts] = await Promise.all([
      prisma.post.count({ where }),
      prisma.post.findMany({
        where,
        skip,
        take: limit,
        orderBy,
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
      }),
    ]);

    return reply.status(200).send({
      posts: posts.map(formatPostResponse),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + posts.length < total,
      },
    });
  });

  // GET /api/v1/posts/:id
  fastify.get("/api/v1/posts/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    const post = await prisma.post.findUnique({
      where: { id },
      include: {
        user: true,
        products: {
          include: {
            product: {
              include: {
                ProductImage: true,
              },
            },
          },
        },
      },
    });

    if (!post) {
      return reply.status(404).send({ error: "Post not found" });
    }

    return reply.status(200).send(formatPostResponse(post));
  });

  // POST /api/v1/posts/:id/like (Phase 3: requireAuth enforced, identity from token)
  fastify.post("/api/v1/posts/:id/like", { preHandler: requireAuth }, async (request, reply) => {
    const { id: postId } = request.params as { id: string };
    const userId = request.user!.id;

    const existingLike = await prisma.postLike.findUnique({
      where: { postId_userId: { postId, userId } },
    });

    let isLiked = false;
    let post;

    if (existingLike) {
      // Unlike
      await prisma.postLike.delete({ where: { id: existingLike.id } });
      post = await prisma.post.update({
        where: { id: postId },
        data: { likesCount: { decrement: 1 } },
      });
      isLiked = false;
    } else {
      // Like
      await prisma.postLike.create({
        data: { postId, userId },
      });
      post = await prisma.post.update({
        where: { id: postId },
        data: { likesCount: { increment: 1 } },
      });
      isLiked = true;
    }

    return reply.status(200).send({
      postId,
      isLiked,
      likesCount: post.likesCount,
    });
  });

  // Comments are stored as Interaction records so they can be used by the feed scorer
  // without introducing a second social-event store.
  fastify.get("/api/v1/posts/:id/comments", { preHandler: authenticateUser }, async (request, reply) => {
    const { id: postId } = request.params as { id: string };
    const comments = await prisma.interaction.findMany({
      where: { postId, type: "COMMENT" },
      include: { user: { select: { handle: true, name: true, avatarUrl: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return reply.status(200).send({
      comments: comments.map((comment) => ({
        id: comment.id,
        text: (comment.meta as { text?: string } | null)?.text || "",
        createdAt: comment.createdAt,
        author: {
          handle: comment.user.handle.startsWith("@") ? comment.user.handle : `@${comment.user.handle}`,
          name: comment.user.name,
          avatar: comment.user.avatarUrl,
        },
      })),
    });
  });

  fastify.post("/api/v1/posts/:id/comments", { preHandler: requireAuth }, async (request, reply) => {
    const { id: postId } = request.params as { id: string };
    const parsed = z.object({ text: z.string().trim().min(1).max(500) }).safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.format() });

    const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true } });
    if (!post) return reply.status(404).send({ error: "Post not found" });

    const comment = await prisma.interaction.create({
      data: { userId: request.user!.id, postId, type: "COMMENT", meta: { text: parsed.data.text } },
      include: { user: { select: { handle: true, name: true, avatarUrl: true } } },
    });
    return reply.status(201).send({
      comment: {
        id: comment.id,
        text: parsed.data.text,
        createdAt: comment.createdAt,
        author: {
          handle: comment.user.handle.startsWith("@") ? comment.user.handle : `@${comment.user.handle}`,
          name: comment.user.name,
          avatar: comment.user.avatarUrl,
        },
      },
    });
  });

  // POST /api/v1/posts (Phase C1: Create Look)
  fastify.post("/api/v1/posts", { preHandler: requireAuth }, async (request, reply) => {
    const CreateSchema = z.object({
      caption: z.string().optional(),
      imageUrl: z.string().url(),
      fallbackImageUrl: z.string().url().optional(),
      category: z.string().default("casual"),
      tags: z.array(z.string()).default([]),
      price: z.number().optional(),
      products: z.array(
        z.object({
          productId: z.number(),
          xPercent: z.number().optional(),
          yPercent: z.number().optional(),
          garmentType: z.string().optional(),
        })
      ).default([]),
    });

    const parsed = CreateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.format() });
    }

    const { caption, imageUrl, fallbackImageUrl, category, tags, price, products } = parsed.data;
    const authorId = request.user!.id;

    const newPost = await prisma.post.create({
      data: {
        userId: authorId,
        caption,
        imageUrl,
        fallbackImageUrl,
        category,
        tags,
        price,
        products: {
          create: products.map((p) => ({
            productId: p.productId,
            xPercent: p.xPercent,
            yPercent: p.yPercent,
            garmentType: p.garmentType,
          })),
        },
      },
      include: {
        user: true,
        products: {
          include: {
            product: {
              include: { ProductImage: true },
            },
          },
        },
      },
    });

    return reply.status(201).send(formatPostResponse(newPost));
  });

  // DELETE /api/v1/posts/:id (Phase C1: Delete Look, Author Only)
  fastify.delete("/api/v1/posts/:id", { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const post = await prisma.post.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });

    if (!post) {
      return reply.status(404).send({ error: "Post not found" });
    }

    if (post.userId !== request.user!.id) {
      return reply.status(403).send({
        error: "Forbidden",
        message: "You can only delete posts that you authored.",
      });
    }

    await prisma.post.delete({
      where: { id },
    });

    return reply.status(200).send({
      message: "Post deleted successfully",
      id,
    });
  });
};

