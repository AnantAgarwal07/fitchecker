import { BodyLandmarks } from "./bodyMap.js";

export interface PromptBuilderInput {
  userName?: string;
  userHeightCm: number;
  bodyMap: BodyLandmarks;
  product: {
    id: number | string;
    name: string;
    brand: string;
    category?: string | null;
    productType?: string | null;
    color?: string | null;
    material?: string | null;
    fit?: string | null;
    sleeveLength?: string | null;
    description?: string | null;
  };
  sizeSelected: string;
  fitDescriptor?: string;
}

/**
 * Builds the strict multimodal try-on prompt (A1 Prompt Rules)
 */
export function buildTryOnPrompt(input: PromptBuilderInput): string {
  const { userHeightCm, bodyMap, product, sizeSelected, fitDescriptor } = input;
  const p = bodyMap.proportions;

  const defaultFitDesc = fitDescriptor || `${product.fit || "regular"} fit on ${userHeightCm}cm frame, natural drape`;

  return [
    `Virtual Try-On Task: Realistic Fashion Dressing`,
    `---`,
    `CRITICAL INSTRUCTIONS FOR VIRTUAL TRY-ON:`,
    `1. IDENTITY & POSE PRESERVATION: Keep the person's exact face, facial features, skin tone, hair, head shape, body shape, natural proportions, posture, limb positions, and background environment completely unchanged (${userHeightCm} cm).`,
    `2. NO ALTERATION: Absolutely NO beautification, slimming, body reshaping, muscle enhancement, or skin smoothing. Retain authentic body anatomy.`,
    `3. TARGET CLOTHING REPLACEMENT: Remove only the designated clothing item from the user's photo and dress them seamlessly in the reference garment (${product.brand} - ${product.name}).`,
    `4. ACCURATE GARMENT DETAILS: Match the reference garment's exact color (${product.color || "as reference"}), fabric texture (${product.material || "textile"}), pattern, neckline, seams, logos, and sleeve length (${product.sleeveLength || "standard"}).`,
    `5. ANTHROPOMETRIC FIT & DRAPING: Apply the physical fit: "${defaultFitDesc}". Shoulders aligned with ${p.shoulderWidthCm}cm width, chest aligned with ${p.bustChestCm}cm, waist aligned with ${p.waistCm}cm. Selected garment size is ${sizeSelected}.`,
    `6. PHOTOREALISTIC OUTPUT: Render one single photorealistic image maintaining the exact perspective, aspect ratio, contact shadows, and natural ambient lighting of the original photo.`,
  ].join("\n");
}
