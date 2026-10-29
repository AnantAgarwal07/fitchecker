import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { startTryOnSession } from "../services/tryOnPipeline.js";
import { requireAuth, authenticateUser } from "../middleware/auth.js";
import { deleteStorageObject } from "../services/storage.js";

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatSessionResponse(session: any) {
  const product = session.product;
  const primaryImg = product?.ProductImage?.[0]?.imageUrl;

  return {
    id: session.id,
    userId: session.userId,
    title: product?.name || "Virtual Try-On",
    brand: product?.brand || "Brand",
    price: Number(product?.currentPrice) || 0,
    visibility: session.visibility || "PRIVATE",
    isPrivate: session.visibility === "PRIVATE",
    isSaved: session.isSaved,
    mode: session.mode || "demo",
    status: session.status,
    date: formatDate(session.createdAt),
    createdAt: session.createdAt,
    image: session.renderedImageUrl || primaryImg,
    originalPhoto: session.inputPhotoUrl,
    garmentId: session.productId,
    fitScore: session.fitScore ? `${Math.round(session.fitScore)}%` : "90%",
    fitNote: session.fitNote || "Fits comfortably according to your body profile.",
    fitReport: session.fitReport,
    fitDescriptor: session.fitDescriptor,
    errorReason: session.errorReason,
    sizeSelected: session.sizeSelected || "M",
    garment: product
      ? {
          id: product.id,
          name: product.name,
          brand: product.brand,
          price: Number(product.currentPrice),
          image: primaryImg,
          shopUrl: product.productUrl,
        }
      : null,
    metadata: session.metadata,
  };
}

