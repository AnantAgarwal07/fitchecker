import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import { prisma } from "../db.js";
import { validateAuthConfig } from "../middleware/auth.js";
import { userRoutes } from "../routes/users.js";
import { photoRoutes } from "../routes/photos.js";
import { tryOnRoutes } from "../routes/tryOn.js";
import { postRoutes } from "../routes/posts.js";
import { startTryOnSession } from "../services/tryOnPipeline.js";

describe("Phase A: Critical Security, Privacy, and Try-On Pipeline", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(cors);
    await app.register(sensible);
    await app.register(userRoutes);
    await app.register(photoRoutes);
    await app.register(tryOnRoutes);
    await app.register(postRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  // A3. Production Guard
  it("A3: validateAuthConfig throws fatal error if AUTH_DEMO_MODE=true in production", () => {
    const origEnv = process.env.NODE_ENV;
    const origDemo = process.env.AUTH_DEMO_MODE;

    try {
      process.env.NODE_ENV = "production";
      process.env.AUTH_DEMO_MODE = "true";
      expect(() => validateAuthConfig()).toThrowError(/FATAL SECURITY VIOLATION/);
    } finally {
      process.env.NODE_ENV = origEnv;
      process.env.AUTH_DEMO_MODE = origDemo;
    }
  });

  // A3. Auth & Ownership
  it("A3: returns 401 on protected endpoint without token when demo mode is disabled", async () => {
    const origDemo = process.env.AUTH_DEMO_MODE;
    try {
      process.env.AUTH_DEMO_MODE = "false";

      const res = await app.inject({
        method: "PUT",
        url: "/api/v1/users/u-ananya-sharma-001/body-profile",
        payload: { heightCm: 168 },
      });

      expect(res.statusCode).toBe(401);
      expect(res.json().error).toBe("Unauthorized");
    } finally {
      process.env.AUTH_DEMO_MODE = origDemo;
    }
  });

  it("Phase 3: GET /api/v1/users/me returns 401 without token and 200 with user and bodyProfile when authenticated", async () => {
    // 1. Unauthenticated request without token returns 401
    const unauthRes = await app.inject({
      method: "GET",
      url: "/api/v1/users/me",
    });
    expect(unauthRes.statusCode).toBe(401);
    expect(unauthRes.json().error).toBe("Unauthorized");

    // 2. Authenticated request returns 200 with user & bodyProfile
    const authRes = await app.inject({
      method: "GET",
      url: "/api/v1/users/me",
      headers: {
        authorization: "Bearer test-token-u-ananya-sharma-001",
      },
    });
    expect(authRes.statusCode).toBe(200);
    const data = authRes.json();
    expect(data.id).toBe("u-ananya-sharma-001");
    expect(data).toHaveProperty("bodyProfile");
    expect(data.bodyProfile).not.toBeNull();
  });

  it("Phase 3: PUT /api/v1/users/me/body-profile creates profile if none exists (upsert) and enforces ownership", async () => {
    // Create temporary user with NO body profile
    const newUser = await prisma.user.create({
      data: {
        id: "u-test-onboarding-user",
        email: "onboard@fitsyou.app",
        handle: "onboard_stylist",
        name: "Onboarding Stylist",
      },
    });

    try {
      // Verify bodyProfile is null initially
      const meRes = await app.inject({
        method: "GET",
        url: "/api/v1/users/me",
        headers: {
          authorization: `Bearer test-token-${newUser.id}`,
        },
      });
      expect(meRes.statusCode).toBe(200);
      expect(meRes.json().bodyProfile).toBeNull();

      // Upsert body profile via PUT /api/v1/users/me/body-profile
      const putRes = await app.inject({
        method: "PUT",
        url: "/api/v1/users/me/body-profile",
        headers: {
          authorization: `Bearer test-token-${newUser.id}`,
        },
        payload: {
          heightCm: 172,
          gender: "women",
          bodyType: "rectangle",
          chestCm: 86,
          waistCm: 68,
          hipsCm: 92,
        },
      });

      expect(putRes.statusCode).toBe(200);
      const putData = putRes.json();
      expect(putData.bodyProfile.heightCm).toBe(172);
      expect(putData.bodyProfile.bodyType).toBe("rectangle");

      // Verify persisted in DB
      const dbCheck = await prisma.bodyProfile.findUnique({
        where: { userId: newUser.id },
      });
      expect(dbCheck).not.toBeNull();
      expect(dbCheck?.heightCm).toBe(172);
    } finally {
      await prisma.bodyProfile.deleteMany({ where: { userId: newUser.id } });
      await prisma.user.delete({ where: { id: newUser.id } });
    }
  });

  it("Phase 3: client-sent userId in body or query is ignored on protected routes", async () => {
    // 1. POST /api/v1/posts/:id/like: user A tries to send userId: "u-rohan-mehta-002"
    let post = await prisma.post.findFirst();
    if (!post) {
      post = await prisma.post.create({
        data: {
          id: "test-post-phase3",
          userId: "u-rohan-mehta-002",
          caption: "Test outfit look",
          category: "casual",
          imageUrl: "https://example.com/post.jpg",
        },
      });
    }

    const likeRes = await app.inject({
      method: "POST",
      url: `/api/v1/posts/${post.id}/like`,
      headers: {
        authorization: "Bearer test-token-u-ananya-sharma-001",
      },
      payload: {
        userId: "u-rohan-mehta-002",
      },
    });
    expect(likeRes.statusCode).toBe(200);

    // Verify like in DB was recorded for user 1 (u-ananya-sharma-001), NOT user 2
    const likeRecord = await prisma.postLike.findUnique({
      where: {
        postId_userId: {
          postId: post.id,
          userId: "u-ananya-sharma-001",
        },
      },
    });
    expect(likeRecord).not.toBeNull();

    // Clean up like
    if (likeRecord) {
      await prisma.postLike.delete({ where: { id: likeRecord.id } });
    }

    // 2. POST /api/v1/try-on: client sends spoofed userId: "u-rohan-mehta-002"
    const tryOnRes = await app.inject({
      method: "POST",
      url: "/api/v1/try-on",
      headers: {
        authorization: "Bearer test-token-u-ananya-sharma-001",
      },
      payload: {
        userId: "u-rohan-mehta-002", // should be ignored!
        productId: 392,
        userHeightCm: 165,
        sizeSelected: "M",
      },
    });
    expect(tryOnRes.statusCode).toBe(202);
    const tryOnData = tryOnRes.json();

    // Verify session in DB belongs to authenticated user (u-ananya-sharma-001)
    const session = await prisma.tryOnSession.findUnique({
      where: { id: tryOnData.tryOnSessionId },
    });
    expect(session).not.toBeNull();
    expect(session?.userId).toBe("u-ananya-sharma-001");

    // Clean up
    await prisma.renderJob.deleteMany({ where: { tryOnSessionId: tryOnData.tryOnSessionId } });
    await prisma.tryOnSession.delete({ where: { id: tryOnData.tryOnSessionId } });
  });

  it("A3: returns 403 Forbidden when user attempts to update another user's body profile", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/v1/users/u-rohan-mehta-002/body-profile",
      headers: {
        authorization: "Bearer test-token-u-ananya-sharma-001",
      },
      payload: { heightCm: 185 },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("Forbidden");
  });

  it("A3: returns 200 OK when user updates their own body profile with ownership verified", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/v1/users/u-ananya-sharma-001/body-profile",
      headers: {
        authorization: "Bearer test-token-u-ananya-sharma-001",
      },
      payload: {
        heightCm: 166,
        chestCm: 88,
        waistCm: 68,
        hipsCm: 94,
        source: "MANUAL",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.bodyProfile.heightCm).toBe(166);
    expect(body.bodyProfile.chestCm).toBe(88);
  });

  // A2. Consent Gate & Photo Upload
  it("A2: refuses upload URL with 403 ConsentRequired if user has not consented", async () => {
    // Reset consent for test user 2
    await prisma.user.update({
      where: { id: "u-rohan-mehta-002" },
      data: { consentPhotoAt: null },
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/photos/upload-url",
      headers: {
        authorization: "Bearer test-token-u-rohan-mehta-002",
      },
      payload: { filename: "portrait.jpg" },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("ConsentRequired");
  });

  it("A2: grants consent and provides signed upload URL", async () => {
    const consentRes = await app.inject({
      method: "POST",
      url: "/api/v1/me/consent",
      headers: {
        authorization: "Bearer test-token-u-rohan-mehta-002",
      },
      payload: { type: "photo_processing" },
    });

    expect(consentRes.statusCode).toBe(200);
    expect(consentRes.json().success).toBe(true);

    const uploadRes = await app.inject({
      method: "POST",
      url: "/api/v1/photos/upload-url",
      headers: {
        authorization: "Bearer test-token-u-rohan-mehta-002",
      },
      payload: { filename: "portrait.jpg" },
    });

    expect(uploadRes.statusCode).toBe(200);
    const body = uploadRes.json();
    expect(body.uploadUrl).toBeDefined();
    expect(body.storageKey).toContain("user-u-rohan-mehta-002");
  });

  // A2. TryOn Privacy & Visibility
  it("A2: blocks non-owner from accessing private try-on session (403)", async () => {
    // Create private tryon session for user 1
    const testSession = await prisma.tryOnSession.create({
      data: {
        userId: "u-ananya-sharma-001",
        productId: 392,
        visibility: "PRIVATE",
        status: "COMPLETED",
        mode: "demo",
        renderedImageUrl: "https://example.com/render.jpg",
      },
    });

    // Attempt access by user 2
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/try-on/sessions/${testSession.id}`,
      headers: {
        authorization: "Bearer test-token-u-rohan-mehta-002",
      },
    });

    expect(res.statusCode).toBe(403);

    // Clean up
    await prisma.tryOnSession.delete({ where: { id: testSession.id } });
  });

  it("A2: owner can change visibility to PUBLIC and delete session permanently", async () => {
    const testSession = await prisma.tryOnSession.create({
      data: {
        userId: "u-ananya-sharma-001",
        productId: 392,
        visibility: "PRIVATE",
        status: "COMPLETED",
        mode: "demo",
      },
    });

    // Patch visibility to PUBLIC
    const patchRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/try-on/${testSession.id}/visibility`,
      headers: {
        authorization: "Bearer test-token-u-ananya-sharma-001",
      },
      payload: { visibility: "PUBLIC" },
    });

    expect(patchRes.statusCode).toBe(200);
    expect(patchRes.json().session.visibility).toBe("PUBLIC");

    // Delete session
    const delRes = await app.inject({
      method: "DELETE",
      url: `/api/v1/try-on/${testSession.id}`,
      headers: {
        authorization: "Bearer test-token-u-ananya-sharma-001",
      },
    });

    expect(delRes.statusCode).toBe(200);

    // Verify gone from DB
    const check = await prisma.tryOnSession.findUnique({ where: { id: testSession.id } });
    expect(check).toBeNull();
  });

  // A1. Live mode configuration error
  it("A1: startTryOnSession throws CONFIGURATION_ERROR in live mode if GEMINI_API_KEY is missing", async () => {
    const origMode = process.env.TRYON_MODE;
    const origKey = process.env.GEMINI_API_KEY;

    try {
      process.env.TRYON_MODE = "live";
      process.env.GEMINI_API_KEY = "";

      await expect(
        startTryOnSession({
          userId: "u-ananya-sharma-001",
          productId: 392,
          userHeightCm: 165,
          sizeSelected: "S",
        })
      ).rejects.toMatchObject({ code: "CONFIGURATION_ERROR" });
    } finally {
      process.env.TRYON_MODE = origMode;
      process.env.GEMINI_API_KEY = origKey;
    }
  });

  // A4. Multi-Worker atomic claiming
  it("A4: two concurrent workers never claim the same queued job twice", async () => {
    // Create 4 test queued render jobs
    const session = await prisma.tryOnSession.create({
      data: {
        userId: "u-ananya-sharma-001",
        productId: 392,
        status: "PENDING",
        mode: "demo",
      },
    });

    const jobIds: string[] = [];
    for (let i = 0; i < 4; i++) {
      const j = await prisma.renderJob.create({
        data: {
          tryOnSessionId: session.id,
          status: "QUEUED",
          type: "TRYON",
          nextRunAt: new Date(),
        },
      });
      jobIds.push(j.id);
    }

    // Simulate 2 workers concurrently claiming jobs
    async function workerClaim(workerId: string) {
      return await prisma.$transaction(async (tx) => {
        const jobs: any[] = await tx.$queryRaw`
          SELECT id FROM "RenderJob"
          WHERE status = 'QUEUED'
          ORDER BY "createdAt" ASC
          LIMIT 1
          FOR UPDATE SKIP LOCKED
        `;
        if (jobs.length === 0) return null;
        const id = jobs[0].id;
        await tx.$executeRaw`
          UPDATE "RenderJob"
          SET status = 'PROCESSING', "lockedBy" = ${workerId}
          WHERE id = ${id}
        `;
        return id;
      });
    }

    const [claim1, claim2] = await Promise.all([
      workerClaim("worker-instance-1"),
      workerClaim("worker-instance-2"),
    ]);

    expect(claim1).not.toBeNull();
    expect(claim2).not.toBeNull();
    expect(claim1).not.toEqual(claim2); // Must claim different jobs!

    // Clean up
    await prisma.renderJob.deleteMany({ where: { tryOnSessionId: session.id } });
    await prisma.tryOnSession.delete({ where: { id: session.id } });
  });
});
