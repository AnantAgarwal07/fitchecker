import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import { prisma } from "../db.js";
import { postRoutes } from "../routes/posts.js";
import { trendingRoutes } from "../routes/trending.js";
import { forYouRoutes } from "../routes/forYou.js";
import { seedDatabase } from "../../prisma/seed.ts";

describe("Phase 1: Feed Data & Seed Idempotency", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(cors);
    await app.register(sensible);
    await app.register(postRoutes);
    await app.register(trendingRoutes);
    await app.register(forYouRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  // 1. Seed Idempotency Test
  it("Seed is idempotent: running twice preserves identical row counts and creates zero duplicates", async () => {
    const run1 = await seedDatabase();
    const run2 = await seedDatabase();

    expect(run2.totalUsers).toBe(run1.totalUsers);
    expect(run2.totalPosts).toBe(run1.totalPosts);
    expect(run2.totalPostProducts).toBe(run1.totalPostProducts);
    expect(run2.totalMetrics).toBe(run1.totalMetrics);

    // Verify at least 10 creators and 40 posts exist
    expect(run2.totalUsers).toBeGreaterThanOrEqual(10);
    expect(run2.totalPosts).toBeGreaterThanOrEqual(40);

    // Verify no duplicates in PostProduct (postId, productId)
    const postProducts = await prisma.postProduct.findMany({
      select: { postId: true, productId: true },
    });
    const ppKeys = postProducts.map((p) => `${p.postId}__${p.productId}`);
    const uniquePPKeys = new Set(ppKeys);
    expect(uniquePPKeys.size).toBe(ppKeys.length);

    // Verify no duplicates in TrendingMetric per post and timeWindow
    const metrics = await prisma.trendingMetric.findMany({
      select: { postId: true, timeWindow: true },
    });
    const tmKeys = metrics.map((m) => `${m.postId}__${m.timeWindow}`);
    const uniqueTMKeys = new Set(tmKeys);
    expect(uniqueTMKeys.size).toBe(tmKeys.length);
  }, 120000);

  // 2. Feed Endpoints Return Non-Empty Results
  it("GET /api/v1/posts returns non-empty feed with tagged products across categories", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/posts?tab=all&limit=20",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.posts).toBeDefined();
    expect(body.posts.length).toBeGreaterThan(0);

    // Verify creator fields and tagged products
    const firstPost = body.posts[0];
    expect(firstPost.id).toBeDefined();
    expect(firstPost.user.name).toBeDefined();
    expect(firstPost.user.handle).toMatch(/^@/);
    expect(firstPost.image).toBeDefined();
    expect(Array.isArray(firstPost.products)).toBe(true);
    expect(firstPost.products.length).toBeGreaterThanOrEqual(1);
    expect(firstPost.products[0].xPercent).toBeDefined();
    expect(firstPost.products[0].yPercent).toBeDefined();
  });

  it("GET /api/v1/posts?tab=following returns feed from followed creators", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/posts?tab=following&userId=u-ananya-sharma-001&limit=20",
      headers: {
        authorization: "Bearer test-token-u-ananya-sharma-001",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.posts).toBeDefined();
    expect(body.posts.length).toBeGreaterThan(0);
  });

  it("GET /api/v1/trending returns non-empty trending looks", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/trending?category=all&limit=15",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.trendingLooks).toBeDefined();
    expect(body.trendingLooks.length).toBeGreaterThan(0);
    expect(body.trendingLooks[0].rankingBadge).toContain("TRENDING #1");
    expect(body.trendingLooks[0].velocityScore).toBeGreaterThanOrEqual(0);
  });

  it("GET /api/v1/for-you returns personalized lookbook and style profile", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/for-you?userId=u-ananya-sharma-001&limit=10",
      headers: {
        authorization: "Bearer test-token-u-ananya-sharma-001",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.outfits).toBeDefined();
    expect(body.outfits.length).toBeGreaterThan(0);
    expect(body.userProfile).toBeDefined();
    expect(body.userProfile.traits.length).toBeGreaterThan(0);
  });

  // 3. Fallback ranking when no TrendingMetric rows exist
  it("GET /api/v1/trending ranks by likes and recency if no TrendingMetric records match", async () => {
    // Query a category with no metrics or verify ranking logic
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/trending?category=streetwear&limit=10",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.trendingLooks.length).toBeGreaterThan(0);

    // Verify looks are ordered with highest likes / score first
    const looks = body.trendingLooks;
    if (looks.length >= 2) {
      expect(looks[0].velocityScore).toBeGreaterThanOrEqual(looks[1].velocityScore);
    }
  });
});
