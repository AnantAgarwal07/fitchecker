import path from "path";
import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { getSignedUploadUrl, deleteStorageObject, uploadImage, UPLOADS_DIR } from "../services/storage.js";

export const photoRoutes: FastifyPluginAsync = async (fastify) => {
  // 1. Consent Gate: Record user consent for photo processing (A2)
  fastify.post("/api/v1/me/consent", { preHandler: requireAuth }, async (request, reply) => {
    const ConsentSchema = z.object({
      type: z.literal("photo_processing"),
    });

    const parsed = ConsentSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Invalid consent payload",
        message: "Consent type must be 'photo_processing'",
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id: request.user!.id },
      data: {
        consentPhotoAt: new Date(),
      },
    });

    return reply.status(200).send({
      success: true,
      consentPhotoAt: updatedUser.consentPhotoAt,
      message: "Explicit photo processing consent recorded.",
    });
  });

  // 2. Request Signed Upload URL (A2)
  fastify.post(
    "/api/v1/photos/upload-url",
    {
      preHandler: requireAuth,
      config: {
        rateLimit: {
          max: 20,
          timeWindow: "1 minute",
        },
      },
    },
    async (request, reply) => {
      const user = await prisma.user.findUnique({
        where: { id: request.user!.id },
      });

      if (!user?.consentPhotoAt) {
        return reply.status(403).send({
          error: "ConsentRequired",
          message: "Explicit consent (POST /api/v1/me/consent) required before uploading photos.",
        });
      }

      const UploadSchema = z.object({
        filename: z.string().default("user_photo.jpg"),
        contentType: z.string().default("image/jpeg"),
      });

      const parsed = UploadSchema.safeParse(request.body || {});
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.format() });
      }

      const { filename, contentType } = parsed.data;
      const { uploadUrl, storageKey, expiresInSeconds } = await getSignedUploadUrl(
        user.id,
        filename,
        contentType
      );

      // Create UserPhoto record
      const userPhoto = await prisma.userPhoto.create({
        data: {
          userId: user.id,
          storageKey,
        },
      });

      return reply.status(200).send({
        photoId: userPhoto.id,
        uploadUrl,
        storageKey,
        expiresInSeconds,
      });
    }
  );

  // 3. Local Direct Upload Handler (accepts POST & PUT, 10MB bodyLimit, requireAuth)
  fastify.route({
    method: ["POST", "PUT"],
    url: "/api/v1/photos/direct-upload",
    bodyLimit: 10 * 1024 * 1024,
    preHandler: requireAuth,
    handler: async (request, reply) => {
      const key = (request.query as any)?.key;
      if (!key || typeof key !== "string" || key.trim() === "") {
        return reply.status(400).send({
          error: "BadRequest",
          message: "Missing or invalid storage key parameter.",
        });
      }

      // Reject keys containing "..", leading "/", or backslashes "\"
      if (key.includes("..") || key.startsWith("/") || key.startsWith("\\") || key.includes("\\")) {
        return reply.status(400).send({
          error: "BadRequest",
          message: "Invalid storage key: path traversal or invalid path separators detected.",
        });
      }

      // Verify resolved path stays inside uploads/
      const normalizedUploadsDir = path.resolve(UPLOADS_DIR);
      const resolvedPath = path.resolve(UPLOADS_DIR, key);
      if (!resolvedPath.startsWith(normalizedUploadsDir + path.sep) && resolvedPath !== normalizedUploadsDir) {
        return reply.status(400).send({
          error: "BadRequest",
          message: "Invalid storage key: path resolves outside uploads directory.",
        });
      }

      // Verify the key matches a UserPhoto.storageKey that belongs to the caller
      const userPhoto = await prisma.userPhoto.findFirst({
        where: {
          storageKey: key,
          deletedAt: null,
        },
      });

      if (!userPhoto || userPhoto.userId !== request.user!.id) {
        return reply.status(403).send({
          error: "Forbidden",
          message: "Forbidden: Storage key does not belong to the caller or was not found.",
        });
      }

      // Validate Content-Type: allow only image/jpeg, image/png and image/webp
      const rawContentType = request.headers["content-type"] || "";
      const contentType = rawContentType.toLowerCase().split(";")[0].trim();
      const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];
      if (!allowedMimeTypes.includes(contentType)) {
        return reply.status(415).send({
          error: "UnsupportedMediaType",
          message: `Unsupported media type: only image/jpeg, image/png, and image/webp are allowed. Received: ${contentType || "none"}`,
        });
      }

      // Reject empty bodies
      const rawBody = request.body;
      if (!rawBody || !Buffer.isBuffer(rawBody) || rawBody.length === 0) {
        return reply.status(400).send({
          error: "BadRequest",
          message: "Empty image payload. Direct upload requires non-empty image binary data.",
        });
      }

      const uploadResult = await uploadImage(rawBody, key, contentType);

      return reply.status(200).send({
        success: true,
        key,
        url: `/uploads/${key}`,
        fullUrl: uploadResult.url,
      });
    },
  });

  // 4. Delete All User Photos (A2 Privacy requirement)
  fastify.delete("/api/v1/me/photos", { preHandler: requireAuth }, async (request, reply) => {
    const userId = request.user!.id;

    const photos = await prisma.userPhoto.findMany({
      where: { userId, deletedAt: null },
    });

    for (const photo of photos) {
      await deleteStorageObject(photo.storageKey);
    }

    await prisma.userPhoto.updateMany({
      where: { userId },
      data: { deletedAt: new Date() },
    });

    return reply.status(200).send({
      success: true,
      deletedCount: photos.length,
      message: "All user photos deleted from storage and database.",
    });
  });

  // 5. Delete Single User Photo (A2 Privacy requirement)
  fastify.delete("/api/v1/photos/:id", { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const photo = await prisma.userPhoto.findUnique({
      where: { id },
    });

    if (!photo) {
      return reply.status(404).send({ error: "Photo not found" });
    }

    if (photo.userId !== request.user!.id) {
      return reply.status(403).send({ error: "Forbidden: Not photo owner" });
    }

    await deleteStorageObject(photo.storageKey);

    await prisma.userPhoto.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return reply.status(200).send({
      success: true,
      message: "Photo deleted successfully.",
    });
  });
};
