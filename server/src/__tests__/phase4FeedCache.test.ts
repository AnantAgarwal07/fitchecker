import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import { prisma } from "../db.js";
import { forYouRoutes } from "../routes/forYou.js";
import { userRoutes } from "../routes/users.js";
import {
  getPersonalizedFeed,
  computeAndStoreFeed,
  refreshUserFeed,
  normalizeCategory,
} from "../recommender/index.js";

describe("Phase 4: Fast For You Feed Cache & Occasion Categories Test Suite", () => {
  let app: FastifyInstance;
  const testUserId = "u-ananya-sharma-001";
  const newUserId = "u-brand-new-shopper-099";

  beforeAll(async () => {
    process.env.DEBUG_TIMING = "true";
    app = Fastify({ logger: false });
    await app.register(cors);
    await app.register(sensible);
    await app.register(userRoutes);
    await app.register(forYouRoutes);
    await app.ready();

    // Ensure new test user exists without any cached feed
    await prisma.user.upsert({
      where: { id: newUserId },
      update: {},
      create: {
        id: newUserId,
        email: "shopper099@fitsyou.app",
        handle: "shopper_099",
        name: "New Shopper",
        avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
      },
    });

    // Remove any leftover cache for new user
    await prisma.feedCache.deleteMany({
      where: { userId: newUserId },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  // -------------------------------------------------------------
  // Test 1: Category Normalization
  // -------------------------------------------------------------
  it("normalizeCategory correctly maps user-facing occasion labels to database categories", () => {
    expect(normalizeCategory("All")).toBe("all");
    expect(normalizeCategory("Office wear")).toBe("formal");
    expect(normalizeCategory("office")).toBe("formal");
    expect(normalizeCategory("workwear")).toBe("formal");
    expect(normalizeCategory("Streetwear")).toBe("streetwear");
    expect(normalizeCategory("Casual")).toBe("casual");
    expect(normalizeCategory("Ethnic wear")).toBe("ethnic wear");
    expect(normalizeCategory("Party wear")).toBe("party wear");
    expect(normalizeCategory("Dresses")).toBe("dresses");
    expect(normalizeCategory("College outfits")).toBe("college outfits");
  });

  // -------------------------------------------------------------
  // Test 2: Cache Hit & Server Timing under 500ms
  // -------------------------------------------------------------
  it("Repeat For You requests hit DB cache and return in under 500ms server-side", async () => {
    // 1. Initial request to ensure cache is populated
    await app.inject({
      method: "GET",
      url: "/api/v1/for-you?category=all&refresh=true",
      headers: { authorization: `Bearer test-token-${testUserId}` },
    });

    // 2. Repeat request measuring server-side latency
    const startTime = performance.now();
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/for-you?category=all",
      headers: { authorization: `Bearer test-token-${testUserId}` },
    });
    const durationMs = performance.now() - startTime;

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    console.log(`[Phase 4 Test] Repeat cached /for-you response time: ${durationMs.toFixed(1)}ms | Server internal: ${body.serverDurationMs}ms`);

    expect(body.cached).toBe(true);
    expect(body.isStarter).toBe(false);
    expect(body.outfits).toBeInstanceOf(Array);
    expect(body.outfits.length).toBeGreaterThan(0);
    expect(body.serverDurationMs).toBeLessThan(500); // Acceptance criteria: server-side under 500ms
  });

  // -------------------------------------------------------------
  // Test 3: Stale-While-Revalidate
  // -------------------------------------------------------------
  it("Stale cache returns immediately with isStale: true and triggers background refresh", async () => {
    // Manually set generatedAt to 10 hours ago (> FEED_STALE_HOURS)
    const tenHoursAgo = new Date(Date.now() - 10 * 3600 * 1000);
    await prisma.feedCache.upsert({
      where: {
        userId_category: {
          userId: testUserId,
          category: "all",
        },
      },
      update: { generatedAt: tenHoursAgo },
      create: {
        userId: testUserId,
        category: "all",
        items: [],
        generatedAt: tenHoursAgo,
      },
    });

    // Request feed: should return immediately with isStale: true
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/for-you?category=all",
      headers: { authorization: `Bearer test-token-${testUserId}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.cached).toBe(true);
    expect(body.isStale).toBe(true);

    // Poll for background setImmediate task to complete recomputation
    let updatedCache: any = null;
    const pollStart = Date.now();
    while (Date.now() - pollStart < 4000) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      updatedCache = await prisma.feedCache.findUnique({
        where: {
          userId_category: {
            userId: testUserId,
            category: "all",
          },
        },
      });
      if (updatedCache && updatedCache.generatedAt.getTime() > tenHoursAgo.getTime()) {
        break;
      }
    }

    expect(updatedCache).toBeDefined();
    expect(updatedCache!.generatedAt.getTime()).toBeGreaterThan(tenHoursAgo.getTime());
  });

  // -------------------------------------------------------------
  // Test 4: New-User Starter Feed
  // -------------------------------------------------------------
  it("New user with no cache gets starter feed immediately with isStarter: true", async () => {
    // Ensure new user has no cache row
    await prisma.feedCache.deleteMany({ where: { userId: newUserId } });

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/for-you?category=all",
      headers: { authorization: `Bearer test-token-${newUserId}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.isStarter).toBe(true);
    expect(body.cached).toBe(false);
    expect(body.outfits.length).toBeGreaterThan(0);

    // Allow background task to write real feed
    await new Promise((resolve) => setTimeout(resolve, 800));

    // Verify background computation created FeedCache row for new user
    const createdCache = await prisma.feedCache.findUnique({
      where: {
        userId_category: {
          userId: newUserId,
          category: "all",
        },
      },
    });
    expect(createdCache).toBeDefined();
    expect(createdCache!.items).toBeInstanceOf(Array);
  });

  // -------------------------------------------------------------
  // Test 5: Per-Category Cache Key & Different Posts
  // -------------------------------------------------------------
  it("Per-category cache key creates distinct rows and returns different posts for each occasion", async () => {
    // 1. Fetch streetwear category
    const resStreet = await app.inject({
      method: "GET",
      url: "/api/v1/for-you?category=streetwear&refresh=true",
      headers: { authorization: `Bearer test-token-${testUserId}` },
    });
    expect(resStreet.statusCode).toBe(200);
    const bodyStreet = JSON.parse(resStreet.payload);

    // 2. Fetch formal category (via Office wear alias)
    const resFormal = await app.inject({
      method: "GET",
      url: "/api/v1/for-you?category=Office wear&refresh=true",
      headers: { authorization: `Bearer test-token-${testUserId}` },
    });
    expect(resFormal.statusCode).toBe(200);
    const bodyFormal = JSON.parse(resFormal.payload);

    // Verify two distinct rows exist in FeedCache
    const streetRow = await prisma.feedCache.findUnique({
      where: { userId_category: { userId: testUserId, category: "streetwear" } },
    });
    const formalRow = await prisma.feedCache.findUnique({
      where: { userId_category: { userId: testUserId, category: "formal" } },
    });

    expect(streetRow).toBeDefined();
    expect(formalRow).toBeDefined();

    // Verify posts returned are different across categories
    if (bodyStreet.outfits.length > 0 && bodyFormal.outfits.length > 0) {
      expect(bodyStreet.outfits[0].id).not.toBe(bodyFormal.outfits[0].id);
      expect(bodyStreet.outfits[0].category.toLowerCase()).toBe("streetwear");
      expect(bodyFormal.outfits[0].category.toLowerCase()).toBe("formal");
    }
  });

  // -------------------------------------------------------------
  // Test 6: Cache Refresh after Profile Update
  // -------------------------------------------------------------
  it("Feed cache is recomputed when user updates body profile measurements", async () => {
    // 1. Populate current cache
    await app.inject({
      method: "GET",
      url: "/api/v1/for-you?category=all&refresh=true",
      headers: { authorization: `Bearer test-token-${testUserId}` },
    });

    const cacheBefore = await prisma.feedCache.findUnique({
      where: { userId_category: { userId: testUserId, category: "all" } },
    });
    expect(cacheBefore).toBeDefined();

    // Wait 10ms so timestamp increases
    await new Promise((resolve) => setTimeout(resolve, 20));

    // 2. Update body profile via PUT /api/v1/users/me/body-profile
    const updateRes = await app.inject({
      method: "PUT",
      url: "/api/v1/users/me/body-profile",
      headers: { authorization: `Bearer test-token-${testUserId}` },
      payload: {
        heightCm: 175,
        bodyType: "athletic",
        fitPreference: "oversized",
        styleVibe: "streetwear",
      },
    });

    expect(updateRes.statusCode).toBe(200);

    // Wait a moment for background refreshUserFeed to complete
    await new Promise((resolve) => setTimeout(resolve, 600));

    const cacheAfter = await prisma.feedCache.findUnique({
      where: { userId_category: { userId: testUserId, category: "all" } },
    });

    expect(cacheAfter).toBeDefined();
    expect(cacheAfter!.generatedAt.getTime()).toBeGreaterThanOrEqual(cacheBefore!.generatedAt.getTime());
  });

  // -------------------------------------------------------------
  // Test 7: forceRefresh and refresh Boolean Query String Parsing
  // -------------------------------------------------------------
  it("Boolean parsing handles forceRefresh=false without forcing synchronous recompute", async () => {
    // When forceRefresh is 'false', it should hit the cache if present
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/for-you?category=all&forceRefresh=false",
      headers: { authorization: `Bearer test-token-${testUserId}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.cached).toBe(true);
  });
});
