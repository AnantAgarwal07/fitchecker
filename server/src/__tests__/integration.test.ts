import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import { healthRoutes } from "../routes/health.js";
import { postRoutes } from "../routes/posts.js";
import { trendingRoutes } from "../routes/trending.js";
import { forYouRoutes } from "../routes/forYou.js";
import { productRoutes } from "../routes/products.js";
import { userRoutes } from "../routes/users.js";
import { tryOnRoutes } from "../routes/tryOn.js";
import { prisma } from "../db.js";

describe("FitsYou API End-to-End Integration Suite", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(cors);
    await app.register(sensible);
    await app.register(healthRoutes);
    await app.register(postRoutes);
    await app.register(trendingRoutes);
    await app.register(forYouRoutes);
    await app.register(productRoutes);
    await app.register(userRoutes);
    await app.register(tryOnRoutes);
    await app.ready();

    // Reset test sessions for test users to guarantee isolated quota in test environment
    await prisma.tryOnSession.deleteMany({
      where: { userId: { in: ["u-rohan-mehta-002", "u-ananya-sharma-001"] } },
    });
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  // 1. Health & DB Connectivity
  it("GET /api/health returns 200 with DB status connected", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/health",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.status).toBe("ok");
    expect(body.database.status).toBe("connected");
    expect(body.database.latencyMs).toBeDefined();
  });

  // 2. Feed Pagination & Tab Filtering
  it("GET /api/v1/posts handles tabs, limits, and pagination", async () => {
    // All tab
    const resAll = await app.inject({
      method: "GET",
      url: "/api/v1/posts?limit=3&page=1",
    });
    expect(resAll.statusCode).toBe(200);
    const bodyAll = JSON.parse(resAll.payload);
    expect(bodyAll.posts.length).toBeLessThanOrEqual(3);
    expect(bodyAll.pagination.page).toBe(1);
    expect(bodyAll.pagination.total).toBeGreaterThan(0);

    // Verify PostCard contract shape
    const samplePost = bodyAll.posts[0];
    expect(samplePost).toHaveProperty("id");
    expect(samplePost).toHaveProperty("user");
    expect(samplePost.user).toHaveProperty("handle");
    expect(samplePost).toHaveProperty("image");
    expect(samplePost).toHaveProperty("likes");
    expect(samplePost).toHaveProperty("products");
    expect(Array.isArray(samplePost.products)).toBe(true);

    // Category tab
    const resEthnic = await app.inject({
      method: "GET",
      url: "/api/v1/posts?category=ethnic wear",
    });
    expect(resEthnic.statusCode).toBe(200);
    const bodyEthnic = JSON.parse(resEthnic.payload);
    bodyEthnic.posts.forEach((p: any) => {
      expect(p.category.toLowerCase()).toBe("ethnic wear");
    });
  });

  // 3. Like Toggle (Atomic & Idempotency)
  it("POST /api/v1/posts/:id/like toggles likes atomically", async () => {
    const testPostId = "post-demo-002";
    const testUserId = "u-ananya-sharma-001";

    // Like
    const res1 = await app.inject({
      method: "POST",
      url: `/api/v1/posts/${testPostId}/like`,
      headers: {
        authorization: `Bearer test-token-${testUserId}`,
      },
      payload: { userId: testUserId },
    });
    expect(res1.statusCode).toBe(200);
    const body1 = JSON.parse(res1.payload);
    expect(body1.postId).toBe(testPostId);
    const initialLiked = body1.isLiked;

    // Toggle back
    const res2 = await app.inject({
      method: "POST",
      url: `/api/v1/posts/${testPostId}/like`,
      headers: {
        authorization: `Bearer test-token-${testUserId}`,
      },
      payload: { userId: testUserId },
    });
    expect(res2.statusCode).toBe(200);
    const body2 = JSON.parse(res2.payload);
    expect(body2.isLiked).toBe(!initialLiked);
  });

  // 4. Trending Velocity & Ranking Badges
  it("GET /api/v1/trending returns looks ranked with velocity badges", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/trending?limit=5",
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.trendingLooks.length).toBeGreaterThan(0);

    // Verify rank badges
    expect(body.trendingLooks[0].rankingBadge).toBe("TRENDING #1 WORLDWIDE");
    expect(body.trendingLooks[0]).toHaveProperty("velocityScore");
    expect(body.trendingLooks[0]).toHaveProperty("creator");
    expect(body.trendingLooks[0]).toHaveProperty("defaultGarment");
  });

  // 5. For-You AI Recommendations with Fit Scores
  it("GET /api/v1/for-you computes personalized match scores", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/for-you?limit=3",
      headers: {
        authorization: "Bearer test-token-u-ananya-sharma-001",
      },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.outfits.length).toBeGreaterThan(0);

    const outfit = body.outfits[0];
    expect(outfit.matchScore).toBeGreaterThanOrEqual(70);
    expect(outfit.matchScore).toBeLessThanOrEqual(99);
    expect(outfit.fitScore).toContain("%");
    expect(outfit.fitNote.length).toBeGreaterThan(10);
    expect(outfit.breakdown).toBeDefined();
  });

  // 6. Products Catalog Search & Details
  it("GET /api/v1/products searches catalog and returns physical measurements", async () => {
    const resSearch = await app.inject({
      method: "GET",
      url: "/api/v1/products?q=shirt&limit=3",
    });
    expect(resSearch.statusCode).toBe(200);
    const bodySearch = JSON.parse(resSearch.payload);
    expect(bodySearch.products.length).toBeGreaterThan(0);

    const firstProd = bodySearch.products[0];
    expect(firstProd.sizes.length).toBeGreaterThan(0);

    // Detail endpoint
    const resDetail = await app.inject({
      method: "GET",
      url: `/api/v1/products/${firstProd.id}`,
    });
    expect(resDetail.statusCode).toBe(200);
    const bodyDetail = JSON.parse(resDetail.payload);
    expect(bodyDetail.id).toBe(firstProd.id);
    expect(bodyDetail.rawSizes).toBeDefined();
  });

  // 7. Virtual Try-On Pipeline Lifecycle (Submit -> Poll -> Complete)
  it("POST /api/v1/try-on queues job and completes asynchronously", async () => {
    const resSubmit = await app.inject({
      method: "POST",
      url: "/api/v1/try-on",
      headers: {
        authorization: "Bearer test-token-u-rohan-mehta-002",
      },
      payload: {
        productId: 662,
        userPhotoUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=600&auto=format&fit=crop&q=80",
        userHeightCm: 180,
        sizeSelected: "40",
      },
    });

    expect(resSubmit.statusCode).toBe(202);
    const bodySubmit = JSON.parse(resSubmit.payload);
    expect(bodySubmit.jobId).toBeDefined();
    expect(bodySubmit.status).toBe("QUEUED");

    // Poll until status is COMPLETED (up to 10s for Neon cloud latency)
    let finalStatus = "QUEUED";
    let bodyPoll: any;
    for (let i = 0; i < 25; i++) {
      await new Promise((r) => setTimeout(r, 400));
      const resPoll = await app.inject({
        method: "GET",
        url: `/api/v1/try-on/jobs/${bodySubmit.jobId}`,
      });
      bodyPoll = JSON.parse(resPoll.payload);
      if (bodyPoll.status === "COMPLETED" || bodyPoll.status === "FAILED") {
        finalStatus = bodyPoll.status;
        break;
      }
    }

    expect(finalStatus).toBe("COMPLETED");
    expect(bodyPoll.fitScore).toBeDefined();
    expect(bodyPoll.renderedImageUrl).toBeDefined();
  });

  // 8. Error Handling & Validation
  it("Validates input schemas and sanitizes error responses", async () => {
    // 400 Bad Request on invalid parameter
    const resBadParam = await app.inject({
      method: "GET",
      url: "/api/v1/products/not-a-number",
    });
    expect(resBadParam.statusCode).toBe(400);

    // 404 on missing entity
    const resMissing = await app.inject({
      method: "GET",
      url: "/api/v1/posts/non-existent-uuid-99999",
    });
    expect(resMissing.statusCode).toBe(404);

    // 400 on try-on missing required fields
    const resInvalidTryOn = await app.inject({
      method: "POST",
      url: "/api/v1/try-on",
      headers: {
        authorization: "Bearer test-token-u-rohan-mehta-002",
      },
      payload: {
        productId: "invalid",
      },
    });
    expect(resInvalidTryOn.statusCode).toBe(400);
  });
});
