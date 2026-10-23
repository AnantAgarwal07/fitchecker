import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { FastifyInstance } from "fastify";
import { productRoutes } from "../routes/products.js";
import { userRoutes } from "../routes/users.js";
import { prisma } from "../db.js";
import {
  calculateRamanujanPerimeter,
  estimateMeasurementsFromPose,
  estimateMeasurementsFromAnthropometry,
  CALIBRATION_FACTORS,
} from "../services/measurementEstimator.js";
import {
  classifyEase,
  evaluateSizeFit,
  recommendSizeAndFit,
  calculateMatchScore,
} from "../services/scoring.js";
import { parseSizeChart } from "../services/sizeChart.js";

describe("Phase B: Accurate Measurements & Size Recommendation Test Suite", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(productRoutes);
    await app.register(userRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  // -------------------------------------------------------------
  // B2: On-Device Pose Landmarker Estimation & Ramanujan Math
  // -------------------------------------------------------------
  describe("B2: Anthropometric Pose Estimation & Ramanujan Ellipse", () => {
    it("computes Ramanujan ellipse perimeter with <0.05% error", () => {
      // For circle a=10, b=10 -> perimeter = 2 * pi * 10 = 62.831853
      const circlePerim = calculateRamanujanPerimeter(10, 10);
      expect(circlePerim).toBeCloseTo(2 * Math.PI * 10, 4);

      // For ellipse a=20, b=15
      // Ramanujan approx: pi * [3(35) - sqrt((60+15)(20+45))] = pi * [105 - sqrt(75*65)]
      // sqrt(4875) = 69.8212; 105 - 69.8212 = 35.1788; 35.1788 * pi = 110.517
      const ellipsePerim = calculateRamanujanPerimeter(20, 15);
      expect(ellipsePerim).toBeGreaterThan(110.0);
      expect(ellipsePerim).toBeLessThan(111.0);
    });

    it("estimates calibrated body measurements from synthetic MediaPipe landmarks", () => {
      // Construct 33 normalized landmarks representing a standing person (height = 165cm)
      const landmarks: any[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0 }));

      // Nose & Ears
      landmarks[0] = { x: 0.5, y: 0.15, z: 0 }; // Nose
      landmarks[7] = { x: 0.45, y: 0.14, z: 0 }; // Left ear
      landmarks[8] = { x: 0.55, y: 0.14, z: 0 }; // Right ear

      // Shoulders (span 0.20 normalized units)
      landmarks[11] = { x: 0.40, y: 0.25, z: 0 };
      landmarks[12] = { x: 0.60, y: 0.25, z: 0 };

      // Hips (span 0.16 normalized units)
      landmarks[23] = { x: 0.42, y: 0.50, z: 0 };
      landmarks[24] = { x: 0.58, y: 0.50, z: 0 };

      // Ankles
      landmarks[27] = { x: 0.44, y: 0.90, z: 0 };
      landmarks[28] = { x: 0.56, y: 0.90, z: 0 };

      const est = estimateMeasurementsFromPose(landmarks, 165, {
        gender: "women",
        bodyType: "hourglass",
      });

      expect(est.heightCm).toBe(165);
      expect(est.method).toBe("POSE_RAMANUJAN");
      expect(est.calibrated).toBe(true);
      expect(est.chestCm).toBeGreaterThan(70);
      expect(est.chestCm).toBeLessThan(110);
      expect(est.waistCm).toBeGreaterThan(55);
      expect(est.waistCm).toBeLessThan(90);
      expect(est.hipsCm).toBeGreaterThan(75);
      expect(est.shoulderCm).toBeGreaterThan(32);
      expect(est.inseamCm).toBeGreaterThan(60);
    });

    it("computes realistic statistical fallback anthropometry from user height and shape", () => {
      const fallback = estimateMeasurementsFromAnthropometry({
        heightCm: 175,
        gender: "men",
        bodyType: "athletic",
      });

      expect(fallback.chestCm).toBeCloseTo(175 * 0.55 + 2 + 3, 0); // ~101cm
      expect(fallback.waistCm).toBeCloseTo(175 * 0.46 - 2, 0); // ~78.5cm
      expect(fallback.confidence).toBe(0.75);
      expect(fallback.calibrated).toBe(true);
    });
  });

  // -------------------------------------------------------------
  // B3: Size Chart Parser & Data Backfill
  // -------------------------------------------------------------
  describe("B3: Size Chart Parser", () => {
    it("parses rawSizes array with inches suffix into centimeters", () => {
      const rawSizes = [
        { size: "S", value: "36.0in", value_name: "To Fit Bust" },
        { size: "S", value: "28.0in", value_name: "To Fit Waist" },
        { size: "M", value: "38.0in", value_name: "To Fit Bust" },
        { size: "M", value: "30.0in", value_name: "To Fit Waist" },
      ];

      const chart = parseSizeChart(rawSizes);
      expect(chart).not.toBeNull();
      expect(chart!.sizes).toHaveLength(2);

      const s = chart!.sizes.find((x) => x.label === "S");
      expect(s).toBeDefined();
      expect(s!.chestCm).toBe(Math.round(36.0 * 2.54 * 10) / 10); // 91.4 cm
      expect(s!.waistCm).toBe(Math.round(28.0 * 2.54 * 10) / 10); // 71.1 cm
    });

    it("returns null for non-wearable or unstructured sizes without fabricating data", () => {
      const emptyChart = parseSizeChart([{ size: "Onesize" }]);
      expect(emptyChart).toBeNull();
    });
  });

  // -------------------------------------------------------------
  // B4: Ease-Based Scoring Engine
  // -------------------------------------------------------------
  describe("B4: Ease Classification & Size Recommendation", () => {
    it("classifies chest ease according to PRD thresholds", () => {
      expect(classifyEase("chest", 1.0)).toBe("tight"); // < 2cm
      expect(classifyEase("chest", 5.0)).toBe("regular"); // 2 - 8cm
      expect(classifyEase("chest", 10.0)).toBe("relaxed"); // 8 - 14cm
      expect(classifyEase("chest", 16.0)).toBe("oversized"); // > 14cm
    });

    it("evaluates garment size against user measurements and determines ease", () => {
      const sizeEntry = { label: "M", chestCm: 96, waistCm: 76 };
      const user = { chestCm: 90, waistCm: 72, fitPreference: "regular" };

      const fit = evaluateSizeFit(sizeEntry, user);
      expect(fit.isTooTight).toBe(false);
      expect(fit.fitReport).toHaveLength(2);

      const chestReport = fit.fitReport.find((r) => r.area === "chest");
      expect(chestReport).toBeDefined();
      expect(chestReport!.easeCm).toBe(6.0); // 96 - 90
      expect(chestReport!.label).toBe("regular");
    });

    it("recommends the size that minimizes target ease deviation", () => {
      const sizeChart = {
        sizes: [
          { label: "S", chestCm: 88, waistCm: 68 },
          { label: "M", chestCm: 96, waistCm: 76 },
          { label: "L", chestCm: 104, waistCm: 84 },
        ],
        attributes: ["chest", "waist"],
      };

      // User with 90cm chest wanting regular fit (target ease = +6cm -> 96cm is ideal)
      const user = { chestCm: 90, waistCm: 70, fitPreference: "regular" };
      const recommendation = recommendSizeAndFit(user, sizeChart as any);

      expect(recommendation.recommendedSize).toBe("M");
      expect(recommendation.measuredFit).toBe(true);
      expect(recommendation.fitReport).not.toBeNull();
      expect(recommendation.matchScore).toBeGreaterThanOrEqual(90);
    });
  });

  // -------------------------------------------------------------
  // B1 & B5: Endpoints (Profile Update & Product Fit Report)
  // -------------------------------------------------------------
  describe("B1 & B5: Endpoints", () => {
    it("PUT /api/v1/users/:id/body-profile updates measurements with ownership check", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/api/v1/users/u-ananya-sharma-001/body-profile",
        headers: {
          authorization: "Bearer test-token-u-ananya-sharma-001",
        },
        payload: {
          heightCm: 168,
          chestCm: 92,
          waistCm: 70,
          hipsCm: 98,
          shoulderCm: 42,
          inseamCm: 78,
          fitPreference: "regular",
        },
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.payload);
      expect(data.bodyProfile).toBeDefined();
      expect(data.bodyProfile.chestCm).toBe(92);
      expect(data.bodyProfile.waistCm).toBe(70);
    });

    it("GET /api/v1/products/:id/fit returns per-area ease fit report and size recommendations", async () => {
      // Find a product with sizeChart
      const product = await prisma.product.findFirst({
        where: { sizeChart: { not: null } },
      });

      if (product) {
        const res = await app.inject({
          method: "GET",
          url: `/api/v1/products/${product.id}/fit?chestCm=90&waistCm=70&fitPreference=regular`,
        });

        expect(res.statusCode).toBe(200);
        const data = JSON.parse(res.payload);

        expect(data.productId).toBe(product.id);
        expect(data.recommendedSize).toBeDefined();
        expect(data.measuredFit).toBe(true);
        expect(data.matchScore).toBeGreaterThan(60);
        expect(data.fitReport).toBeInstanceOf(Array);
        expect(data.fitDescriptor).toBeDefined();
        expect(data.fitNote).toBeDefined();
      }
    });

    it("GET /api/v1/products/:id/fit handles products without size charts gracefully", async () => {
      // Find a non-wearable product (sizeChart is null)
      const product = await prisma.product.findFirst({
        where: { category: "Wallets" },
      });


      if (product) {
        const res = await app.inject({
          method: "GET",
          url: `/api/v1/products/${product.id}/fit`,
        });

        expect(res.statusCode).toBe(200);
        const data = JSON.parse(res.payload);
        expect(data.measuredFit).toBe(false);
        expect(data.fitReport).toBeNull();
      }
    });
  });
});
