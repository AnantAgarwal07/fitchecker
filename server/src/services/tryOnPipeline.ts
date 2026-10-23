import { GoogleGenAI } from "@google/genai";
import { prisma } from "../db.js";
import { deriveBodyMap } from "./bodyMap.js";
import { buildTryOnPrompt } from "./tryOnPromptBuilder.js";
import { calculateMatchScore } from "./scoring.js";
import { uploadImage, getSignedReadUrl } from "./storage.js";

export interface StartTryOnInput {
  userId: string;
  productId: number;
  userPhotoUrl?: string;
  userPhotoId?: string;
  userHeightCm: number;
  sizeSelected: string;
}

export interface TryOnError {
  code: "QUOTA_EXCEEDED" | "CONFIGURATION_ERROR" | "SAFETY_BLOCKED" | "GENERATION_FAILED" | "TIMEOUT";
  message: string;
}

const DEFAULT_MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
const DAILY_LIMIT = Number(process.env.TRYON_DAILY_LIMIT) || (process.env.NODE_ENV === "test" ? 100 : 10);



/**
 * Initiates try-on session with quota, cache, and mode checks (A1 & A4)
 */
export async function startTryOnSession(input: StartTryOnInput) {
  const tryOnMode = process.env.TRYON_MODE || (process.env.NODE_ENV === "production" ? "live" : "demo");

  // 1. Production Mode Guard: Fails loudly if live mode lacks API key
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (tryOnMode === "live" && (!apiKey || apiKey.trim().length === 0)) {
    const error: TryOnError = {
      code: "CONFIGURATION_ERROR",
      message: "FATAL: GEMINI_API_KEY is not configured for live try-on mode. Server will not fall back to demo silently.",
    };
    throw error;
  }

  // 2. Per-User 24h Quota Check (A4)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const dailyCount = await prisma.tryOnSession.count({
    where: {
      userId: input.userId,
      createdAt: { gte: oneDayAgo },
    },
  });

  if (dailyCount >= DAILY_LIMIT) {
    const error: TryOnError = {
      code: "QUOTA_EXCEEDED",
      message: `Daily virtual try-on limit reached (${DAILY_LIMIT} per 24 hours). Please try again tomorrow.`,
    };
    throw error;
  }

  // 3. Cache Check (A4)
  if (input.userPhotoId) {
    const cachedSession = await prisma.tryOnSession.findFirst({
      where: {
        userPhotoId: input.userPhotoId,
        productId: input.productId,
        sizeSelected: input.sizeSelected,
        model: DEFAULT_MODEL,
        status: "COMPLETED",
      },
    });

    if (cachedSession) {
      return {
        jobId: `cached-${cachedSession.id}`,
        tryOnSessionId: cachedSession.id,
        status: "COMPLETED",
        renderedImageUrl: cachedSession.renderedImageUrl,
        fitScore: cachedSession.fitScore,
        fitNote: cachedSession.fitNote,
        mode: cachedSession.mode,
        cached: true,
      };
    }
  }

  const tryOnSessionId = `tryon-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const jobId = `job-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  // 4. Create TryOnSession record in DB
  await prisma.tryOnSession.create({
    data: {
      id: tryOnSessionId,
      userId: input.userId,
      productId: input.productId,
      userPhotoId: input.userPhotoId || null,
      inputPhotoUrl: input.userPhotoUrl || null,
      sizeSelected: input.sizeSelected,
      status: "PENDING",
      visibility: "PRIVATE",
      mode: tryOnMode,
      model: DEFAULT_MODEL,
      isSaved: true,
      isPrivate: true,
    },
  });

  // 5. Create RenderJob record in DB for worker claiming
  await prisma.renderJob.create({
    data: {
      id: jobId,
      tryOnSessionId,
      type: "TRYON",
      modelName: DEFAULT_MODEL,
      status: "QUEUED",
      maxAttempts: 3,
      attempts: 0,
      nextRunAt: new Date(),
    },
  });

  // Trigger immediate async execution in development
  setImmediate(() => {
    executeTryOnJob(jobId).catch((err) => {
      console.error(`Async execution error for Job #${jobId}:`, err);
    });
  });

  return {
    jobId,
    tryOnSessionId,
    status: "QUEUED",
    mode: tryOnMode,
  };
}

/**
 * Executes a single try-on render job with multimodal Gemini or photorealistic demo generator
 */
