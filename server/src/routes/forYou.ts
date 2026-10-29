import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { getPersonalizedFeed } from "../recommender/index.js";

export const forYouRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/for-you (Phase 4: Fast DB-Backed Cached For You Feed with Stale-While-Revalidate)
  fastify.get("/api/v1/for-you", { preHandler: requireAuth }, async (request, reply) => {
    // Custom boolean preprocessor so that "false" string correctly parses to boolean false
    const booleanPreprocessor = (val: unknown) => {
      if (typeof val === "boolean") return val;
      if (typeof val === "string") {
        const lower = val.trim().toLowerCase();
        if (lower === "true" || lower === "1") return true;
        if (lower === "false" || lower === "0") return false;
      }
      return false;
    };

    const QuerySchema = z.object({
      userId: z.string().optional(),
      category: z.string().optional(),
      q: z.string().optional(),
      limit: z.coerce.number().min(1).max(50).default(20),
      refresh: z.preprocess(booleanPreprocessor, z.boolean()).optional().default(false),
      forceRefresh: z.preprocess(booleanPreprocessor, z.boolean()).optional().default(false),
    });

    const parsed = QuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.format() });
    }

    const { category, q, limit, refresh, forceRefresh } = parsed.data;
    const shouldRefresh = refresh || forceRefresh;
    const effectiveUserId = request.user!.id;

    const result = await getPersonalizedFeed(effectiveUserId, {
      category,
      q,
      limit,
      refresh: shouldRefresh,
    });

    return reply.status(200).send(result);
  });
};
