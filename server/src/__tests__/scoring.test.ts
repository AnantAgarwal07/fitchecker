import { describe, it, expect } from "vitest";
import {
  calculateHeightScore,
  calculateBodyTypeScore,
  calculateFitPreferenceScore,
  calculateStyleVibeScore,
  calculateMatchScore,
  calculateTrendingVelocity,
  extractModelHeightCm,
  recommendSizeAndFit,
} from "../services/scoring.js";
import { ProductSizeChart } from "../services/sizeChart.js";

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

  // Part 3 Unit Tests
  it("omits fit preference clause when fitPreference is empty or null, without trailing colons", () => {
    const userWithoutPref = {
      chestCm: 96,
      waistCm: 80,
      fitPreference: null,
    };

    const sizeChart: ProductSizeChart = {
      garmentType: "top",
      unit: "cm",
      sizes: [
        { label: "M", chestCm: 102, waistCm: 86, type: "top" },
      ],
    };

    const rec = recommendSizeAndFit(userWithoutPref, sizeChart);
    expect(rec.recommendedSize).toBe("M");
    expect(rec.measuredFit).toBe(true);
    expect(rec.isEstimate).toBe(false);

    // Must NOT contain trailing ': .' or awkward empty preference clause
    expect(rec.humanReadableNotes).not.toContain(": .");
    expect(rec.humanReadableNotes).not.toContain("based on your  fit preference");
    expect(rec.humanReadableNotes).toMatch(/^Size M recommended: CHEST:/);
  });

  it("handles missing user measurements with default 75% score and isEstimate: true", () => {
    const userWithoutMeasurements = {
      heightCm: 168,
      bodyType: "hourglass",
      fitPreference: "regular",
      // No chest, bust, waist, hips
    };

    const product = {
      id: 501,
      name: "Classic Silk Shirt",
      sizeChart: {
        garmentType: "top",
        unit: "cm",
        sizes: [
          { label: "S", chestCm: 90, waistCm: 76, type: "top" },
          { label: "M", chestCm: 96, waistCm: 82, type: "top" },
          { label: "L", chestCm: 104, waistCm: 90, type: "top" },
        ],
      },
    };

    const matchRes = calculateMatchScore(userWithoutMeasurements, product);
    expect(matchRes.matchScore).toBe(75);
    expect(matchRes.measuredFit).toBe(false);
    expect(matchRes.isEstimate).toBe(true);
    expect(matchRes.fitNote).toBe("Based on height and body type only. Add measurements for a precise fit.");
  });

  it("never outputs 'Size Onesize recommended' unless product truly is one-size", () => {
    const user = {
      chestCm: 96,
      waistCm: 82,
      fitPreference: "regular",
    };

    // Case 1: Multi-sized product with an "Onesize" label among other sizes (NOT truly one-size)
    const multiSizeChartWithOneSize: ProductSizeChart = {
      garmentType: "top",
      unit: "cm",
      sizes: [
        { label: "Onesize", chestCm: 100, waistCm: 84, type: "top" },
        { label: "M", chestCm: 102, waistCm: 86, type: "top" },
      ],
    };

    const recMulti = recommendSizeAndFit(user, multiSizeChartWithOneSize);
    expect(recMulti.humanReadableNotes).not.toContain("Size Onesize recommended");
    expect(recMulti.humanReadableNotes).not.toContain(": .");

    // Case 2: Truly one-size product (single size 'Onesize')
    const trulyOneSizeChart: ProductSizeChart = {
      garmentType: "top",
      unit: "cm",
      sizes: [
        { label: "Onesize", chestCm: 102, waistCm: 86, type: "top" },
      ],
    };

    const recTruly = recommendSizeAndFit(user, trulyOneSizeChart);
    expect(recTruly.recommendedSize).toBe("Onesize");
    expect(recTruly.humanReadableNotes).toContain("One-size garment recommended based on your regular fit preference:");
  });

  it("handles normal measured case with accurate size recommendation and clean note", () => {
    const user = {
      chestCm: 96,
      waistCm: 80,
      fitPreference: "relaxed",
    };

    const sizeChart: ProductSizeChart = {
      garmentType: "top",
      unit: "cm",
      sizes: [
        { label: "S", chestCm: 96, waistCm: 80, type: "top" },
        { label: "M", chestCm: 104, waistCm: 88, type: "top" },
        { label: "L", chestCm: 112, waistCm: 96, type: "top" },
      ],
    };

    const rec = recommendSizeAndFit(user, sizeChart);
    expect(rec.recommendedSize).toBe("M");
    expect(rec.measuredFit).toBe(true);
    expect(rec.isEstimate).toBe(false);
    expect(rec.matchScore).toBeGreaterThanOrEqual(80);
    expect(rec.humanReadableNotes).toContain("Size M recommended based on your relaxed fit preference: CHEST: +8cm ease");
    expect(rec.humanReadableNotes).not.toContain(": .");
  });
});