export async function executeTryOnJob(jobId: string, workerId = "direct-runner") {
  const job = await prisma.renderJob.findUnique({
    where: { id: jobId },
    include: {
      tryOnSession: {
        include: {
          user: { include: { bodyProfile: true } },
          product: {
            include: {
              ProductImage: {
                orderBy: { position: "asc" },
                take: 2,
              },
            },
          },
          userPhoto: true,
        },
      },
    },
  });

  if (!job || job.status === "COMPLETED") return;

  const session = job.tryOnSession;
  const product = session.product;
  const user = session.user;
  const startTime = Date.now();

  // Mark job PROCESSING
  await prisma.renderJob.update({
    where: { id: jobId },
    data: {
      status: "PROCESSING",
      lockedAt: new Date(),
      lockedBy: workerId,
      startedAt: new Date(),
      attempts: { increment: 1 },
    },
  });

  await prisma.tryOnSession.update({
    where: { id: session.id },
    data: { status: "PROCESSING" },
  });

  try {
    const userHeight = user?.bodyProfile?.heightCm || 165;

    // 1. Derive 2D bodyMap
    const bodyMap = deriveBodyMap({
      heightCm: userHeight,
      gender: user?.bodyProfile?.gender || (product.audience === "men" ? "men" : "women"),
      bodyType: user?.bodyProfile?.bodyType || "hourglass",
      photoUrl: session.inputPhotoUrl || user?.bodyProfile?.fullBodyPhotoUrl || "",
      bustChestCm: user?.bodyProfile?.bustChestCm || user?.bodyProfile?.chestCm,
      waistCm: user?.bodyProfile?.waistCm,
      hipsCm: user?.bodyProfile?.hipsCm,
    });

    // 2. Ease-based match scoring (Phase B4 & B5)
    const matchResult = calculateMatchScore(
      {
        heightCm: userHeight,
        gender: user?.bodyProfile?.gender,
        bodyType: user?.bodyProfile?.bodyType,
        fitPreference: user?.bodyProfile?.fitPreference,
        styleVibe: user?.bodyProfile?.styleVibe,
        chestCm: user?.bodyProfile?.chestCm || user?.bodyProfile?.bustChestCm,
        bustChestCm: user?.bodyProfile?.bustChestCm || user?.bodyProfile?.chestCm,
        waistCm: user?.bodyProfile?.waistCm,
        hipsCm: user?.bodyProfile?.hipsCm,
        shoulderCm: user?.bodyProfile?.shoulderCm,
        inseamCm: user?.bodyProfile?.inseamCm,
      },
      product
    );

    // 3. Build strict fit descriptor and prompt (Phase A1 & B5)
    const fitDescriptor = matchResult.fitDescriptor || `${product.fit || "Regular"} fit on ${userHeight}cm height, natural drape at waistline.`;

    const prompt = buildTryOnPrompt({
      userName: user.name,
      userHeightCm: userHeight,
      bodyMap,
      product: {
        id: product.id,
        name: product.name,
        brand: product.brand || "Fashion Brand",
        category: product.category,
        productType: product.productType,
        color: product.color,
        material: product.material,
        fit: product.fit,
        sleeveLength: product.sleeveLength,
      },
      sizeSelected: session.sizeSelected || "M",
      fitDescriptor,
    });

    let renderedImageUrl = "";
    let finalModel = session.model || DEFAULT_MODEL;

    // 4. Generation Pipeline
    if (session.mode === "live") {
      const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
      if (!apiKey) {
        throw new Error("Missing GEMINI_API_KEY for live try-on mode");
      }

      const ai = new GoogleGenAI({ apiKey });

      // Call Gemini multimodal image generation with 60s timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000);

      try {
        const response: any = await ai.models.generateContent({
          model: finalModel,
          contents: [
            {
              role: "user",
              parts: [
                { text: prompt },
                // User Photo input part
                session.inputPhotoUrl
                  ? { text: `[Reference User Photo: ${session.inputPhotoUrl}]` }
                  : { text: `[Reference User Model: ${userHeight}cm ${user?.bodyProfile?.bodyType || "standard"}]` },
                // Garment Image input part
                product.ProductImage[0]?.imageUrl
                  ? { text: `[Reference Garment Image: ${product.ProductImage[0].imageUrl}]` }
                  : { text: `[Garment: ${product.name}]` },
              ],
            },
          ],
        });

        clearTimeout(timeout);

        // Check for safety blocks
        const finishReason = response.candidates?.[0]?.finishReason;
        if (finishReason === "SAFETY" || finishReason === "BLOCKLIST") {
          throw new Error("SAFETY_BLOCKED: Prompt or imagery blocked by safety filters.");
        }

        // Check for generated image output
        const parts = response.candidates?.[0]?.content?.parts || [];
        const imagePart = parts.find((p: any) => p.inlineData?.mimeType?.startsWith("image/"));

        if (imagePart && imagePart.inlineData?.data) {
          const buffer = Buffer.from(imagePart.inlineData.data, "base64");
          const storageKey = `renders/tryon-${session.id}.jpg`;
          const uploadRes = await uploadImage(buffer, storageKey, "image/jpeg");
          renderedImageUrl = uploadRes.url;
        } else {
          throw new Error("EMPTY_RESPONSE: Gemini returned text without an image part.");
        }
      } catch (geminiErr: any) {
        clearTimeout(timeout);
        if (geminiErr.name === "AbortError") {
          throw new Error("TIMEOUT: Gemini image generation exceeded 60s limit.");
        }
        throw geminiErr;
      }
    } else {
      // High-Fidelity Demo Generation (FLUX AI / Styled Photorealistic Render)
      finalModel = "flux-photorealistic-demo";
      const demoPrompt = `Full-body high fashion editorial photograph of a stylish 24-year-old Indian woman (${userHeight}cm, ${user?.bodyProfile?.bodyType || "hourglass"} figure) wearing a ${product.color || "stylish"} ${product.brand || "designer"} ${product.name}, professionally styled with matching bottomwear and accessories, studio lighting, photorealistic 8k, sharp focus`;

      try {
        const fluxUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(demoPrompt)}?width=768&height=1024&nologo=true&model=flux`;
        const res = await fetch(fluxUrl, { signal: AbortSignal.timeout(15000) });
        if (res.ok) {
          const arrayBuf = await res.arrayBuffer();
          const storageKey = `renders/demo-${session.id}.jpg`;
          const uploadRes = await uploadImage(Buffer.from(arrayBuf), storageKey, "image/jpeg");
          renderedImageUrl = uploadRes.url;
        } else {
          renderedImageUrl = "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&auto=format&fit=crop&q=80";
        }
      } catch (demoErr) {
        renderedImageUrl = "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&auto=format&fit=crop&q=80";
      }
    }

    const durationMs = Date.now() - startTime;

    // 5. Persist completed state atomically in PostgreSQL
    await prisma.$transaction(async (tx) => {
      await tx.tryOnSession.update({
        where: { id: session.id },
        data: {
          status: "COMPLETED",
          renderedImageUrl,
          fitScore: matchResult.matchScore,
          fitNote: matchResult.fitNote,
          fitDescriptor,
          fitReport: matchResult.fitReport as any,
          mode: session.mode,
          model: finalModel,
          metadata: {
            bodyMap,
            breakdown: matchResult.breakdown,
            durationMs,
          } as any,
        },
      });

      await tx.renderJob.update({
        where: { id: jobId },
        data: {
          status: "COMPLETED",
          modelName: finalModel,
          promptUsed: prompt,
          completedAt: new Date(),
          durationMs,
        },
      });
    });

    console.log(`✅ [TryOn Pipeline] Completed Job #${jobId} for Session #${session.id} (${session.mode} mode) in ${durationMs}ms`);
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    console.error(`❌ [TryOn Pipeline] Failed Job #${jobId}:`, err.message);

    const isSafety = err.message.includes("SAFETY_BLOCKED");
    const isRateLimit = err.message.includes("429") || err.message.includes("RESOURCE_EXHAUSTED");
    const errorReason = isSafety ? "SAFETY_BLOCKED" : isRateLimit ? "QUOTA_EXCEEDED" : err.message;

    // Calculate retry delay with exponential backoff for 429/5xx
    const canRetry = job.attempts < job.maxAttempts && !isSafety;
    const nextRunAt = canRetry ? new Date(Date.now() + Math.pow(2, job.attempts) * 5000) : null;

    await prisma.renderJob.update({
      where: { id: jobId },
      data: {
        status: canRetry ? "QUEUED" : "FAILED",
        lastError: err.message,
        nextRunAt,
        durationMs,
      },
    });

    if (!canRetry) {
      await prisma.tryOnSession.update({
        where: { id: session.id },
        data: {
          status: "FAILED",
          errorReason,
        },
      });
    }
  }
}
