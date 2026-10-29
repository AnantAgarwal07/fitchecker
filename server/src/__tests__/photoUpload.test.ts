import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { FastifyInstance } from "fastify";
import fs from "fs";
import path from "path";
import { buildServer, setupApp } from "../index.js";
import { prisma } from "../db.js";
import { UPLOADS_DIR } from "../services/storage.js";

describe("Photo Upload Pipeline & Security Hardening", () => {
  let app: FastifyInstance;
  const user1 = "u-ananya-sharma-001";
  const user2 = "u-rohan-mehta-002";

  // 1x1 1-pixel valid JPEG buffer
  const smallJpegBuffer = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
    0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
    0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
    0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20,
    0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27,
    0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
    0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01,
    0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04,
    0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f,
    0x00, 0xbf, 0x00, 0xff, 0xd9
  ]);

  let user1StorageKey = "";
  let user1PhotoId = "";

  beforeAll(async () => {
    app = buildServer();
    await setupApp(app);
    await app.ready();

    // Ensure user1 has photo processing consent recorded
    await prisma.user.update({
      where: { id: user1 },
      data: { consentPhotoAt: new Date() },
    });

    // Request signed upload URL for user1 to create valid UserPhoto record
    const uploadUrlRes = await app.inject({
      method: "POST",
      url: "/api/v1/photos/upload-url",
      headers: { authorization: `Bearer test-token-${user1}` },
      payload: { filename: "calibration_test.jpg", contentType: "image/jpeg" },
    });

    expect(uploadUrlRes.statusCode).toBe(200);
    const data = JSON.parse(uploadUrlRes.payload);
    user1StorageKey = data.storageKey;
    user1PhotoId = data.photoId;
    expect(user1StorageKey).toBeDefined();
  });

  afterAll(async () => {
    // Clean up created photo record and disk file
    if (user1PhotoId) {
      await prisma.userPhoto.deleteMany({ where: { id: user1PhotoId } });
    }
    if (user1StorageKey) {
      const diskPath = path.resolve(UPLOADS_DIR, user1StorageKey);
      if (fs.existsSync(diskPath)) {
        fs.unlinkSync(diskPath);
      }
    }
    await app.close();
  });

  // -------------------------------------------------------------
  // Test 1: Upload succeeds for a small JPEG (POST & PUT)
  // -------------------------------------------------------------
  it("upload succeeds for a small JPEG via POST and PUT", async () => {
    // Test POST
    const resPost = await app.inject({
      method: "POST",
      url: `/api/v1/photos/direct-upload?key=${encodeURIComponent(user1StorageKey)}`,
      headers: {
        "content-type": "image/jpeg",
        authorization: `Bearer test-token-${user1}`,
      },
      payload: smallJpegBuffer,
    });

    expect(resPost.statusCode).toBe(200);
    const bodyPost = JSON.parse(resPost.payload);
    expect(bodyPost.success).toBe(true);
    expect(bodyPost.key).toBe(user1StorageKey);
    expect(bodyPost.url).toBe(`/uploads/${user1StorageKey}`);

    // Verify file written to disk inside server/uploads
    const diskPath = path.resolve(UPLOADS_DIR, user1StorageKey);
    expect(fs.existsSync(diskPath)).toBe(true);
    const written = fs.readFileSync(diskPath);
    expect(written.length).toBe(smallJpegBuffer.length);

    // Test PUT (frontend may use either)
    const resPut = await app.inject({
      method: "PUT",
      url: `/api/v1/photos/direct-upload?key=${encodeURIComponent(user1StorageKey)}`,
      headers: {
        "content-type": "image/jpeg",
        authorization: `Bearer test-token-${user1}`,
      },
      payload: smallJpegBuffer,
    });

    expect(resPut.statusCode).toBe(200);
    const bodyPut = JSON.parse(resPut.payload);
    expect(bodyPut.success).toBe(true);
  });

  // -------------------------------------------------------------
  // Test 2: A > 10 MB body returns 413 Payload Too Large
  // -------------------------------------------------------------
  it("a > 10 MB body returns 413 Payload Too Large", async () => {
    // 10.5 MB buffer (exceeds 10 MB limit)
    const largeBuffer = Buffer.alloc(10.5 * 1024 * 1024);

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/photos/direct-upload?key=${encodeURIComponent(user1StorageKey)}`,
      headers: {
        "content-type": "image/jpeg",
        authorization: `Bearer test-token-${user1}`,
      },
      payload: largeBuffer,
    });

    expect(res.statusCode).toBe(413);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("PayloadTooLarge");
  });

  // -------------------------------------------------------------
  // Test 3: image/gif returns 415 Unsupported Media Type
  // -------------------------------------------------------------
  it("image/gif returns 415 Unsupported Media Type", async () => {
    const gifBuffer = Buffer.from("GIF89a...");

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/photos/direct-upload?key=${encodeURIComponent(user1StorageKey)}`,
      headers: {
        "content-type": "image/gif",
        authorization: `Bearer test-token-${user1}`,
      },
      payload: gifBuffer,
    });

    expect(res.statusCode).toBe(415);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("UnsupportedMediaType");
  });

  // -------------------------------------------------------------
  // Test 4: An unauthenticated request returns 401 Unauthorized
  // -------------------------------------------------------------
  it("an unauthenticated request returns 401 Unauthorized", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/photos/direct-upload?key=${encodeURIComponent(user1StorageKey)}`,
      headers: {
        "content-type": "image/jpeg",
      },
      payload: smallJpegBuffer,
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("Unauthorized");
  });

  // -------------------------------------------------------------
  // Test 5: Another user's key returns 403 Forbidden
  // -------------------------------------------------------------
  it("another user's key returns 403 Forbidden", async () => {
    // user2 attempting to upload using user1's storageKey
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/photos/direct-upload?key=${encodeURIComponent(user1StorageKey)}`,
      headers: {
        "content-type": "image/jpeg",
        authorization: `Bearer test-token-${user2}`,
      },
      payload: smallJpegBuffer,
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("Forbidden");
    expect(body.message).toMatch(/Storage key does not belong/);
  });

  // -------------------------------------------------------------
  // Test 6: A path traversal '../' key or leading '/' is rejected (400)
  // -------------------------------------------------------------
  it("a '../' or leading '/' key is rejected with 400 Bad Request", async () => {
    // Case A: path traversal with ..
    const resTraversal = await app.inject({
      method: "POST",
      url: `/api/v1/photos/direct-upload?key=../traversal.jpg`,
      headers: {
        "content-type": "image/jpeg",
        authorization: `Bearer test-token-${user1}`,
      },
      payload: smallJpegBuffer,
    });

    expect(resTraversal.statusCode).toBe(400);
    const bodyTraversal = JSON.parse(resTraversal.payload);
    expect(bodyTraversal.error).toBe("BadRequest");

    // Case B: leading slash
    const resLeadingSlash = await app.inject({
      method: "POST",
      url: `/api/v1/photos/direct-upload?key=/absolute/path.jpg`,
      headers: {
        "content-type": "image/jpeg",
        authorization: `Bearer test-token-${user1}`,
      },
      payload: smallJpegBuffer,
    });

    expect(resLeadingSlash.statusCode).toBe(400);

    // Case C: backslashes
    const resBackslash = await app.inject({
      method: "POST",
      url: `/api/v1/photos/direct-upload?key=folder\\sub\\test.jpg`,
      headers: {
        "content-type": "image/jpeg",
        authorization: `Bearer test-token-${user1}`,
      },
      payload: smallJpegBuffer,
    });

    expect(resBackslash.statusCode).toBe(400);

    // Case D: empty body buffer rejected
    const resEmptyBody = await app.inject({
      method: "POST",
      url: `/api/v1/photos/direct-upload?key=${encodeURIComponent(user1StorageKey)}`,
      headers: {
        "content-type": "image/jpeg",
        authorization: `Bearer test-token-${user1}`,
      },
      payload: Buffer.from(""),
    });

    expect(resEmptyBody.statusCode).toBe(400);
  });

  // -------------------------------------------------------------
  // Test 7: The returned /uploads/... URL returns 200 with the image
  // -------------------------------------------------------------
  it("the returned /uploads/... URL returns 200 with the image and CORS/CORP headers", async () => {
    // Make sure file exists on disk
    const diskPath = path.resolve(UPLOADS_DIR, user1StorageKey);
    fs.writeFileSync(diskPath, smallJpegBuffer);

    const res = await app.inject({
      method: "GET",
      url: `/uploads/${user1StorageKey}`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers["cross-origin-resource-policy"]).toBe("cross-origin");
    expect(res.rawPayload.length).toBe(smallJpegBuffer.length);
    expect(Buffer.compare(res.rawPayload, smallJpegBuffer)).toBe(0);
  });
});
