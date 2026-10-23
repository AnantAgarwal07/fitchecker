import { describe, it, expect } from "vitest";
import {
  calculateHeightScore,
  calculateBodyTypeScore,
  calculateFitPreferenceScore,
  calculateStyleVibeScore,
  calculateMatchScore,
  calculateTrendingVelocity,
  extractModelHeightCm,
} from "../services/scoring.js";

describe("Scoring Heuristics & Match Engine", () => {
  it("extracts model height correctly from rawDetails text", () => {
    const rawDetails = {
      size_and_fit: "The model (height 5'8) is wearing a size S",
    };
    const height = extractModelHeightCm(rawDetails);
    expect(height).toBe(173); // 5*12 + 8 = 68 inches * 2.54 = 172.72 -> 173 cm
  });

  it("calculates height score with high accuracy when user height matches model", () => {
    const product = {
      rawDetails: { size_and_fit: "The model (height 5'8) is wearing a size S" },
      audience: "women",
    };
    // 173cm user vs 173cm model
    const res = calculateHeightScore(173, product);
    expect(res.score).toBe(1.0);
    expect(res.note).toContain("Ideal length match");
  });

  it("calculates body type compatibility gracefully", () => {
    const resHourglass = calculateBodyTypeScore("hourglass", "crop top", "fitted");
    expect(resHourglass.score).toBeGreaterThanOrEqual(0.9);

    const resAthletic = calculateBodyTypeScore("athletic", "casual shirt", "slim fit");
    expect(resAthletic.score).toBeGreaterThanOrEqual(0.9);
  });

  it("calculates fit preference compatibility", () => {
    const fitMatch = calculateFitPreferenceScore("fitted", "fitted");
    expect(fitMatch.score).toBe(1.0);

    const fitMismatch = calculateFitPreferenceScore("fitted", "oversized");
    expect(fitMismatch.score).toBeLessThan(0.5);
  });

  it("calculates overall match score in 70-99 range with detailed fitNote", () => {
    const user = {
      heightCm: 165,
      gender: "women",
      bodyType: "hourglass",
      fitPreference: "fitted",
      styleVibe: "streetwear",
    };

    const product = {
      id: 392,
      name: "Graphic Print Fitted Crop Top",
      category: "tops",
      productType: "crop top",
      fit: "fitted",
      occasion: "casual",
      styleTags: ["streetwear", "crop top"],
      audience: "women",
    };

    const result = calculateMatchScore(user, product);
    expect(result.matchScore).toBeGreaterThanOrEqual(70);
    expect(result.matchScore).toBeLessThanOrEqual(99);
    expect(result.fitNote.length).toBeGreaterThan(15);
    expect(result.breakdown).toHaveProperty("heightScore");
    expect(result.breakdown).toHaveProperty("bodyTypeScore");
  });

  it("calculates trending velocity with time decay", () => {
    const now = new Date();
    const freshPost = {
      viewsCount: 1000,
      likesCount: 100,
      sharesCount: 20,
      tryOnCount: 10,
      createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 2), // 2 hours old
    };

    const oldPost = {
      ...freshPost,
      createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 48), // 48 hours old (2 half lives)
    };

    const freshScore = calculateTrendingVelocity(freshPost, now);
    const oldScore = calculateTrendingVelocity(oldPost, now);

    expect(freshScore).toBeGreaterThan(0);
    expect(freshScore).toBeGreaterThan(oldScore);
    // After 48h (2 half lives of 24h), score should be roughly 1/4th of base
    expect(oldScore / freshScore).toBeCloseTo(0.25, 1);
  });
});
