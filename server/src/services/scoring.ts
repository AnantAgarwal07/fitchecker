import { SCORING_CONFIG } from "../config/scoring.js";
import { ProductSizeChart, ParsedSizeEntry } from "./sizeChart.js";

export interface UserMeasurementProfile {
  heightCm?: number | null;
  chestCm?: number | null;
  bustChestCm?: number | null;
  waistCm?: number | null;
  hipsCm?: number | null;
  shoulderCm?: number | null;
  inseamCm?: number | null;
  fitPreference?: string | null;
  styleVibe?: string | null;
  gender?: string | null;
  bodyType?: string | null;
}

export interface AreaFitReport {
  area: "chest" | "waist" | "hips" | "shoulder" | "length" | "inseam";
  garmentCm: number;
  bodyCm: number;
  easeCm: number;
  label: "tight" | "regular" | "relaxed" | "oversized";
  targetEaseCm: number;
}

export interface SizeRecommendationResult {
  recommendedSize: string | null;
  alternatives: string[];
  fitReport: AreaFitReport[] | null;
  fitDescriptor: string;
  matchScore: number;
  measuredFit: boolean;
  confidence: number;
  humanReadableNotes: string;
}

/**
 * Classifies ease into fit label (tight, regular, relaxed, oversized)
 */
export function classifyEase(
  area: "chest" | "waist" | "hips" | "shoulder",
  easeCm: number
): "tight" | "regular" | "relaxed" | "oversized" {
  const thresholds = SCORING_CONFIG.easeThresholds[area] || SCORING_CONFIG.easeThresholds.chest;

  if (easeCm < thresholds.tightMax) return "tight";
  if (easeCm <= thresholds.regularMax) return "regular";
  if (easeCm <= thresholds.relaxedMax) return "relaxed";
  return "oversized";
}

/**
 * Evaluates ease for a specific garment size against user measurements (B4)
 */
export function evaluateSizeFit(
  sizeEntry: ParsedSizeEntry,
  user: UserMeasurementProfile
): {
  fitReport: AreaFitReport[];
  weightedDeviation: number;
  isTooTight: boolean;
  fitDescriptor: string;
} {
  const pref = (user.fitPreference || "regular").toLowerCase();
  const reports: AreaFitReport[] = [];
  let totalDeviation = 0;
  let weightsSum = 0;
  let isTooTight = false;

  const userChest = user.chestCm || user.bustChestCm;

  // 1. Chest / Bust
  if (sizeEntry.chestCm !== undefined && userChest) {
    const ease = Math.round((sizeEntry.chestCm - userChest) * 10) / 10;
    const target = SCORING_CONFIG.targetEase.chest[pref] ?? 6.0;
    const label = classifyEase("chest", ease);

    if (ease < SCORING_CONFIG.tightToleranceCm) isTooTight = true;

    const dev = Math.abs(ease - target);
    totalDeviation += dev * 2.0; // Higher weight on chest
    weightsSum += 2.0;

    reports.push({
      area: "chest",
      garmentCm: sizeEntry.chestCm,
      bodyCm: userChest,
      easeCm: ease,
      label,
      targetEaseCm: target,
    });
  }

  // 2. Waist
  if (sizeEntry.waistCm !== undefined && user.waistCm) {
    const ease = Math.round((sizeEntry.waistCm - user.waistCm) * 10) / 10;
    const target = SCORING_CONFIG.targetEase.waist[pref] ?? 4.0;
    const label = classifyEase("waist", ease);

    if (ease < SCORING_CONFIG.tightToleranceCm) isTooTight = true;

    const dev = Math.abs(ease - target);
    totalDeviation += dev * 1.5;
    weightsSum += 1.5;

    reports.push({
      area: "waist",
      garmentCm: sizeEntry.waistCm,
      bodyCm: user.waistCm,
      easeCm: ease,
      label,
      targetEaseCm: target,
    });
  }

  // 3. Hips
  if (sizeEntry.hipsCm !== undefined && user.hipsCm) {
    const ease = Math.round((sizeEntry.hipsCm - user.hipsCm) * 10) / 10;
    const target = SCORING_CONFIG.targetEase.hips[pref] ?? 5.0;
    const label = classifyEase("hips", ease);

    if (ease < SCORING_CONFIG.tightToleranceCm) isTooTight = true;

    const dev = Math.abs(ease - target);
    totalDeviation += dev * 1.2;
    weightsSum += 1.2;

    reports.push({
      area: "hips",
      garmentCm: sizeEntry.hipsCm,
      bodyCm: user.hipsCm,
      easeCm: ease,
      label,
      targetEaseCm: target,
    });
  }

  // 4. Shoulder
  if (sizeEntry.shoulderCm !== undefined && user.shoulderCm) {
    const ease = Math.round((sizeEntry.shoulderCm - user.shoulderCm) * 10) / 10;
    const target = 1.5;
    const label = classifyEase("shoulder", ease);

    if (ease < -1.5) isTooTight = true;

    const dev = Math.abs(ease - target);
    totalDeviation += dev * 1.0;
    weightsSum += 1.0;

    reports.push({
      area: "shoulder",
      garmentCm: sizeEntry.shoulderCm,
      bodyCm: user.shoulderCm,
      easeCm: ease,
      label,
      targetEaseCm: target,
    });
  }

  const weightedDeviation = weightsSum > 0 ? totalDeviation / weightsSum : 999;

  // Build descriptive human sentence for virtual try-on and UI (B5)
  const primaryArea = reports.find((r) => r.area === "chest") || reports[0];
  const fitDescriptor = primaryArea
    ? `${primaryArea.label} fit, about ${Math.abs(primaryArea.easeCm)} cm ${primaryArea.easeCm >= 0 ? "looser" : "tighter"} at ${primaryArea.area}`
    : `${pref} fit on silhouette`;

  return {
    fitReport: reports,
    weightedDeviation,
    isTooTight,
    fitDescriptor,
  };
}

