import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import { validateAuthConfig } from "./middleware/auth.js";
import { healthRoutes } from "./routes/health.js";
import { postRoutes } from "./routes/posts.js";
import { trendingRoutes } from "./routes/trending.js";
import { forYouRoutes } from "./routes/forYou.js";
import { productRoutes } from "./routes/products.js";
import { userRoutes } from "./routes/users.js";
import { tryOnRoutes } from "./routes/tryOn.js";
import { photoRoutes } from "./routes/photos.js";
import { savedRoutes } from "./routes/saved.js";
import { interactionRoutes } from "./routes/interactions.js";
import { prisma } from "./db.js";


import fastifyStatic from "@fastify/static";
import { UPLOADS_DIR } from "./services/storage.js";

// Validate security constraints at boot
validateAuthConfig();

export function buildServer() {
  const server = Fastify({
    logger: process.env.NODE_ENV !== "test",
  });

  // Register content-type parser for images before routes
  server.addContentTypeParser(
    /^image\/(jpeg|png|webp)$/,
    { parseAs: "buffer", bodyLimit: 10 * 1024 * 1024 },
    (req, body, done) => done(null, body)
  );

  return server;
}

export async function setupApp(server: ReturnType<typeof buildServer>) {
  // Clear JSON errors for 413 and 415
  server.setErrorHandler((error, request, reply) => {
    const fastifyError = error as { statusCode?: number; code?: string };
    const statusCode = fastifyError.statusCode;
    const errorCode = fastifyError.code;
    if (statusCode === 413 || errorCode === "FST_ERR_CTP_BODY_TOO_LARGE") {
      return reply.status(413).send({
        error: "PayloadTooLarge",
        message: "Image payload exceeds maximum limit of 10 MB.",
      });
    }
    if (statusCode === 415 || errorCode === "FST_ERR_CTP_INVALID_MEDIA_TYPE") {
      return reply.status(415).send({
        error: "UnsupportedMediaType",
        message: "Unsupported media type. Only image/jpeg, image/png, and image/webp are supported.",
      });
    }
    reply.send(error);
  });

  // 1. Security Headers via Helmet
  await server.register(helmet, {
    contentSecurityPolicy: false, // Let frontend load CDN assets
    crossOriginResourcePolicy: { policy: "cross-origin" },
  });

  // 2. CORS allowlist
  const rawOrigins = process.env.CORS_ORIGINS || "http://localhost:5173,http://localhost:3000";
  const allowedOrigins = rawOrigins.split(",").map((o) => o.trim());

  await server.register(cors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (like mobile apps, curl, or server-to-server)
      if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== "production") {
        cb(null, true);
        return;
      }
      cb(new Error("CORS policy violation"), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });

  // 3. Global Rate Limiter
  await server.register(rateLimit, {
    max: 120,
    timeWindow: "1 minute",
  });

  await server.register(sensible);

  // 4. Static File Serving for /uploads/
  await server.register(fastifyStatic, {
    root: UPLOADS_DIR,
    prefix: "/uploads/",
    setHeaders: (reply) => {
      reply.header("Cross-Origin-Resource-Policy", "cross-origin");
      reply.header("Access-Control-Allow-Origin", "*");
    },
  });

  // 5. Register Routes
  await server.register(healthRoutes);
  await server.register(postRoutes);
  await server.register(trendingRoutes);
  await server.register(forYouRoutes);
  await server.register(productRoutes);
  await server.register(userRoutes);
  await server.register(tryOnRoutes);
  await server.register(photoRoutes);
  await server.register(savedRoutes);
  await server.register(interactionRoutes);

  // Root route
  server.get("/", async () => {
    return {
      name: "FitsYou API Service",
      version: "1.0.0",
      description: "Fashion Social Feed + AI Virtual Try-On Platform",
      documentation: "/api/health",
    };
  });

  return server;
}

async function main() {
  const server = buildServer();
  await setupApp(server);

  // Graceful shutdown
  const closeSignals = ["SIGINT", "SIGTERM"];
  for (const signal of closeSignals) {
    process.on(signal, async () => {
      server.log.info(`Received ${signal}, shutting down gracefully...`);
      await server.close();
      await prisma.$disconnect();
      process.exit(0);
    });
  }

  const port = Number(process.env.PORT) || 3000;
  const host = "0.0.0.0";

  try {
    await server.listen({ port, host });
    console.log(`🚀 FitsYou API Server running at http://localhost:${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

// Start only if directly invoked (not in tests)
if (process.env.NODE_ENV !== "test") {
  main();
}
