import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

export const savedRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/saved (Phase C1: List Saved Products/Looks)
  fastify.get("/api/v1/saved", { preHandler: requireAuth }, async (request, reply) => {
    const QuerySchema = z.object({
      limit: z.coerce.number().min(1).max(100).default(30),
      page: z.coerce.number().min(1).default(1),
    });

    const parsed = QuerySchema.safeParse(request.query);
    const { limit, page } = parsed.success ? parsed.data : { limit: 30, page: 1 };
    const skip = (page - 1) * limit;
    const userId = request.user!.id;

    const [total, items] = await Promise.all([
      prisma.savedItem.count({ where: { userId } }),
      prisma.savedItem.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          product: {
            include: {
              ProductImage: {
                orderBy: { position: "asc" },
                take: 2,
              },
            },
          },
        },
      }),
    ]);

    return reply.status(200).send({
      savedItems: items.map((item) => {
        const prod = item.product;
        const primaryImage =
          prod.ProductImage[0]?.imageUrl ||
          "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&auto=format&fit=crop&q=80";

        return {
          id: item.id,
          productId: prod.id,
          savedAt: item.createdAt,
          product: {
            id: prod.id,
            name: prod.name,
            brand: prod.brand || "Brand",
            price: Number(prod.currentPrice) || 0,
            originalPrice: Number(prod.originalPrice) || Number(prod.currentPrice) || 0,
            image: primaryImage,
            images: prod.ProductImage.map((img) => img.imageUrl),
            category: prod.category,
            productType: prod.productType,
            fit: prod.fit,
            rating: prod.rating || 4.5,
            shopUrl: prod.productUrl,
          },
        };
      }),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  });

  // POST /api/v1/saved/:productId (Phase C1: Save Product/Look)
  fastify.post("/api/v1/saved/:productId", { preHandler: requireAuth }, async (request, reply) => {
    const { productId: rawId } = request.params as { productId: string };
    const productId = parseInt(rawId, 10);

    if (isNaN(productId)) {
      return reply.status(400).send({ error: "Invalid productId, must be integer" });
    }

    const userId = request.user!.id;

    // Verify product exists in catalog
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true },
    });

    if (!product) {
      return reply.status(404).send({ error: `Product #${productId} not found.` });
    }

    // Upsert saved item atomically
    const saved = await prisma.savedItem.upsert({
      where: {
        userId_productId: { userId, productId },
      },
      update: {},
      create: { userId, productId },
    });

    // Log SAVE interaction asynchronously (Phase C2)
    prisma.interaction.create({
      data: {
        userId,
        productId,
        type: "SAVE",
      },
    }).catch((err) => console.warn("Failed to log SAVE interaction:", err.message));

    return reply.status(200).send({
      saved: true,
      savedItemId: saved.id,
      productId,
      userId,
      message: `${product.name} saved to your collection`,
    });
  });

  // DELETE /api/v1/saved/:productId (Phase C1: Remove Saved Product/Look)
  fastify.delete("/api/v1/saved/:productId", { preHandler: requireAuth }, async (request, reply) => {
    const { productId: rawId } = request.params as { productId: string };
    const productId = parseInt(rawId, 10);

    if (isNaN(productId)) {
      return reply.status(400).send({ error: "Invalid productId, must be integer" });
    }

    const userId = request.user!.id;

    await prisma.savedItem.deleteMany({
      where: { userId, productId },
    });

    // Log UNSAVE interaction asynchronously (Phase C2)
    prisma.interaction.create({
      data: {
        userId,
        productId,
        type: "UNSAVE",
      },
    }).catch((err) => console.warn("Failed to log UNSAVE interaction:", err.message));

    return reply.status(200).send({
      saved: false,
      productId,
      userId,
      message: "Removed from saved items",
    });
  });
};
