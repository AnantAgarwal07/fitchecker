import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { authenticateUser } from "../middleware/auth.js";
import {
  recommendSizeAndFit,
  calculateMatchScore,
  UserMeasurementProfile,
} from "../services/scoring.js";
import { ProductSizeChart } from "../services/sizeChart.js";


// Non-wearable categories to exclude by default for try-on & fashion feed
const NON_WEARABLE_CATEGORIES = [
  "beauty",
  "makeup",
  "skincare",
  "hair care",
  "shampoo",
  "conditioner",
  "grooming",
  "Home Decor",
  "home decor",
  "home",
  "home & kitchen",
  "home & living",
  "home and kitchen",
  "home and lifestyle",
  "home and living",
  "home furnishing",
  "kitchenware",
  "wall art",
  "bedding",
  "bath",
  "Water Bottle",
  "Wallets",
  "wallets",
  "watches",
  "watch gift set",
  "travel accessories",
  "sports accessories",
  "baby care",
];

// Helper to extract unique size labels like ['XS', 'S', 'M', 'L', 'XL'] from rawSizes
function extractSizes(rawSizes: any): string[] {
  if (!rawSizes || !Array.isArray(rawSizes)) {
    return ["S", "M", "L", "XL"];
  }
  const sizes = new Set<string>();
  for (const item of rawSizes) {
    if (item && item.size) {
      sizes.add(String(item.size).trim());
    }
  }
  return sizes.size > 0 ? Array.from(sizes) : ["S", "M", "L", "XL"];
}

function formatProductSummary(product: any) {
  const images = (product.ProductImage || []).map((img: any) => img.imageUrl);
  const primaryImage = images[0] || "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&auto=format&fit=crop&q=80";

  return {
    id: product.id,
    sourceProductId: product.sourceProductId,
    name: product.name,
    brand: product.brand || "Brand",
    price: Number(product.currentPrice) || 0,
    originalPrice: Number(product.originalPrice) || Number(product.currentPrice) || 0,
    discountPercent: product.discountPercent,
    rating: product.rating || 4.2,
    reviewCount: product.ratingsCount || 50,
    image: primaryImage,
    images,
    sizes: extractSizes(product.rawSizes),
    category: product.category,
    productType: product.productType,
    color: product.color,
    occasion: product.occasion,
    fit: product.fit,
    audience: product.audience,
    shopUrl: product.productUrl,
  };
}

