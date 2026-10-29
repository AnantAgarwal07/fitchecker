import { describe, it, expect, vi, afterEach } from "vitest";
import { deriveBodyMap } from "../services/bodyMap.js";
import { buildTryOnPrompt } from "../services/tryOnPromptBuilder.js";
import { jobQueue } from "../services/jobQueue.js";
import { toInlinePart, claimJob, executeTryOnJob } from "../services/tryOnPipeline.js";
import { prisma } from "../db.js";

describe("Virtual Try-On Pipeline & Body MAP", () => {
  it("derives body MAP landmarks and proportions accurately from height", () => {
    const bodyMap = deriveBodyMap({
      heightCm: 165,
      gender: "women",
      bodyType: "hourglass",
      photoUrl: "https://example.com/photo.jpg",
    });

    expect(bodyMap.proportions.heightCm).toBe(165);
    expect(bodyMap.proportions.shoulderWidthCm).toBeGreaterThan(30);
    expect(bodyMap.proportions.shoulderWidthCm).toBeLessThan(45);
    expect(bodyMap.proportions.waistCm).toBeLessThan(bodyMap.proportions.hipCm); // Hourglass waist < hips
    expect(bodyMap.landmarks2D).toHaveProperty("neck");
    expect(bodyMap.landmarks2D).toHaveProperty("leftShoulder");
    expect(bodyMap.landmarks2D).toHaveProperty("rightShoulder");
    expect(bodyMap.landmarks2D).toHaveProperty("chestCenter");
    expect(bodyMap.landmarks2D).toHaveProperty("leftWaist");
    expect(bodyMap.landmarks2D).toHaveProperty("rightWaist");

    // Landmarks must be normalized in 0.0 - 1.0 range
    Object.values(bodyMap.landmarks2D).forEach((point) => {
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x).toBeLessThanOrEqual(1);
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeLessThanOrEqual(1);
    });
  });

  it("builds structured multimodal prompt for Gemini virtual try-on", () => {
    const bodyMap = deriveBodyMap({ heightCm: 170, gender: "women", bodyType: "rectangle" });
    const prompt = buildTryOnPrompt({
      userName: "Tara",
      userHeightCm: 170,
      bodyMap,
      product: {
        id: 4,
        name: "Bandhani Gotta Patti Saree",
        brand: "VASTRANAND",
        category: "sarees",
        productType: "bandhani saree",
        color: "red and yellow",
        material: "Poly Chiffon",
        fit: "regular",
      },
      sizeSelected: "Free Size",
    });

    expect(prompt).toContain("Virtual Try-On Task");
    expect(prompt).toContain("VASTRANAND");
    expect(prompt).toContain("Bandhani Gotta Patti Saree");
    expect(prompt).toContain("170 cm");
    expect(prompt).toContain("IDENTITY & POSE PRESERVATION");
    expect(prompt).toContain("ANTHROPOMETRIC FIT & DRAPING");
  });

  it("manages async try-on job queue state transitions", () => {
    const testJobId = "test-job-999";
    const job = jobQueue.createJob({
      jobId: testJobId,
      tryOnSessionId: "session-999",
      userId: "u-test",
      productId: 392,
      userPhotoUrl: "https://example.com/user.jpg",
      userHeightCm: 165,
      sizeSelected: "S",
    });

    expect(job.status).toBe("QUEUED");
    expect(job.progressPercent).toBe(0);

    // Transition to processing
    const processingJob = jobQueue.updateJob(testJobId, {
      status: "PROCESSING",
      progressPercent: 50,
    });
    expect(processingJob?.status).toBe("PROCESSING");
    expect(processingJob?.progressPercent).toBe(50);

    // Transition to completed
    const completedJob = jobQueue.updateJob(testJobId, {
      status: "COMPLETED",
      progressPercent: 100,
      renderedImageUrl: "https://example.com/rendered.jpg",
      fitScore: 95,
      fitNote: "Perfect fit",
    });
    expect(completedJob?.status).toBe("COMPLETED");
    expect(completedJob?.fitScore).toBe(95);

    // Retrieve by ID
    const retrieved = jobQueue.getJob(testJobId);
    expect(retrieved?.status).toBe("COMPLETED");
  });

  describe("toInlinePart", () => {
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it("fetches an image and returns base64 inlineData with mimeType", async () => {
      const rawStr = "simulated-binary-image-data";
      const uint8 = new TextEncoder().encode(rawStr);
      const expectedBase64 = Buffer.from(uint8).toString("base64");

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: {
          get: (header: string) => (header.toLowerCase() === "content-type" ? "image/webp" : null),
        },
        arrayBuffer: async () => uint8.buffer,
      } as any);

      const part = await toInlinePart("https://example.com/photo.webp");
      expect(part).toEqual({
        inlineData: {
          mimeType: "image/webp",
          data: expectedBase64,
        },
      });
    });

    it("throws a clear error when HTTP fetch fails", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
        headers: { get: () => null },
      } as any);

      await expect(toInlinePart("https://example.com/missing.jpg")).rejects.toThrow(
        "Failed to fetch image from https://example.com/missing.jpg: HTTP 404 Not Found"
      );
    });

    it("throws timeout error when request is aborted", async () => {
      const abortErr = new Error("The user aborted a request.");
      abortErr.name = "AbortError";
      global.fetch = vi.fn().mockRejectedValue(abortErr);

      await expect(toInlinePart("https://example.com/timeout.jpg")).rejects.toThrow(
        "Timeout fetching image from https://example.com/timeout.jpg (exceeded 10s limit)"
      );
    });
  });

  describe("Atomic claimJob Concurrency", () => {
    it("ensures two concurrent claims on the same job result in only one winner and attempts = 1", async () => {
      // Create a test session and queued render job
      const testSession = await prisma.tryOnSession.create({
        data: {
          userId: "u-ananya-sharma-001",
          productId: 392,
          status: "PENDING",
          mode: "demo",
        },
      });

      const testJob = await prisma.renderJob.create({
        data: {
          tryOnSessionId: testSession.id,
          status: "QUEUED",
          type: "TRYON",
          attempts: 0,
          nextRunAt: new Date(),
        },
      });

      // Run two claims concurrently on the SAME jobId
      const [claim1, claim2] = await Promise.all([
        claimJob(testJob.id, "worker-node-alpha"),
        claimJob(testJob.id, "worker-node-beta"),
      ]);

      // Exactly one claim must succeed, and the other must fail
      expect([claim1, claim2].sort()).toEqual([false, true]);

      // Verify the job in DB has status PROCESSING, attempts = 1, and lockedBy set to winning worker
      const updatedJob = await prisma.renderJob.findUnique({
        where: { id: testJob.id },
      });

      expect(updatedJob).not.toBeNull();
      expect(updatedJob?.status).toBe("PROCESSING");
      expect(updatedJob?.attempts).toBe(1);
      expect(["worker-node-alpha", "worker-node-beta"]).toContain(updatedJob?.lockedBy);

      // Clean up
      await prisma.renderJob.delete({ where: { id: testJob.id } });
      await prisma.tryOnSession.delete({ where: { id: testSession.id } });
    });
  });

  describe("Demo mode failure handling", () => {
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it("marks job and session FAILED with reason when render service fails, without retrying or substituting static photo", async () => {
      // Mock fetch to simulate broken render service
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
      } as any);

      const testSession = await prisma.tryOnSession.create({
        data: {
          userId: "u-ananya-sharma-001",
          productId: 392,
          status: "PENDING",
          mode: "demo",
        },
      });

      const testJob = await prisma.renderJob.create({
        data: {
          tryOnSessionId: testSession.id,
          status: "QUEUED",
          type: "TRYON",
          attempts: 0,
        },
      });

      const claimed = await claimJob(testJob.id, "test-worker");
      expect(claimed).toBe(true);

      await executeTryOnJob(testJob.id, "test-worker", true);

      const failedJob = await prisma.renderJob.findUnique({ where: { id: testJob.id } });
      const failedSession = await prisma.tryOnSession.findUnique({ where: { id: testSession.id } });

      expect(failedJob?.status).toBe("FAILED");
      expect(failedJob?.attempts).toBe(1);
      expect(failedJob?.lastError).toContain("Demo render service failed");
      expect(failedSession?.status).toBe("FAILED");
      expect(failedSession?.errorReason).toContain("Demo render service failed");
      expect(failedSession?.renderedImageUrl).toBeNull();

      // Clean up
      await prisma.renderJob.delete({ where: { id: testJob.id } });
      await prisma.tryOnSession.delete({ where: { id: testSession.id } });
    });
  });
});