export const tryOnRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/v1/try-on (Submit Try-On Request)
  fastify.post(
    "/api/v1/try-on",
    {
      preHandler: requireAuth,
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "1 minute",
        },
      },
    },
    async (request, reply) => {
      const RequestSchema = z.object({
        userId: z.string().optional(),
        productId: z.number().int().positive(),
        userPhotoUrl: z.string().url().optional(),
        userPhotoId: z.string().optional(),
        userHeightCm: z.number().min(50).max(250).default(165),
        sizeSelected: z.string().default("M"),
      });

      const parsed = RequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.format() });
      }

      const effectiveUserId = request.user!.id; // Identity strictly from verified token

      const { productId, userPhotoUrl, userPhotoId, userHeightCm, sizeSelected } = parsed.data;

      // Verify product exists
      const productExists = await prisma.product.findUnique({
        where: { id: productId },
        select: { id: true },
      });

      if (!productExists) {
        return reply.status(404).send({ error: `Product #${productId} not found in catalog.` });
      }

      try {
        const jobInfo = await startTryOnSession({
          userId: effectiveUserId,
          productId,
          userPhotoUrl,
          userPhotoId,
          userHeightCm,
          sizeSelected,
        });

        return reply.status(202).send({
          message: "Virtual try-on job queued successfully",
          jobId: jobInfo.jobId,
          tryOnSessionId: jobInfo.tryOnSessionId,
          status: jobInfo.status,
          mode: jobInfo.mode,
          checkStatusUrl: `/api/v1/try-on/jobs/${jobInfo.jobId}`,
        });
      } catch (err: any) {
        if (err.code === "QUOTA_EXCEEDED") {
          return reply.status(429).send({ error: err.code, message: err.message });
        }
        if (err.code === "CONFIGURATION_ERROR") {
          return reply.status(500).send({ error: err.code, message: err.message });
        }
        console.error("[TryOn Route Error]:", err);
        return reply.status(500).send({ error: "TRYON_ERROR", message: err.message || err });
      }

    }
  );

  // GET /api/v1/try-on/jobs/:jobId (Poll Job Status from PostgreSQL DB)
  fastify.get("/api/v1/try-on/jobs/:jobId", async (request, reply) => {
    const { jobId } = request.params as { jobId: string };

    const job = await prisma.renderJob.findUnique({
      where: { id: jobId },
      include: {
        tryOnSession: true,
      },
    });

    if (!job) {
      return reply.status(404).send({ error: "Try-on job not found" });
    }

    const session = job.tryOnSession;

    let progressPercent = 0;
    if (job.status === "QUEUED") progressPercent = 10;
    else if (job.status === "PROCESSING") progressPercent = 50;
    else if (job.status === "COMPLETED") progressPercent = 100;
    else if (job.status === "FAILED") progressPercent = 0;

    return reply.status(200).send({
      jobId: job.id,
      tryOnSessionId: job.tryOnSessionId,
      status: job.status,
      attempts: job.attempts,
      mode: session?.mode || "demo",
      renderedImageUrl: session?.renderedImageUrl || null,
      fitScore: session?.fitScore,
      fitNote: session?.fitNote,
      fitReport: session?.fitReport,
      errorMessage: job.lastError || session?.errorReason || null,
      progressPercent,
      durationMs: job.durationMs,
      completedAt: job.completedAt,
    });
  });

  // GET /api/v1/try-on/sessions (List Sessions with Privacy Filter)
  fastify.get("/api/v1/try-on/sessions", { preHandler: authenticateUser }, async (request, reply) => {
    const QuerySchema = z.object({
      userId: z.string().optional(),
      limit: z.coerce.number().min(1).max(50).default(20),
      page: z.coerce.number().min(1).default(1),
    });

    const parsed = QuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.format() });
    }

    const { limit, page } = parsed.data;
    const callerId = request.user?.id;
    const requestedUserId = parsed.data.userId || callerId;
    if (!requestedUserId) {
      return reply.status(401).send({ error: "Unauthorized", message: "Authentication required" });
    }
    const isOwner = callerId === requestedUserId;

    const where: any = { userId: requestedUserId };
    // Non-owners can only see PUBLIC sessions
    if (!isOwner) {
      where.visibility = "PUBLIC";
    }

    const skip = (page - 1) * limit;

    const [total, sessions] = await Promise.all([
      prisma.tryOnSession.count({ where }),
      prisma.tryOnSession.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          product: {
            include: {
              ProductImage: { take: 1, orderBy: { position: "asc" } },
            },
          },
        },
      }),
    ]);

    return reply.status(200).send({
      sessions: sessions.map(formatSessionResponse),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  });

  // GET /api/v1/try-on/sessions/:id (Session Detail with Privacy Protection A2)
  fastify.get("/api/v1/try-on/sessions/:id", { preHandler: authenticateUser }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const session = await prisma.tryOnSession.findUnique({
      where: { id },
      include: {
        product: { include: { ProductImage: true } },
      },
    });

    if (!session) {
      return reply.status(404).send({ error: "Try-on session not found" });
    }

    // A2: Another user cannot read private try-on session (403)
    if (session.visibility === "PRIVATE" && session.userId !== request.user?.id) {
      return reply.status(403).send({
        error: "Forbidden",
        message: "This try-on session is marked private by the owner.",
      });
    }

    return reply.status(200).send(formatSessionResponse(session));
  });

  // PUT /api/v1/try-on/sessions/:id (Update session isSaved, isPrivate, or visibility)
  fastify.put("/api/v1/try-on/sessions/:id", { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const UpdateSchema = z.object({
      visibility: z.enum(["PRIVATE", "PUBLIC"]).optional(),
      isPrivate: z.boolean().optional(),
      isSaved: z.boolean().optional(),
    });

    const parsed = UpdateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.format() });
    }

    const session = await prisma.tryOnSession.findUnique({ where: { id } });
    if (!session) {
      return reply.status(404).send({ error: "Session not found" });
    }

    if (session.userId !== request.user!.id) {
      return reply.status(403).send({ error: "Forbidden: Not session owner" });
    }

    const data: any = {};
    if (parsed.data.visibility) {
      data.visibility = parsed.data.visibility;
      data.isPrivate = parsed.data.visibility === "PRIVATE";
    }
    if (parsed.data.isPrivate !== undefined) {
      data.isPrivate = parsed.data.isPrivate;
      data.visibility = parsed.data.isPrivate ? "PRIVATE" : "PUBLIC";
    }
    if (parsed.data.isSaved !== undefined) {
      data.isSaved = parsed.data.isSaved;
    }

    const updated = await prisma.tryOnSession.update({
      where: { id },
      data,
      include: {
        product: { include: { ProductImage: true } },
      },
    });

    return reply.status(200).send({
      success: true,
      session: formatSessionResponse(updated),
    });
  });

  // PATCH /api/v1/try-on/:id/visibility (Owner only, A2 requirement)
  fastify.patch("/api/v1/try-on/:id/visibility", { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const VisibilitySchema = z.object({
      visibility: z.enum(["PRIVATE", "PUBLIC"]),
    });

    const parsed = VisibilitySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Visibility must be PRIVATE or PUBLIC" });
    }

    const session = await prisma.tryOnSession.findUnique({ where: { id } });
    if (!session) {
      return reply.status(404).send({ error: "Session not found" });
    }

    if (session.userId !== request.user!.id) {
      return reply.status(403).send({ error: "Forbidden: Not session owner" });
    }

    const updated = await prisma.tryOnSession.update({
      where: { id },
      data: {
        visibility: parsed.data.visibility,
        isPrivate: parsed.data.visibility === "PRIVATE",
      },
      include: {
        product: { include: { ProductImage: true } },
      },
    });

    return reply.status(200).send({
      success: true,
      session: formatSessionResponse(updated),
    });
  });

  // DELETE /api/v1/try-on/:id (Owner only, A2 requirement)
  fastify.delete("/api/v1/try-on/:id", { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const session = await prisma.tryOnSession.findUnique({ where: { id } });
    if (!session) {
      return reply.status(404).send({ error: "Session not found" });
    }

    if (session.userId !== request.user!.id) {
      return reply.status(403).send({ error: "Forbidden: Not session owner" });
    }

    // Delete render image from storage
    if (session.renderedImageUrl && session.renderedImageUrl.includes("/renders/")) {
      const storageKey = session.renderedImageUrl.split("/uploads/")[1];
      if (storageKey) {
        await deleteStorageObject(storageKey);
      }
    }

    await prisma.renderJob.deleteMany({ where: { tryOnSessionId: id } });
    await prisma.tryOnSession.delete({ where: { id } });

    return reply.status(200).send({
      success: true,
      message: "Try-on session and associated assets deleted permanently.",
    });
  });
};
