/**
 * Anthropometric Pose Measurement Estimator (Frontend Client)
 * Implements Ramanujan's first ellipse approximation formula and empirical
 * calibration factors documented in docs/measurement-calibration.md
 */

export const POSE_LANDMARKS = {
  NOSE: 0,
  LEFT_EYE_INNER: 1,
  LEFT_EYE: 2,
  LEFT_EYE_OUTER: 3,
  RIGHT_EYE_INNER: 4,
  RIGHT_EYE: 5,
  RIGHT_EYE_OUTER: 6,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  MOUTH_LEFT: 9,
  MOUTH_RIGHT: 10,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_PINKY: 17,
  RIGHT_PINKY: 18,
  LEFT_INDEX: 19,
  RIGHT_INDEX: 20,
  LEFT_THUMB: 21,
  RIGHT_THUMB: 22,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32,
};

export const CALIBRATION_FACTORS = {
  chest: 1.03,
  waist: 1.01,
  hips: 1.04,
  shoulder: 1.08,
  inseam: 0.98,
};

export const DEPTH_WIDTH_RATIOS = {
  chest: {
    men: 0.71,
    women: 0.76,
    default: 0.73,
  },
  waist: {
    hourglass: 0.63,
    athletic: 0.65,
    round: 0.79,
    rectangle: 0.66,
    default: 0.65,
  },
  hips: {
    men: 0.67,
    women: 0.71,
    default: 0.69,
  },
};

/**
 * Calculates perimeter of an ellipse using Ramanujan's First Approximation:
 * C ≈ π [3(a + b) - √((3a + b)(a + 3b))]
 */
export function calculateRamanujanPerimeter(semiMajorA, semiMinorB) {
  if (semiMajorA <= 0 || semiMinorB <= 0) return 0;
  const a = semiMajorA;
  const b = semiMinorB;
  const term1 = 3 * (a + b);
  const term2 = Math.sqrt((3 * a + b) * (a + 3 * b));
  return Math.PI * (term1 - term2);
}

