import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth, requireOwnership, authenticateUser } from "../middleware/auth.js";
import { refreshUserFeed, invalidateUserFeedCache } from "../recommender/index.js";


export const userRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/users/me (Authenticated Current User with bodyProfile)
  fastify.get("/api/v1/users/me", { preHandler: requireAuth }, async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: request.user!.id },
      include: {
        bodyProfile: true,
        _count: {
          select: {
            posts: true,
            followers: true,
            following: true,
            tryOnSessions: true,
          },
        },
      },
    });

    if (!user) {
      return reply.status(404).send({ error: "User not found" });
    }

    const followersCount = user._count.followers;
    const formattedFollowers =
      followersCount > 1000 ? `${(followersCount / 1000).toFixed(1)}k` : `${followersCount}`;

    return reply.status(200).send({
      id: user.id,
      clerkId: user.clerkId,
      email: user.email,
      name: user.name,
      handle: user.handle.startsWith("@") ? user.handle : `@${user.handle}`,
      avatar: user.avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
      avatarUrl: user.avatarUrl,
      bio: user.bio || "",
      location: user.location || "Global",
      badge: user.isRetailer ? "Official Brand" : "Virtual Stylist Tier I",
      tier: "Virtual Stylist Tier I",
      verified: user.verified,
      isRetailer: user.isRetailer,
      consentPhotoAt: user.consentPhotoAt,
      stats: {
        posts: user._count.posts,
        followers: formattedFollowers,
        following: user._count.following,
        tryOns: user._count.tryOnSessions,
      },
      bodyProfile: user.bodyProfile || null,
    });
  });

  // GET /api/v1/users/:id
  fastify.get("/api/v1/users/:id", { preHandler: authenticateUser }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const effectiveId = (id === "user-self" || id === "me") ? request.user?.id : id;

    if (!effectiveId) {
      return reply.status(401).send({ error: "Unauthorized", message: "Authentication required to access self profile" });
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ id: effectiveId }, { handle: effectiveId.replace("@", "") }],
      },
      include: {
        bodyProfile: true,
        _count: {
          select: {
            posts: true,
            followers: true,
            following: true,
            tryOnSessions: true,
          },
        },
      },
    });

    if (!user) {
      return reply.status(404).send({ error: "User not found" });
    }

    const followersCount = user._count.followers;
    const formattedFollowers =
      followersCount > 1000 ? `${(followersCount / 1000).toFixed(1)}k` : `${followersCount}`;

    return reply.status(200).send({
      id: user.id,
      name: user.name,
      handle: user.handle.startsWith("@") ? user.handle : `@${user.handle}`,
      avatar: user.avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
      avatarUrl: user.avatarUrl,
      bio: user.bio || "",
      location: user.location || "Global",
      badge: user.isRetailer ? "Official Brand" : "Virtual Stylist Tier I",
      tier: "Virtual Stylist Tier I",
      verified: user.verified,
      isRetailer: user.isRetailer,
      consentPhotoAt: user.consentPhotoAt,
      stats: {
        posts: user._count.posts,
        followers: formattedFollowers,
        following: user._count.following,
        tryOns: user._count.tryOnSessions,
      },
      bodyProfile: user.bodyProfile,
    });
  });

  // PUT /api/v1/users/:id/body-profile (Ownership protected A3 & B1)
  fastify.put(
    "/api/v1/users/:id/body-profile",
    { preHandler: requireOwnership("id") },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const effectiveId = (id === "user-self" || id === "me") ? request.user!.id : id;

      const ProfileSchema = z.object({
        heightCm: z.number().min(50).max(250).optional(),
        gender: z.enum(["men", "women", "unisex"]).optional(),
        bodyType: z.string().optional(),
        bustChestCm: z.number().min(30).max(200).optional(),
        chestCm: z.number().min(30).max(200).optional(),
        waistCm: z.number().min(30).max(200).optional(),
        hipsCm: z.number().min(30).max(200).optional(),
        inseamCm: z.number().min(30).max(150).optional(),
        shoulderCm: z.number().min(20).max(100).optional(),
        sleeveCm: z.number().min(20).max(120).optional(),
        weightKg: z.number().min(20).max(300).optional(),
        fitPreference: z.enum(["tight", "fitted", "regular", "relaxed", "oversized"]).optional(),
        styleVibe: z.string().optional(),
        source: z.enum(["MANUAL", "PHOTO", "DEFAULT"]).default("MANUAL"),
        confidence: z.number().min(0).max(1).default(1.0),
        fullBodyPhotoUrl: z.string().url().optional(),
        landmarksJson: z.any().optional(),
      });

      const parsed = ProfileSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.format() });
      }

      const updated = await prisma.bodyProfile.upsert({
        where: { userId: effectiveId },
        update: {
          ...parsed.data,
          measuredAt: new Date(),
        },
        create: {
          userId: effectiveId,
          ...parsed.data,
          measuredAt: new Date(),
        },
      });

      // Recompute and store fresh personalized recommendations immediately on body profile update (Phase 4)
      refreshUserFeed(effectiveId).catch((err) =>
        console.warn("Failed to refresh user feed cache:", err.message)
      );

      return reply.status(200).send({
        message: "Body profile updated successfully",
        bodyProfile: updated,
      });

    }
  );

  // GET /api/v1/users - List creators
  fastify.get("/api/v1/users", async (request, reply) => {
    const users = await prisma.user.findMany({
      take: 20,
      include: {
        _count: {
          select: { posts: true, followers: true },
        },
      },
    });

    return reply.status(200).send({
      users: users.map((u) => ({
        id: u.id,
        name: u.name,
        handle: u.handle.startsWith("@") ? u.handle : `@${u.handle}`,
        avatar: u.avatarUrl,
        location: u.location,
        verified: u.verified,
        isRetailer: u.isRetailer,
        postsCount: u._count.posts,
        followersCount: u._count.followers,
      })),
    });
  });

  // GET /api/v1/users/search (Phase C1 & Phase 5: Search Creators & Stylists)
  fastify.get("/api/v1/users/search", async (request, reply) => {
    const QuerySchema = z.object({
      q: z.string().optional().default(""),
      limit: z.coerce.number().min(1).max(50).default(20),
    });

    const parsed = QuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.format() });
    }

    const { q, limit } = parsed.data;
    const cleanQ = q.trim().replace("@", "");

    const where: any = {};
    if (cleanQ.length > 0) {
      where.OR = [
        { name: { contains: cleanQ, mode: "insensitive" } },
        { handle: { contains: cleanQ, mode: "insensitive" } },
        { bio: { contains: cleanQ, mode: "insensitive" } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      take: limit,
      include: {
        _count: {
          select: { posts: true, followers: true, following: true },
        },
      },
      orderBy: cleanQ.length === 0 ? [{ followers: { _count: "desc" } }] : undefined,
    });

    return reply.status(200).send({
      users: users.map((u) => ({
        id: u.id,
        name: u.name,
        handle: u.handle.startsWith("@") ? u.handle : `@${u.handle}`,
        avatar: u.avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
        avatarUrl: u.avatarUrl,
        bio: u.bio || "",
        location: u.location || "Global",
        verified: u.verified,
        isRetailer: u.isRetailer,
        postsCount: u._count.posts,
        followersCount: u._count.followers,
        followingCount: u._count.following,
      })),
    });
  });

  // POST /api/v1/users/:id/follow (Phase C1: Follow User)
  fastify.post("/api/v1/users/:id/follow", { preHandler: requireAuth }, async (request, reply) => {
    const { id: followingId } = request.params as { id: string };
    const followerId = request.user!.id;

    if (followerId === followingId) {
      return reply.status(400).send({
        error: "Cannot follow yourself",
        message: "You cannot follow your own profile.",
      });
    }

    // Verify target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: followingId },
      select: { id: true, name: true },
    });

    if (!targetUser) {
      return reply.status(404).send({ error: "User not found" });
    }

    // Upsert follow relationship atomically
    await prisma.follow.upsert({
      where: {
        followerId_followingId: { followerId, followingId },
      },
      update: {},
      create: { followerId, followingId },
    });

    // Log follow interaction asynchronously (Phase C2)
    prisma.interaction.create({
      data: {
        userId: followerId,
        type: "FOLLOW",
        targetUserId: followingId,
      },
    }).catch((err) => console.warn("Failed to log follow interaction:", err.message));

    return reply.status(200).send({
      following: true,
      followerId,
      followingId,
      message: `Now following ${targetUser.name}`,
    });
  });

  // DELETE /api/v1/users/:id/follow (Phase C1: Unfollow User)
  fastify.delete("/api/v1/users/:id/follow", { preHandler: requireAuth }, async (request, reply) => {
    const { id: followingId } = request.params as { id: string };
    const followerId = request.user!.id;

    await prisma.follow.deleteMany({
      where: { followerId, followingId },
    });

    // Log unfollow interaction (Phase C2)
    prisma.interaction.create({
      data: {
        userId: followerId,
        type: "UNFOLLOW",
        targetUserId: followingId,
      },
    }).catch((err) => console.warn("Failed to log unfollow interaction:", err.message));

    return reply.status(200).send({
      following: false,
      followerId,
      followingId,
      message: "Successfully unfollowed user",
    });
  });
};