/**
 * Recommends optimal size and builds full per-area fit report (PRD B4 & B5)
 */
export function recommendSizeAndFit(
  user: UserMeasurementProfile,
  sizeChart: ProductSizeChart | null
): SizeRecommendationResult {
  // If product has no parseable size chart, return null without fabricating scores (PRD B3/B4)
  if (!sizeChart || !sizeChart.sizes || sizeChart.sizes.length === 0) {
    return {
      recommendedSize: null,
      alternatives: [],
      fitReport: null,
      fitDescriptor: "Standard catalog sizing",
      matchScore: 80,
      measuredFit: false,
      confidence: 0.5,
      humanReadableNotes: "Product has no detailed dimensional size chart available.",
    };
  }

  const hasMeasurements = Boolean(user.chestCm || user.bustChestCm || user.waistCm || user.hipsCm);

  // If user has no measurements, fall back to default middle size with measuredFit = false
  if (!hasMeasurements) {
    const defaultSize = sizeChart.sizes[Math.floor(sizeChart.sizes.length / 2)]?.label || "M";
    return {
      recommendedSize: defaultSize,
      alternatives: sizeChart.sizes.map((s) => s.label).filter((l) => l !== defaultSize),
      fitReport: null,
      fitDescriptor: `${user.fitPreference || "regular"} fit based on height`,
      matchScore: 82,
      measuredFit: false,
      confidence: 0.6,
      humanReadableNotes: "Add your chest and waist measurements in Profile to unlock centimeter-accurate size recommendations.",
    };
  }

  // Evaluate every available size
  const evaluated = sizeChart.sizes.map((sizeEntry) => {
    const evalResult = evaluateSizeFit(sizeEntry, user);
    return {
      label: sizeEntry.label,
      ...evalResult,
    };
  });

  // Filter out sizes that are tight beyond tolerance unless all are tight
  const validSizes = evaluated.filter((e) => !e.isTooTight);
  const candidates = validSizes.length > 0 ? validSizes : evaluated;

  // Sort ascending by weighted deviation from target ease
  candidates.sort((a, b) => a.weightedDeviation - b.weightedDeviation);

  const best = candidates[0];
  const alternatives = candidates.slice(1, 3).map((c) => c.label);

  // Convert deviation to 0 - 100% score (0 deviation = 99%, 8cm deviation = ~75%)
  const matchScore = Math.max(60, Math.min(99, Math.round(99 - best.weightedDeviation * 3.0)));

  // Generate clear human-readable fit note
  const notes = best.fitReport
    .map((r) => `${r.area.toUpperCase()}: ${r.easeCm >= 0 ? `+${r.easeCm}` : r.easeCm}cm ease (${r.label})`)
    .join(" · ");

  return {
    recommendedSize: best.label,
    alternatives,
    fitReport: best.fitReport,
    fitDescriptor: best.fitDescriptor,
    matchScore,
    measuredFit: true,
    confidence: 0.95,
    humanReadableNotes: `Size ${best.label} recommended based on your ${user.fitPreference || "regular"} fit preference: ${notes}.`,
  };
}