export function euclideanDistance2D(p1, p2) {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function cmToInches(cm) {
  if (!cm) return '';
  return (Math.round((cm / 2.54) * 10) / 10).toString();
}

export function inchesToCm(inches) {
  if (!inches) return '';
  return Math.round(Number(inches) * 2.54 * 10) / 10;
}

/**
 * Estimates full body measurements from 33 Pose Landmarks + User Height
 */
export function estimateMeasurementsFromPose(landmarks, userHeightCm = 165, options = {}) {
  const gender = (options.gender || 'women').toLowerCase();
  const bodyType = (options.bodyType || 'hourglass').toLowerCase();

  if (!landmarks || landmarks.length < 29) {
    return estimateMeasurementsFromAnthropometry({
      heightCm: userHeightCm,
      gender,
      bodyType,
    });
  }

  const leftShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
  const rightShoulder = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
  const leftHip = landmarks[POSE_LANDMARKS.LEFT_HIP];
  const rightHip = landmarks[POSE_LANDMARKS.RIGHT_HIP];
  const leftAnkle = landmarks[POSE_LANDMARKS.LEFT_ANKLE];
  const rightAnkle = landmarks[POSE_LANDMARKS.RIGHT_ANKLE];
  const leftHeel = landmarks[POSE_LANDMARKS.LEFT_HEEL] || leftAnkle;
  const rightHeel = landmarks[POSE_LANDMARKS.RIGHT_HEEL] || rightAnkle;
  const nose = landmarks[POSE_LANDMARKS.NOSE];
  const leftEar = landmarks[POSE_LANDMARKS.LEFT_EAR] || nose;
  const rightEar = landmarks[POSE_LANDMARKS.RIGHT_EAR] || nose;

  const midEyeY = (leftEar.y + rightEar.y) / 2;
  const midShoulderY = (leftShoulder.y + rightShoulder.y) / 2;
  const headHeightNorm = Math.abs(midShoulderY - midEyeY) * 1.5;
  const vertexY = Math.min(nose.y, midEyeY) - headHeightNorm * 0.4;

  const lowestAnkleY = Math.max(leftAnkle.y, rightAnkle.y, leftHeel.y, rightHeel.y);
  const totalVerticalSpan = Math.abs(lowestAnkleY - vertexY);

  if (totalVerticalSpan <= 0.1) {
    return estimateMeasurementsFromAnthropometry({
      heightCm: userHeightCm,
      gender,
      bodyType,
    });
  }

  const scale = userHeightCm / totalVerticalSpan;

  // Shoulder Width
  const rawShoulderDist = euclideanDistance2D(leftShoulder, rightShoulder) * scale;
  const shoulderCm = Math.round(rawShoulderDist * CALIBRATION_FACTORS.shoulder * 10) / 10;

  // Inseam Length
  const midHip = {
    x: (leftHip.x + rightHip.x) / 2,
    y: (leftHip.y + rightHip.y) / 2 + 0.02,
  };
  const midAnkle = {
    x: (leftAnkle.x + rightAnkle.x) / 2,
    y: (leftAnkle.y + rightAnkle.y) / 2,
  };
  const rawInseamDist = euclideanDistance2D(midHip, midAnkle) * scale;
  const inseamCm = Math.round(rawInseamDist * CALIBRATION_FACTORS.inseam * 10) / 10;

  // Chest / Bust Circumference
  const chestWidthNorm = Math.abs(leftShoulder.x - rightShoulder.x) * 0.88;
  const chestMajorA = (chestWidthNorm * scale) / 2;
  const chestRatio =
    gender === 'men'
      ? DEPTH_WIDTH_RATIOS.chest.men
      : DEPTH_WIDTH_RATIOS.chest.women;
  const chestMinorB = chestMajorA * chestRatio;
  const rawChestCirc = calculateRamanujanPerimeter(chestMajorA, chestMinorB);
  const chestCm = Math.round(rawChestCirc * CALIBRATION_FACTORS.chest * 10) / 10;

  // Waist Circumference
  const hipWidthNorm = Math.abs(leftHip.x - rightHip.x);
  const waistWidthNorm = hipWidthNorm * 0.82;
  const waistMajorA = (waistWidthNorm * scale) / 2;
  const waistRatio =
    DEPTH_WIDTH_RATIOS.waist[bodyType] || DEPTH_WIDTH_RATIOS.waist.default;
  const waistMinorB = waistMajorA * waistRatio;
  const rawWaistCirc = calculateRamanujanPerimeter(waistMajorA, waistMinorB);
  const waistCm = Math.round(rawWaistCirc * CALIBRATION_FACTORS.waist * 10) / 10;

  // Hips Circumference
  const hipsMajorA = (hipWidthNorm * 1.05 * scale) / 2;
  const hipsRatio =
    gender === 'men'
      ? DEPTH_WIDTH_RATIOS.hips.men
      : DEPTH_WIDTH_RATIOS.hips.women;
  const hipsMinorB = hipsMajorA * hipsRatio;
  const rawHipsCirc = calculateRamanujanPerimeter(hipsMajorA, hipsMinorB);
  const hipsCm = Math.round(rawHipsCirc * CALIBRATION_FACTORS.hips * 10) / 10;

  return {
    heightCm: userHeightCm,
    chestCm,
    waistCm,
    hipsCm,
    shoulderCm,
    inseamCm,
    confidence: 0.94,
    method: 'POSE_RAMANUJAN',
    calibrated: true,
  };
}

export function estimateMeasurementsFromAnthropometry(params) {
  const { heightCm, gender = 'women', bodyType = 'hourglass' } = params;
  const isMale = gender.toLowerCase() === 'men';

  let chestCm, waistCm, hipsCm, shoulderCm, inseamCm;

  if (isMale) {
    chestCm = Math.round((heightCm * 0.55 + 2) * 10) / 10;
    waistCm = Math.round((heightCm * 0.46) * 10) / 10;
    hipsCm = Math.round((heightCm * 0.54) * 10) / 10;
    shoulderCm = Math.round((heightCm * 0.25) * 10) / 10;
    inseamCm = Math.round((heightCm * 0.46) * 10) / 10;
  } else {
    chestCm = Math.round((heightCm * 0.54) * 10) / 10;
    waistCm = Math.round((heightCm * 0.42) * 10) / 10;
    hipsCm = Math.round((heightCm * 0.58) * 10) / 10;
    shoulderCm = Math.round((heightCm * 0.23) * 10) / 10;
    inseamCm = Math.round((heightCm * 0.45) * 10) / 10;
  }

  if (bodyType === 'athletic') {
    chestCm = Math.round((chestCm + 3) * 10) / 10;
    waistCm = Math.round((waistCm - 2) * 10) / 10;
    shoulderCm = Math.round((shoulderCm + 2) * 10) / 10;
  } else if (bodyType === 'round') {
    waistCm = Math.round((waistCm + 8) * 10) / 10;
    chestCm = Math.round((chestCm + 4) * 10) / 10;
  } else if (bodyType === 'inverted_triangle') {
    shoulderCm = Math.round((shoulderCm + 3) * 10) / 10;
    chestCm = Math.round((chestCm + 4) * 10) / 10;
    hipsCm = Math.round((hipsCm - 3) * 10) / 10;
  }

  return {
    heightCm,
    chestCm,
    waistCm,
    hipsCm,
    shoulderCm,
    inseamCm,
    confidence: 0.75,
    method: 'ANTHROPOMETRIC_HEURISTIC',
    calibrated: true,
  };
}
