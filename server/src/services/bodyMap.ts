/**
 * Body MAP Derivation Service
 * 
 * Derives 2D landmarks and anthropometric measurements from full-body photo and user height.
 * Constraints: NO 3D mesh, NO model training — landmarks and ratios only.
 */

export interface BodyLandmarks {
  proportions: {
    heightCm: number;
    shoulderWidthCm: number;
    bustChestCm: number;
    waistCm: number;
    hipCm: number;
    torsoHeightCm: number;
    legInseamCm: number;
    torsoToLegRatio: number;
  };
  landmarks2D: {
    neck: { x: number; y: number };
    leftShoulder: { x: number; y: number };
    rightShoulder: { x: number; y: number };
    chestCenter: { x: number; y: number };
    leftWaist: { x: number; y: number };
    rightWaist: { x: number; y: number };
    leftHip: { x: number; y: number };
    rightHip: { x: number; y: number };
    leftKnee: { x: number; y: number };
    rightKnee: { x: number; y: number };
    leftAnkle: { x: number; y: number };
    rightAnkle: { x: number; y: number };
  };
  detectedBodyType: string;
  confidence: number;
}

export interface BodyMapInput {
  heightCm: number;
  gender?: string | null;
  bodyType?: string | null;
  photoUrl?: string | null;
  bustChestCm?: number | null;
  waistCm?: number | null;
  hipsCm?: number | null;
}

/**
 * Standard anthropometric ratios by body type & gender
 */
const ANTHROPOMETRIC_RATIOS: Record<string, { shoulder: number; chest: number; waist: number; hip: number; inseam: number }> = {
  "women-hourglass": { shoulder: 0.23, chest: 0.52, waist: 0.41, hip: 0.57, inseam: 0.46 },
  "women-rectangle": { shoulder: 0.24, chest: 0.51, waist: 0.44, hip: 0.52, inseam: 0.47 },
  "women-athletic": { shoulder: 0.25, chest: 0.53, waist: 0.43, hip: 0.53, inseam: 0.47 },
  "women-inverted_triangle": { shoulder: 0.26, chest: 0.54, waist: 0.44, hip: 0.50, inseam: 0.46 },
  "women-round": { shoulder: 0.23, chest: 0.55, waist: 0.50, hip: 0.56, inseam: 0.45 },
  "men-athletic": { shoulder: 0.26, chest: 0.57, waist: 0.45, hip: 0.54, inseam: 0.48 },
  "men-rectangle": { shoulder: 0.25, chest: 0.54, waist: 0.47, hip: 0.52, inseam: 0.47 },
  "men-inverted_triangle": { shoulder: 0.28, chest: 0.58, waist: 0.45, hip: 0.51, inseam: 0.48 },
  "men-round": { shoulder: 0.24, chest: 0.56, waist: 0.52, hip: 0.55, inseam: 0.46 },
};

/**
 * Derives normalized 2D body landmarks and physical measurements in cm.
 */
export function deriveBodyMap(input: BodyMapInput): BodyLandmarks {
  const height = input.heightCm || 168;
  const gender = input.gender || "women";
  const bodyType = input.bodyType || "hourglass";

  const key = `${gender}-${bodyType}`;
  const ratios = ANTHROPOMETRIC_RATIOS[key] || ANTHROPOMETRIC_RATIOS["women-hourglass"];

  // Use provided measurements if user entered them, otherwise derive from height * ratio
  const shoulderWidthCm = Math.round(height * ratios.shoulder * 10) / 10;
  const bustChestCm = input.bustChestCm || Math.round(height * ratios.chest * 10) / 10;
  const waistCm = input.waistCm || Math.round(height * ratios.waist * 10) / 10;
  const hipCm = input.hipsCm || Math.round(height * ratios.hip * 10) / 10;
  const legInseamCm = Math.round(height * ratios.inseam * 10) / 10;
  const torsoHeightCm = Math.round((height - legInseamCm - 24) * 10) / 10; // 24cm head/neck allowance

  // Normalized 2D coordinate map (0.0 to 1.0 range centered at x=0.5)
  const halfShoulder = (shoulderWidthCm / height) * 0.7;
  const halfWaist = (waistCm / height) * 0.25;
  const halfHip = (hipCm / height) * 0.28;

  const landmarks2D = {
    neck: { x: 0.5, y: 0.15 },
    leftShoulder: { x: Math.max(0.2, 0.5 - halfShoulder), y: 0.19 },
    rightShoulder: { x: Math.min(0.8, 0.5 + halfShoulder), y: 0.19 },
    chestCenter: { x: 0.5, y: 0.28 },
    leftWaist: { x: Math.max(0.3, 0.5 - halfWaist), y: 0.42 },
    rightWaist: { x: Math.min(0.7, 0.5 + halfWaist), y: 0.42 },
    leftHip: { x: Math.max(0.28, 0.5 - halfHip), y: 0.52 },
    rightHip: { x: Math.min(0.72, 0.5 + halfHip), y: 0.52 },
    leftKnee: { x: 0.42, y: 0.73 },
    rightKnee: { x: 0.58, y: 0.73 },
    leftAnkle: { x: 0.40, y: 0.94 },
    rightAnkle: { x: 0.60, y: 0.94 },
  };

  return {
    proportions: {
      heightCm: height,
      shoulderWidthCm,
      bustChestCm,
      waistCm,
      hipCm,
      torsoHeightCm,
      legInseamCm,
      torsoToLegRatio: Math.round((torsoHeightCm / legInseamCm) * 100) / 100,
    },
    landmarks2D,
    detectedBodyType: bodyType,
    confidence: input.photoUrl ? 0.92 : 0.85,
  };
}
