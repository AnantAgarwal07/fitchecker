import { FastifyPluginAsync } from "fastify";
import { prisma } from "../db.js";

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/api/health", async (_request, reply) => {
    try {
      const startTime = Date.now();
      // Check database connection by running a simple query
      await prisma.$queryRaw`SELECT 1`;
      const dbLatencyMs = Date.now() - startTime;

      return reply.status(200).send({
        status: "ok",
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.floor(process.uptime()),
        database: {
          status: "connected",
          latencyMs: dbLatencyMs,
        },
        memoryUsage: process.memoryUsage(),
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(503).send({
        status: "degraded",
        timestamp: new Date().toISOString(),
        database: {
          status: "disconnected",
          error: error.message,
        },
      });
    }
  });
};
