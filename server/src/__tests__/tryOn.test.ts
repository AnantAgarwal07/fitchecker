import { describe, it, expect } from "vitest";
import { deriveBodyMap } from "../services/bodyMap.js";
import { buildTryOnPrompt } from "../services/tryOnPromptBuilder.js";
import { jobQueue } from "../services/jobQueue.js";

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
});
