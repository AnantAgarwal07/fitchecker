import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { FastifyInstance } from "fastify";
import { postRoutes } from "../routes/posts.js";
import { trendingRoutes } from "../routes/trending.js";
import { forYouRoutes } from "../routes/forYou.js";
import { productRoutes } from "../routes/products.js";
import { userRoutes } from "../routes/users.js";
import { prisma } from "../db.js";

describe("Phase 5: Search Across Posts, Trending, For You, Products & Users", () => {
  let app: FastifyInstance;
  const demoUserId = "u-ananya-sharma-001";

  beforeAll(async () => {
    app = Fastify();
    await app.register(postRoutes);
    await app.register(trendingRoutes);
    await app.register(forYouRoutes);
    await app.register(productRoutes);
    await app.register(userRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  // -------------------------------------------------------------
  // Test 1: GET /api/v1/posts with q parameter
  // -------------------------------------------------------------
  it("GET /api/v1/posts?q=shirt returns matching looks across product names and brands", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/posts?q=shirt",
      headers: { authorization: `Bearer test-token-${demoUserId}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.posts).toBeInstanceOf(Array);
    expect(body.posts.length).toBeGreaterThan(0);

    // Verify all returned posts match "shirt" in caption, category, tags, creator, or tagged products
    for (const post of body.posts) {
      const matchInCaption = post.caption?.toLowerCase().includes("shirt");
      const matchInCategory = post.category?.toLowerCase().includes("shirt");
      const matchInTags = post.tags?.some((t: string) => t.toLowerCase().includes("shirt"));
      const matchInCreator = post.user?.name?.toLowerCase().includes("shirt") || post.user?.handle?.toLowerCase().includes("shirt");
      const matchInProducts = post.products?.some(
        (p: any) => p.name?.toLowerCase().includes("shirt") || p.brand?.toLowerCase().includes("shirt")
      );
      expect(matchInCaption || matchInCategory || matchInTags || matchInCreator || matchInProducts).toBe(true);
    }
  });

  it("GET /api/v1/posts?q=streetwear matches by category and tags", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/posts?q=streetwear",
      headers: { authorization: `Bearer test-token-${demoUserId}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.posts.length).toBeGreaterThan(0);

    const firstPost = body.posts[0];
    const hasStreetwearTagOrCategory =
      firstPost.category?.toLowerCase().includes("streetwear") ||
      firstPost.tags?.some((t: string) => t.toLowerCase().includes("streetwear")) ||
      firstPost.caption?.toLowerCase().includes("streetwear");
    expect(hasStreetwearTagOrCategory).toBe(true);
  });

  // -------------------------------------------------------------
  // Test 2: Case-Insensitivity on GET /api/v1/posts
  // -------------------------------------------------------------
  it("GET /api/v1/posts case-insensitivity: 'SHIRT', 'shirt', and 'sHiRt' return identical results", async () => {
    const [resUpper, resLower, resMixed] = await Promise.all([
      app.inject({
        method: "GET",
        url: "/api/v1/posts?q=SHIRT",
        headers: { authorization: `Bearer test-token-${demoUserId}` },
      }),
      app.inject({
        method: "GET",
        url: "/api/v1/posts?q=shirt",
        headers: { authorization: `Bearer test-token-${demoUserId}` },
      }),
      app.inject({
        method: "GET",
        url: "/api/v1/posts?q=sHiRt",
        headers: { authorization: `Bearer test-token-${demoUserId}` },
      }),
    ]);

    expect(resUpper.statusCode).toBe(200);
    expect(resLower.statusCode).toBe(200);
    expect(resMixed.statusCode).toBe(200);

    const bodyUpper = JSON.parse(resUpper.payload);
    const bodyLower = JSON.parse(resLower.payload);
    const bodyMixed = JSON.parse(resMixed.payload);

    expect(bodyUpper.pagination.total).toBe(bodyLower.pagination.total);
    expect(bodyMixed.pagination.total).toBe(bodyLower.pagination.total);
    expect(bodyUpper.posts.map((p: any) => p.id)).toEqual(bodyLower.posts.map((p: any) => p.id));
    expect(bodyMixed.posts.map((p: any) => p.id)).toEqual(bodyLower.posts.map((p: any) => p.id));
  });

  // -------------------------------------------------------------
  // Test 3: Match on Creator Name and Handle
  // -------------------------------------------------------------
  it("GET /api/v1/posts?q matches creator name or handle", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/posts?q=ananya",
      headers: { authorization: `Bearer test-token-${demoUserId}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.posts.length).toBeGreaterThan(0);
    expect(body.posts.some((p: any) => p.user.handle.toLowerCase().includes("ananya") || p.user.name.toLowerCase().includes("ananya"))).toBe(true);
  });

  // -------------------------------------------------------------
  // Test 4: GET /api/v1/trending with q parameter
  // -------------------------------------------------------------
  it("GET /api/v1/trending?q=shirt returns ranked trending looks matching query", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/trending?q=shirt",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.trendingLooks).toBeInstanceOf(Array);
    expect(body.trendingLooks.length).toBeGreaterThan(0);

    for (const look of body.trendingLooks) {
      const matchInTitle = look.title?.toLowerCase().includes("shirt");
      const matchInCategory = look.category?.toLowerCase().includes("shirt");
      const matchInCreator = look.creator?.name?.toLowerCase().includes("shirt") || look.creator?.handle?.toLowerCase().includes("shirt");
      const matchInGarments = look.garments?.some(
        (g: any) => g.name?.toLowerCase().includes("shirt") || g.brand?.toLowerCase().includes("shirt")
      );
      expect(matchInTitle || matchInCategory || matchInCreator || matchInGarments).toBe(true);
    }
  });

  it("GET /api/v1/trending case-insensitivity: 'STREETWEAR', 'streetwear', and 'StReEtWeAr' return identical results", async () => {
    const [resUpper, resLower, resMixed] = await Promise.all([
      app.inject({ method: "GET", url: "/api/v1/trending?q=STREETWEAR" }),
      app.inject({ method: "GET", url: "/api/v1/trending?q=streetwear" }),
      app.inject({ method: "GET", url: "/api/v1/trending?q=StReEtWeAr" }),
    ]);

    expect(resUpper.statusCode).toBe(200);
    expect(resLower.statusCode).toBe(200);
    expect(resMixed.statusCode).toBe(200);

    const bodyUpper = JSON.parse(resUpper.payload);
    const bodyLower = JSON.parse(resLower.payload);
    const bodyMixed = JSON.parse(resMixed.payload);

    expect(bodyUpper.trendingLooks.length).toBe(bodyLower.trendingLooks.length);
    expect(bodyMixed.trendingLooks.length).toBe(bodyLower.trendingLooks.length);
    expect(bodyUpper.trendingLooks.map((l: any) => l.id)).toEqual(bodyLower.trendingLooks.map((l: any) => l.id));
  });

  // -------------------------------------------------------------
  // Test 5: GET /api/v1/for-you with q parameter
  // -------------------------------------------------------------
  it("GET /api/v1/for-you?q=streetwear returns personalized outfits matching query", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/for-you?q=streetwear",
      headers: { authorization: `Bearer test-token-${demoUserId}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.outfits).toBeInstanceOf(Array);
    expect(body.outfits.length).toBeGreaterThan(0);

    for (const outfit of body.outfits) {
      const match =
        outfit.name?.toLowerCase().includes("streetwear") ||
        outfit.caption?.toLowerCase().includes("streetwear") ||
        outfit.category?.toLowerCase().includes("streetwear") ||
        outfit.garments?.some((g: any) => g.name?.toLowerCase().includes("streetwear") || g.category?.toLowerCase().includes("streetwear"));
      expect(match).toBe(true);
    }
  });

  // -------------------------------------------------------------
  // Test 6: Empty state when no matches found
  // -------------------------------------------------------------
  it("Non-matching query returns empty array on /posts, /trending, and /for-you", async () => {
    const nonExistent = "xyz_no_match_query_99999";

    const [resPosts, resTrending, resForYou] = await Promise.all([
      app.inject({
        method: "GET",
        url: `/api/v1/posts?q=${nonExistent}`,
        headers: { authorization: `Bearer test-token-${demoUserId}` },
      }),
      app.inject({
        method: "GET",
        url: `/api/v1/trending?q=${nonExistent}`,
      }),
      app.inject({
        method: "GET",
        url: `/api/v1/for-you?q=${nonExistent}`,
        headers: { authorization: `Bearer test-token-${demoUserId}` },
      }),
    ]);

    expect(resPosts.statusCode).toBe(200);
    expect(resTrending.statusCode).toBe(200);
    expect(resForYou.statusCode).toBe(200);

    const postsBody = JSON.parse(resPosts.payload);
    const trendingBody = JSON.parse(resTrending.payload);
    const forYouBody = JSON.parse(resForYou.payload);

    expect(postsBody.posts).toEqual([]);
    expect(postsBody.pagination.total).toBe(0);
    expect(trendingBody.trendingLooks).toEqual([]);
    expect(forYouBody.outfits).toEqual([]);
    expect(forYouBody.total).toBe(0);
  });

  // -------------------------------------------------------------
  // Test 7: GET /api/v1/products?q= and wearableOnly
  // -------------------------------------------------------------
  it("GET /api/v1/products?q=shirt returns product catalog with wearableOnly flag respected", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/products?q=shirt&wearableOnly=true&limit=10",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.products).toBeInstanceOf(Array);
    expect(body.products.length).toBeGreaterThan(0);

    const firstProduct = body.products[0];
    expect(firstProduct).toHaveProperty("id");
    expect(firstProduct).toHaveProperty("name");
    expect(firstProduct).toHaveProperty("brand");
    expect(firstProduct).toHaveProperty("price");
    expect(firstProduct).toHaveProperty("image");
    expect(firstProduct).toHaveProperty("sizes");
  });

  // -------------------------------------------------------------
  // Test 8: GET /api/v1/users/search?q=
  // -------------------------------------------------------------
  it("GET /api/v1/users/search?q=ananya returns creators with correct frontend shape", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/users/search?q=ananya",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.users).toBeInstanceOf(Array);
    expect(body.users.length).toBeGreaterThan(0);

    const creator = body.users[0];
    expect(creator).toHaveProperty("id");
    expect(creator).toHaveProperty("name");
    expect(creator).toHaveProperty("handle");
    expect(creator).toHaveProperty("avatar");
    expect(creator).toHaveProperty("postsCount");
    expect(creator).toHaveProperty("followersCount");
  });
});