/**
 * Calculates overall personalized match score combining measurements, preference, vibe, and trending (B4)
 */
export function calculateMatchScore(
  user: UserMeasurementProfile,
  product: any
): {
  matchScore: number;
  fitNote: string;
  measuredFit: boolean;
  recommendedSize: string | null;
  fitDescriptor: string;
  fitReport: AreaFitReport[] | null;
  breakdown: Record<string, number>;
} {
  const sizeChart = product.sizeChart as ProductSizeChart | null;
  const sizeRec = recommendSizeAndFit(user, sizeChart);

  if (sizeRec.measuredFit) {
    // New B4 Weights: measurementFit 0.45, fitPreference 0.20, styleVibe 0.15, social 0.10, popularity 0.10
    const w = SCORING_CONFIG.weights;

    const measurementScore = sizeRec.matchScore; // 60 - 99
    const prefScore = 90;
    const styleScore = 85;
    const socialScore = 80;
    const popScore = Math.min(98, 75 + (product.rating ? product.rating * 4 : 10));

    const finalScore = Math.round(
      measurementScore * w.measurementFit +
      prefScore * w.fitPreference +
      styleScore * w.styleVibe +
      socialScore * w.social +
      popScore * w.popularity
    );

    return {
      matchScore: finalScore,
      fitNote: sizeRec.humanReadableNotes,
      measuredFit: true,
      recommendedSize: sizeRec.recommendedSize,
      fitDescriptor: sizeRec.fitDescriptor,
      fitReport: sizeRec.fitReport,
      breakdown: {
        measurementScore,
        preferenceScore: prefScore,
        styleScore,
        socialScore,
        popularityScore: popScore,
      },
    };
  }

  // Fallback heuristic when user has height/bodyType only (no measurements)
  const fw = SCORING_CONFIG.fallbackWeights;
  const userHeight = user.heightCm || 165;
  const audience = product.audience || "women";
  const refHeight =
    audience === "men"
      ? SCORING_CONFIG.referenceHeights.men
      : SCORING_CONFIG.referenceHeights.women;

  const delta = Math.abs(userHeight - refHeight);
  const heightScore = Math.max(60, 100 - delta * 2.5);

  const bType = (user.bodyType || "hourglass").toLowerCase();
  const affinities = SCORING_CONFIG.bodyTypeAffinity[bType] || SCORING_CONFIG.bodyTypeAffinity.hourglass;
  const productKey = (product.productType || product.category || "default").toLowerCase();
  const bodyTypeScore = (affinities[productKey] ?? affinities.default ?? 0.8) * 100;

  const prefScore = 85;
  const styleScore = 80;

  const fallbackFinal = Math.round(
    heightScore * fw.height +
    bodyTypeScore * fw.bodyType +
    prefScore * fw.fitPreference +
    styleScore * fw.styleVibe
  );

  return {
    matchScore: fallbackFinal,
    fitNote: `Silhouette aligns with your ${bType} frame. Add measurements in profile for exact size recommendations.`,
    measuredFit: false,
    recommendedSize: sizeRec.recommendedSize,
    fitDescriptor: sizeRec.fitDescriptor,
    fitReport: null,
    breakdown: {
      heightScore: Math.round(heightScore),
      bodyTypeScore: Math.round(bodyTypeScore),
      preferenceScore: prefScore,
      styleScore,
    },
  };
}

/**
 * Calculates trending velocity score with exponential time decay
 */