export const productRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/products
  fastify.get("/api/v1/products", async (request, reply) => {
    const QuerySchema = z.object({
      q: z.string().optional(),
      category: z.string().optional(),
      audience: z.string().optional(),
      minPrice: z.coerce.number().optional(),
      maxPrice: z.coerce.number().optional(),
      wearableOnly: z
        .preprocess((val) => (val === undefined ? true : val === "true" || val === true), z.boolean())
        .default(true),
      limit: z.coerce.number().min(1).max(100).default(20),
      page: z.coerce.number().min(1).default(1),
    });

    const parsed = QuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.format() });
    }

    const { q, category, audience, minPrice, maxPrice, wearableOnly, limit, page } = parsed.data;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (wearableOnly) {
      where.category = { notIn: NON_WEARABLE_CATEGORIES };
    }

    if (category) {
      where.category = { equals: category, mode: "insensitive" };
    }

    if (audience) {
      where.audience = { equals: audience, mode: "insensitive" };
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      where.currentPrice = {};
      if (minPrice !== undefined) where.currentPrice.gte = minPrice;
      if (maxPrice !== undefined) where.currentPrice.lte = maxPrice;
    }

    if (q && q.trim().length > 0) {
      const searchTerms = q.trim();
      where.OR = [
        { name: { contains: searchTerms, mode: "insensitive" } },
        { brand: { contains: searchTerms, mode: "insensitive" } },
        { description: { contains: searchTerms, mode: "insensitive" } },
        { productType: { contains: searchTerms, mode: "insensitive" } },
        { category: { contains: searchTerms, mode: "insensitive" } },
      ];
    }

    const [total, products] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ rating: "desc" }, { id: "asc" }],
        include: {
          ProductImage: {
            orderBy: { position: "asc" },
          },
        },
      }),
    ]);

    return reply.status(200).send({
      products: products.map(formatProductSummary),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + products.length < total,
      },
    });
  });

  // GET /api/v1/products/:id
  fastify.get("/api/v1/products/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const productId = parseInt(id, 10);

    if (isNaN(productId)) {
      return reply.status(400).send({ error: "Invalid product id, must be integer" });
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        ProductImage: {
          orderBy: { position: "asc" },
        },
      },
    });

    if (!product) {
      return reply.status(404).send({ error: "Product not found" });
    }

    const summary = formatProductSummary(product);

    return reply.status(200).send({
      ...summary,
      description: product.description,
      material: product.material,
      styleTags: product.styleTags,
      rawSizes: product.rawSizes,
      rawDetails: product.rawDetails,
      rawSpecifications: product.rawSpecifications,
      aiAttributes: product.aiAttributes,
    });
  });

  // GET /api/v1/products/:id/fit (Phase B5: Per-area ease fit report & size recommendation)
  fastify.get("/api/v1/products/:id/fit", { preHandler: authenticateUser }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const productId = parseInt(id, 10);

    if (isNaN(productId)) {
      return reply.status(400).send({ error: "Invalid product id, must be integer" });
    }

    const QuerySchema = z.object({
      chestCm: z.coerce.number().optional(),
      bustChestCm: z.coerce.number().optional(),
      waistCm: z.coerce.number().optional(),
      hipsCm: z.coerce.number().optional(),
      heightCm: z.coerce.number().optional(),
      shoulderCm: z.coerce.number().optional(),
      inseamCm: z.coerce.number().optional(),
      fitPreference: z.enum(["tight", "fitted", "regular", "relaxed", "oversized"]).optional(),
    });

    const parsedQuery = QuerySchema.safeParse(request.query);
    const qData = parsedQuery.success ? parsedQuery.data : {};

    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return reply.status(404).send({ error: "Product not found" });
    }

    // Lookup user profile if authenticated
    let profile = null;
    if (request.user?.id) {
      profile = await prisma.bodyProfile.findUnique({
        where: { userId: request.user.id },
      });
    }

    const userProfile: UserMeasurementProfile = {
      heightCm: qData.heightCm ?? profile?.heightCm ?? null,
      chestCm: qData.chestCm ?? qData.bustChestCm ?? profile?.chestCm ?? profile?.bustChestCm ?? null,
      bustChestCm: qData.bustChestCm ?? qData.chestCm ?? profile?.bustChestCm ?? profile?.chestCm ?? null,
      waistCm: qData.waistCm ?? profile?.waistCm ?? null,
      hipsCm: qData.hipsCm ?? profile?.hipsCm ?? null,
      shoulderCm: qData.shoulderCm ?? profile?.shoulderCm ?? null,
      inseamCm: qData.inseamCm ?? profile?.inseamCm ?? null,
      fitPreference: qData.fitPreference ?? profile?.fitPreference ?? "regular",
      styleVibe: profile?.styleVibe ?? null,
      gender: profile?.gender ?? (product.audience === "men" ? "men" : "women"),
      bodyType: profile?.bodyType ?? null,
    };

    const sizeChart = product.sizeChart as ProductSizeChart | null;
    const recommendation = recommendSizeAndFit(userProfile, sizeChart);
    const matchResult = calculateMatchScore(userProfile, product);

    return reply.status(200).send({
      productId: product.id,
      productName: product.name,
      sizeChart: product.sizeChart,
      recommendedSize: recommendation.recommendedSize,
      alternatives: recommendation.alternatives,
      fitReport: recommendation.fitReport,
      fitDescriptor: recommendation.fitDescriptor,
      matchScore: matchResult.matchScore,
      measuredFit: recommendation.measuredFit,
      isEstimate: matchResult.isEstimate,
      confidence: recommendation.confidence,
      fitNote: recommendation.humanReadableNotes,
      breakdown: matchResult.breakdown,
    });
  });

  // GET /api/v1/products/:id/go (Phase C2: Outbound Click Tracker & Affiliate Redirect)
  fastify.get("/api/v1/products/:id/go", { preHandler: authenticateUser }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const productId = parseInt(id, 10);

    if (isNaN(productId)) {
      return reply.status(400).send({ error: "Invalid product id, must be integer" });
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, productUrl: true },
    });

    if (!product) {
      return reply.status(404).send({ error: "Product not found" });
    }

    if (request.user?.id) {
      // Asynchronously log BUY_CLICK interaction event
      prisma.interaction.create({
        data: {
          userId: request.user.id,
          productId,
          type: "BUY_CLICK",
        },
      }).catch((err) => console.warn("Failed to log BUY_CLICK interaction:", err.message));
    }

    const targetUrl = product.productUrl || "https://www.myntra.com";
    return reply.redirect(targetUrl, 302);
  });
};


