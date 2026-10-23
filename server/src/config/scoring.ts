/**
 * Configuration and weights for FitsYou recommendation, ease-based sizing, and trending heuristics.
 * Kept in a single centralized config for pure testability and tuning (PRD B4).
 */

export interface ScoringWeights {
  measurementFit: number;
  fitPreference: number;
  styleVibe: number;
  social: number;
  popularity: number;
}

export interface TrendingWeights {
  like: number;
  share: number;
  tryOn: number;
  view: number;
  halfLifeHours: number;
}

export interface EaseThresholds {
  tightMax: number;
  regularMax: number;
  relaxedMax: number;
}

export const SCORING_CONFIG = {
  // New PRD B4 Default Weights (sum = 1.0)
  weights: {
    measurementFit: 0.45,
    fitPreference: 0.20,
    styleVibe: 0.15,
    social: 0.10,
    popularity: 0.10,
  } as ScoringWeights,

  // Fallback Weights for users with height only (no body measurements)
  fallbackWeights: {
    height: 0.40,
    bodyType: 0.25,
    fitPreference: 0.20,
    styleVibe: 0.15,
  },

  // Per-area Ease Thresholds in centimeters:
  // ease = garment_measurement - body_measurement
  easeThresholds: {
    chest: {
      tightMax: 2.0,     // < 2 cm = tight
      regularMax: 8.0,   // 2 to 8 cm = regular
      relaxedMax: 14.0,  // 8 to 14 cm = relaxed
      // > 14 cm = oversized
    } as EaseThresholds,

    waist: {
      tightMax: 1.0,     // < 1 cm = tight
      regularMax: 6.0,   // 1 to 6 cm = regular
      relaxedMax: 12.0,  // 6 to 12 cm = relaxed
      // > 12 cm = oversized
    } as EaseThresholds,

    hips: {
      tightMax: 2.0,     // < 2 cm = tight
      regularMax: 8.0,   // 2 to 8 cm = regular
      relaxedMax: 14.0,  // 8 to 14 cm = relaxed
      // > 14 cm = oversized
    } as EaseThresholds,

    shoulder: {
      tightMax: -0.5,
      regularMax: 2.0,
      relaxedMax: 5.0,
    } as EaseThresholds,
  },

  // Target ease (cm) by user fit preference
  targetEase: {
    chest: {
      tight: 1.0,
      fitted: 3.0,
      slim: 3.0,
      regular: 6.0,
      relaxed: 11.0,
      oversized: 16.0,
    } as Record<string, number>,

    waist: {
      tight: 0.5,
      fitted: 2.0,
      slim: 2.0,
      regular: 4.0,
      relaxed: 8.0,
      oversized: 14.0,
    } as Record<string, number>,

    hips: {
      tight: 1.0,
      fitted: 3.0,
      slim: 3.0,
      regular: 5.0,
      relaxed: 10.0,
      oversized: 15.0,
    } as Record<string, number>,
  },

  // Maximum allowed negative ease before a size is marked "not recommended"
  tightToleranceCm: -1.0,

  // Trending Velocity Score Weights
  trendingWeights: {
    view: 0.1,
    like: 1.5,
    share: 3.0,
    tryOn: 4.5,
    halfLifeHours: 24, // exponential time decay half-life
  } as TrendingWeights,

  // Default baseline heights if not extracted from product model
  referenceHeights: {
    women: 168, // ~5'6"
    men: 178,   // ~5'10"
    unisex: 173,
  },

  // Measurement correction calibration factors (B2)
  measureCorrection: {
    chest: 1.02,
    waist: 0.98,
    hips: 1.01,
    shoulder: 1.0,
    inseam: 1.0,
  },

  // Body type silhouette affinity matrix (0.0 to 1.0 compatibility) - for cold start fallback
  bodyTypeAffinity: {
    hourglass: {
      "crop top": 0.95,
      "wrap top": 0.95,
      "fit and flare dress": 0.95,
      "peplum top": 0.90,
      "saree": 0.95,
      "fitted": 0.95,
      "slim fit": 0.90,
      "palazzos": 0.85,
      "default": 0.80,
    },
    athletic: {
      "casual shirt": 0.95,
      "t-shirt": 0.90,
      "oversized": 0.85,
      "slim fit": 0.95,
      "kurta": 0.90,
      "regular": 0.85,
      "default": 0.80,
    },
    rectangle: {
      "peplum top": 0.90,
      "fit and flare dress": 0.90,
      "palazzos": 0.90,
      "oversized": 0.85,
      "relaxed": 0.85,
      "default": 0.80,
    },
    inverted_triangle: {
      "palazzos": 0.95,
      "fit and flare dress": 0.90,
      "relaxed": 0.90,
      "regular": 0.85,
      "default": 0.80,
    },
    round: {
      "relaxed": 0.95,
      "oversized": 0.90,
      "kurta": 0.95,
      "palazzos": 0.90,
      "default": 0.80,
    },
  } as Record<string, Record<string, number>>,
};