export function calculateTrendingVelocity(params: {
  viewsCount: number;
  likesCount: number;
  sharesCount: number;
  tryOnCount: number;
  createdAt: Date;
}): number {
  const { viewsCount, likesCount, sharesCount, tryOnCount, createdAt } = params;
  const w = SCORING_CONFIG.trendingWeights;

  const rawEngagement =
    viewsCount * w.view +
    likesCount * w.like +
    sharesCount * w.share +
    tryOnCount * w.tryOn;

  const ageHours = Math.max(0, (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60));
  const lambda = Math.LN2 / w.halfLifeHours;
  const decayFactor = Math.exp(-lambda * ageHours);

  return Math.round(rawEngagement * decayFactor * 10) / 10;
}

/**
 * Extracts model height in cm from product rawDetails (e.g. "The model (height 5'8) is wearing...")
 */
export function extractModelHeightCm(rawDetails: any): number {
  if (!rawDetails) return 170;
  const text = typeof rawDetails === "string" ? rawDetails : JSON.stringify(rawDetails);
  
  // Match feet and inches e.g. 5'8 or 5'8" or 5ft 8in
  const feetInchesMatch = text.match(/(\d+)'\s*(\d+)/i) || text.match(/(\d+)\s*ft\s*(\d+)/i);
  if (feetInchesMatch) {
    const feet = parseInt(feetInchesMatch[1], 10);
    const inches = parseInt(feetInchesMatch[2], 10);
    return Math.round((feet * 12 + inches) * 2.54);
  }

  // Match direct cm e.g. 173cm
  const cmMatch = text.match(/(\d{3})\s*cm/i);
  if (cmMatch) {
    return parseInt(cmMatch[1], 10);
  }

  return 170;
}

/**
 * Calculates height score comparing user height to reference/model height
 */
export function calculateHeightScore(userHeight: number, product: any): { score: number; note: string } {
  const modelHeight = extractModelHeightCm(product.rawDetails) || (product.audience === "men" ? 180 : 168);
  const delta = Math.abs(userHeight - modelHeight);
  const score = Math.max(0.4, Math.min(1.0, 1.0 - delta * 0.03));
  const note = delta <= 2 ? "Ideal length match" : delta <= 6 ? "Great length fit" : "May require slight hemming";
  return { score: Math.round(score * 100) / 100, note };
}

/**
 * Calculates body type compatibility score
 */
export function calculateBodyTypeScore(bodyType: string, productType: string, fit?: string): { score: number; note: string } {
  const bType = (bodyType || "hourglass").toLowerCase();
  const affinities = SCORING_CONFIG.bodyTypeAffinity[bType] || SCORING_CONFIG.bodyTypeAffinity.hourglass;
  const key = (productType || "default").toLowerCase();
  let score = affinities[key] ?? affinities.default ?? 0.85;

  if (fit && bType === "hourglass" && fit.toLowerCase().includes("fitted")) {
    score = Math.min(1.0, score + 0.1);
  }

  return {
    score: Math.round(score * 100) / 100,
    note: `Flattering cut for ${bType} silhouettes`,
  };
}

/**
 * Calculates fit preference compatibility score
 */
export function calculateFitPreferenceScore(userPref: string, garmentFit: string): { score: number; note: string } {
  const uPref = (userPref || "regular").toLowerCase();
  const gFit = (garmentFit || "regular").toLowerCase();

  if (uPref === gFit) {
    return { score: 1.0, note: `Exact match for your ${userPref} preference` };
  }

  const levels: Record<string, number> = { tight: 1, fitted: 2, slim: 2, regular: 3, relaxed: 4, oversized: 5 };
  const diff = Math.abs((levels[uPref] || 3) - (levels[gFit] || 3));

  const score = Math.max(0.2, 1.0 - diff * 0.3);
  return {
    score: Math.round(score * 100) / 100,
    note: diff <= 1 ? "Slightly different fit than preference" : "Significant fit difference",
  };
}

/**
 * Calculates style vibe compatibility score
 */
export function calculateStyleVibeScore(userVibe: string, productVibe?: string): { score: number; note: string } {
  const uVibe = (userVibe || "casual").toLowerCase();
  const pVibe = (productVibe || "casual").toLowerCase();
  const match = uVibe === pVibe;
  return {
    score: match ? 1.0 : 0.8,
    note: match ? `Matches your ${userVibe} aesthetic` : `Versatile styling for ${userVibe}`,
  };
}

