import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { authenticateUser } from "../middleware/auth.js";

export const interactionRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/v1/interactions (Phase C2: User Interaction Logging)
  fastify.post("/api/v1/interactions", { preHandler: authenticateUser }, async (request, reply) => {
    const InteractionSchema = z.object({
      type: z.enum([
        "VIEW",
        "LIKE",
        "UNLIKE",
        "SAVE",
        "UNSAVE",
        "FOLLOW",
        "UNFOLLOW",
        "TRYON",
        "BUY_CLICK",
      ]),
      productId: z.number().optional(),
      postId: z.string().optional(),
      targetUserId: z.string().optional(),
      dwellTimeMs: z.number().min(0).optional(),
      meta: z.record(z.any()).optional(),
    });

    const parsed = InteractionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.format() });
    }

    const { type, productId, postId, targetUserId, dwellTimeMs, meta } = parsed.data;
    const userId = request.user?.id || (request.body as any)?.userId || "u-ananya-sharma-001";

    const interaction = await prisma.interaction.create({
      data: {
        userId,
        type,
        productId,
        postId,
        targetUserId,
        meta: {
          ...meta,
          dwellTimeMs,
        } as any,
      },
    });

    return reply.status(201).send({
      success: true,
      interactionId: interaction.id,
      type: interaction.type,
      loggedAt: interaction.createdAt,
    });
  });
};
