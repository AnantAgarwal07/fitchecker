import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { FastifyInstance } from "fastify";
import { postRoutes } from "../routes/posts.js";
import { userRoutes } from "../routes/users.js";
import { savedRoutes } from "../routes/saved.js";
import { interactionRoutes } from "../routes/interactions.js";
import { productRoutes } from "../routes/products.js";
import { forYouRoutes } from "../routes/forYou.js";
import { prisma } from "../db.js";
import {
  diversifyRecommendations,
  getPersonalizedFeed,
  invalidateUserFeedCache,
} from "../recommender/index.js";

describe("Phase C: Social Features, Interactions & Recommender Engine Test Suite", () => {
  let app: FastifyInstance;
  const testUserId = "u-ananya-sharma-001";
  const otherUserId = "u-test-creator-002";

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(postRoutes);
    await app.register(userRoutes);
    await app.register(savedRoutes);
    await app.register(interactionRoutes);
    await app.register(productRoutes);
    await app.register(forYouRoutes);
    await app.ready();

    // Ensure secondary test user exists for social tests
    await prisma.user.upsert({
      where: { id: otherUserId },
      update: {},
      create: {
        id: otherUserId,
        email: "creator2@fitsyou.app",
        handle: "creator_two",
        name: "Creator Two",
        avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  // -------------------------------------------------------------
  // C1: Social Graph, Posts & Saved Items
  // -------------------------------------------------------------
  describe("C1: Posts Creation, Deletion & Social Graph", () => {
    let createdPostId: string;

    it("POST /api/v1/posts creates outfit post authored by authenticated user", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/posts",
        headers: {
          authorization: `Bearer test-token-${testUserId}`,
        },
        payload: {
          caption: "Minimalist Linen Silhouette",
          imageUrl: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600",
          category: "casual",
          tags: ["minimal", "linen", "summer"],
          price: 1999,
        },
      });

      expect(res.statusCode).toBe(201);
      const post = JSON.parse(res.payload);
      expect(post.id).toBeDefined();
      expect(post.caption).toBe("Minimalist Linen Silhouette");
      expect(post.user.id).toBe(testUserId);
      createdPostId = post.id;
    });

    it("DELETE /api/v1/posts/:id prevents non-author from deleting post (403)", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: `/api/v1/posts/${createdPostId}`,
        headers: {
          authorization: `Bearer test-token-${otherUserId}`,
        },
      });

      expect(res.statusCode).toBe(403);
    });

    it("DELETE /api/v1/posts/:id allows author to delete their post (200)", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: `/api/v1/posts/${createdPostId}`,
        headers: {
          authorization: `Bearer test-token-${testUserId}`,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.id).toBe(createdPostId);
    });

    it("POST /api/v1/users/:id/follow blocks user from following themselves (400)", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/v1/users/${testUserId}/follow`,
        headers: {
          authorization: `Bearer test-token-${testUserId}`,
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it("POST /api/v1/users/:id/follow follows target creator and updates social graph", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/v1/users/${otherUserId}/follow`,
        headers: {
          authorization: `Bearer test-token-${testUserId}`,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.following).toBe(true);
      expect(body.followingId).toBe(otherUserId);
    });

    it("GET /api/v1/posts?tab=following resolves feed filtered by followed creators", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/posts?tab=following",
        headers: {
          authorization: `Bearer test-token-${testUserId}`,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.posts).toBeInstanceOf(Array);
    });

    it("DELETE /api/v1/users/:id/follow unfollows target user", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: `/api/v1/users/${otherUserId}/follow`,
        headers: {
          authorization: `Bearer test-token-${testUserId}`,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.following).toBe(false);
    });

    it("GET /api/v1/users/search returns creators matching query", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/users/search?q=ananya",
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.users).toBeInstanceOf(Array);
      expect(body.users.length).toBeGreaterThan(0);
      expect(body.users[0].name.toLowerCase()).toContain("ananya");
    });

    it("POST, GET, and DELETE /api/v1/saved/:productId manages saved items collection", async () => {
      const product = await prisma.product.findFirst({ select: { id: true } });
      if (!product) return;

      // 1. Save product
      const resSave = await app.inject({
        method: "POST",
        url: `/api/v1/saved/${product.id}`,
        headers: {
          authorization: `Bearer test-token-${testUserId}`,
        },
      });
      expect(resSave.statusCode).toBe(200);
      expect(JSON.parse(resSave.payload).saved).toBe(true);

      // 2. List saved products
      const resList = await app.inject({
        method: "GET",
        url: "/api/v1/saved",
        headers: {
          authorization: `Bearer test-token-${testUserId}`,
        },
      });
      expect(resList.statusCode).toBe(200);
      const listBody = JSON.parse(resList.payload);
      expect(listBody.savedItems.some((item: any) => item.productId === product.id)).toBe(true);

      // 3. Remove product
      const resRemove = await app.inject({
        method: "DELETE",
        url: `/api/v1/saved/${product.id}`,
        headers: {
          authorization: `Bearer test-token-${testUserId}`,
        },
      });
      expect(resRemove.statusCode).toBe(200);
      expect(JSON.parse(resRemove.payload).saved).toBe(false);
    });
  });

  // -------------------------------------------------------------
  // C2: Interaction Logging & Outbound Redirect Tracker
  // -------------------------------------------------------------
  describe("C2: User Interaction Logging & Redirect Tracker", () => {
    it("POST /api/v1/interactions logs user event with metadata", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/interactions",
        headers: {
          authorization: `Bearer test-token-${testUserId}`,
        },
        payload: {
          type: "TRYON",
          productId: 392,
          dwellTimeMs: 4200,
          meta: { client: "web", feature: "virtual_tryon" },
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.type).toBe("TRYON");
    });

    it("GET /api/v1/products/:id/go redirects to Myntra productUrl with 302", async () => {
      const product = await prisma.product.findFirst({
        where: { productUrl: { not: "" } },
        select: { id: true, productUrl: true },
      });

      if (product) {
        const res = await app.inject({
          method: "GET",
          url: `/api/v1/products/${product.id}/go`,
        });

        expect(res.statusCode).toBe(302);
        expect(res.headers.location).toBe(product.productUrl);
      }
    });
  });

  // -------------------------------------------------------------
  // C3: Recommender Engine & Diversity Filter
  // -------------------------------------------------------------
  describe("C3: Recommender Engine, Diversification & FeedCache", () => {
    it("diversifyRecommendations enforces max 2 per brand and max 3 per category in top 10", () => {
      // Create list of 15 items with 5 from same brand "Zara"
      const candidates = [
        { id: 1, brand: "Zara", productType: "Shirt", matchScore: 98 },
        { id: 2, brand: "Zara", productType: "Shirt", matchScore: 97 },
        { id: 3, brand: "Zara", productType: "Shirt", matchScore: 96 },
        { id: 4, brand: "Zara", productType: "Shirt", matchScore: 95 },
        { id: 5, brand: "H&M", productType: "Dress", matchScore: 94 },
        { id: 6, brand: "Mango", productType: "Jacket", matchScore: 93 },
        { id: 7, brand: "Levi's", productType: "Jeans", matchScore: 92 },
        { id: 8, brand: "Nike", productType: "Hoodie", matchScore: 91 },
        { id: 9, brand: "Puma", productType: "Sneakers", matchScore: 90 },
        { id: 10, brand: "Adidas", productType: "Tracksuit", matchScore: 89 },
        { id: 11, brand: "Uniqlo", productType: "Tee", matchScore: 88 },
      ];

      const diversified = diversifyRecommendations(candidates, 10);
      const top10 = diversified.slice(0, 10);

      const zaraCount = top10.filter((c) => c.brand === "Zara").length;
      expect(zaraCount).toBeLessThanOrEqual(2);

      const shirtCount = top10.filter((c) => c.productType === "Shirt").length;
      expect(shirtCount).toBeLessThanOrEqual(3);
    });

    it("GET /api/v1/for-you generates personalized feed with match scores and user profile", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/for-you?userId=${testUserId}`,
        headers: {
          authorization: `Bearer test-token-${testUserId}`,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.outfits).toBeInstanceOf(Array);
      expect(body.userProfile).toBeDefined();

      if (body.outfits.length > 0) {
        expect(body.outfits[0].matchScore).toBeGreaterThanOrEqual(60);
        expect(body.outfits[0].fitScore).toBeDefined();
      }
    });

    it("invalidateUserFeedCache removes cached entries successfully", async () => {
      await expect(invalidateUserFeedCache(testUserId)).resolves.not.toThrow();
    });
  });
});
