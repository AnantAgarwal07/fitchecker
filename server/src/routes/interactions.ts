import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

export const interactionRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/v1/interactions (Phase 3: User Interaction Logging requires authenticated token)
  fastify.post("/api/v1/interactions", { preHandler: requireAuth }, async (request, reply) => {
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
    const userId = request.user!.id;

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
