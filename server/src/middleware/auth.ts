import { FastifyRequest, FastifyReply } from "fastify";
import { createClerkClient, verifyToken } from "@clerk/backend";
import { prisma } from "../db.js";

export interface AuthenticatedUser {
  id: string;
  clerkId?: string | null;
  email: string;
  handle: string;
  name: string;
  isRetailer: boolean;
  isDemoUser: boolean;
}

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthenticatedUser;
  }
}

const DEFAULT_DEMO_USER_ID = "u-ananya-sharma-001";

// Server boot-time security check (A3)
export function validateAuthConfig() {
  const isProduction = process.env.NODE_ENV === "production";
  const authDemoMode = process.env.AUTH_DEMO_MODE === "true";

  if (isProduction && authDemoMode) {
    throw new Error(
      "❌ FATAL SECURITY VIOLATION: AUTH_DEMO_MODE=true is not permitted in production environment. Server refusing to boot."
    );
  }
}

const clerkSecretKey = process.env.CLERK_SECRET_KEY;
const clerkClient = clerkSecretKey ? createClerkClient({ secretKey: clerkSecretKey }) : null;

/**
 * Parses and verifies user credentials from Authorization header.
 * Attaches request.user if valid.
 */
export async function authenticateUser(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7).trim();

    // 1. Check for test tokens (for automated test suite)
    if (token.startsWith("test-token-")) {
      const targetUserId = token.replace("test-token-", "");
      const user = await prisma.user.findFirst({
        where: { OR: [{ id: targetUserId }, { clerkId: targetUserId }] },
      });

      if (user) {
        request.user = {
          id: user.id,
          clerkId: user.clerkId,
          email: user.email,
          handle: user.handle,
          name: user.name,
          isRetailer: user.isRetailer,
          isDemoUser: false,
        };
        return;
      }
    }

    // 2. Real Clerk JWT Verification
    if (clerkSecretKey) {
      try {
        const verified = await verifyToken(token, {
          secretKey: clerkSecretKey,
        });

        if (verified && verified.sub) {
          const clerkId = verified.sub;
          let user = await prisma.user.findUnique({
            where: { clerkId },
          });

          // JIT user provisioning on first Clerk login
          if (!user && clerkClient) {
            try {
              const clerkUser = await clerkClient.users.getUser(clerkId);
              const email = clerkUser.emailAddresses[0]?.emailAddress || `${clerkId}@fitsyou.app`;
              const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || clerkUser.username || "FitsYou Stylist";
              const handle = clerkUser.username || `user_${clerkId.slice(-6)}`;

              user = await prisma.user.create({
                data: {
                  id: `u-${clerkId}`,
                  clerkId,
                  email,
                  handle,
                  name,
                  avatarUrl: clerkUser.imageUrl,
                },
              });
            } catch (clerkErr) {
              console.warn("Failed to fetch Clerk profile:", clerkErr);
            }
          }

          if (user) {
            request.user = {
              id: user.id,
              clerkId: user.clerkId,
              email: user.email,
              handle: user.handle,
              name: user.name,
              isRetailer: user.isRetailer,
              isDemoUser: false,
            };
            return;
          }
        }
      } catch (err: any) {
        // Token invalid
        return;
      }
    } else {
      // 3. Fallback JWT / Mock payload parser for local development
      try {
        const parts = token.split(".");
        if (parts.length === 3) {
          const payloadJson = Buffer.from(parts[1], "base64").toString("utf8");
          const payload = JSON.parse(payloadJson);
          const userId = payload.sub || payload.userId;

          if (userId) {
            const user = await prisma.user.findFirst({
              where: { OR: [{ id: userId }, { clerkId: userId }] },
            });

            if (user) {
              request.user = {
                id: user.id,
                clerkId: user.clerkId,
                email: user.email,
                handle: user.handle,
                name: user.name,
                isRetailer: user.isRetailer,
                isDemoUser: false,
              };
              return;
            }
          }
        }
      } catch (e) {
        // invalid token format
      }
    }
  }

  // 4. Demo auth fallback ONLY if NOT in production AND AUTH_DEMO_MODE=true
  const isProduction = process.env.NODE_ENV === "production";
  const authDemoMode = process.env.AUTH_DEMO_MODE === "true";

  if (!isProduction && authDemoMode) {
    const fallbackUser = await prisma.user.findFirst({
      where: { id: DEFAULT_DEMO_USER_ID },
    });

    if (fallbackUser) {
      request.user = {
        id: fallbackUser.id,
        clerkId: fallbackUser.clerkId,
        email: fallbackUser.email,
        handle: fallbackUser.handle,
        name: fallbackUser.name,
        isRetailer: fallbackUser.isRetailer,
        isDemoUser: true,
      };
    }
  }
}

/**
 * Pre-handler that strictly requires an authenticated user.
 * Returns 401 Unauthorized if not authenticated.
 */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  await authenticateUser(request, reply);

  if (!request.user) {
    return reply.status(401).send({
      error: "Unauthorized",
      message: "Valid authentication credentials required to access this resource.",
    });
  }
}

/**
 * Enforces ownership: only the authenticated user can access/modify their own resource.
 * Returns 403 Forbidden if attempting to operate on another user's ID.
 */
export function requireOwnership(targetUserIdParamName = "id") {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    await requireAuth(request, reply);
    if (!request.user) return; // Already sent 401

    const params = request.params as any;
    const body = (request.body as any) || {};
    const targetId = params[targetUserIdParamName] || params.userId || body.userId;

    if (targetId && targetId !== "user-self" && targetId !== request.user.id) {
      return reply.status(403).send({
        error: "Forbidden",
        message: "You do not have permission to view or modify this user's resource.",
      });
    }
  };
}
