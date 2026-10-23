export interface ParsedSizeEntry {
  label: string;
  chestCm?: number;
  waistCm?: number;
  hipsCm?: number;
  shoulderCm?: number;
  lengthCm?: number;
  inseamCm?: number;
  type: "top" | "bottom" | "dress" | "other";
}

export interface ProductSizeChart {
  garmentType: "top" | "bottom" | "dress" | "other";
  unit: "cm";
  sizes: ParsedSizeEntry[];
}

const INCH_TO_CM = 2.54;

/**
 * Extracts numeric value in cm from string like "38.0in", "38.0 in", "96cm", "38"
 */
export function parseDimensionToCm(valStr: string | number | undefined | null): number | undefined {
  if (valStr === undefined || valStr === null) return undefined;
  if (typeof valStr === "number") return Math.round(valStr * INCH_TO_CM * 10) / 10;

  const s = String(valStr).trim().toLowerCase();
  const match = s.match(/([0-9]+(?:\.[0-9]+)?)/);
  if (!match) return undefined;

  const num = parseFloat(match[1]);
  if (isNaN(num) || num <= 0) return undefined;

  // If already in cm
  if (s.includes("cm")) {
    return Math.round(num * 10) / 10;
  }

  // Default is inches in Myntra catalog
  return Math.round(num * INCH_TO_CM * 10) / 10;
}

/**
 * Classifies garment type from category, productType, and name
 */
export function classifyGarmentType(product: {
  category?: string | null;
  productType?: string | null;
  name?: string | null;
}): "top" | "bottom" | "dress" | "other" {
  const cat = (product.category || "").toLowerCase();
  const pType = (product.productType || "").toLowerCase();
  const name = (product.name || "").toLowerCase();

  const isBottom =
    cat.includes("bottom") ||
    cat.includes("trouser") ||
    cat.includes("jeans") ||
    cat.includes("pant") ||
    cat.includes("skirt") ||
    cat.includes("shorts") ||
    cat.includes("palazzo") ||
    pType.includes("trouser") ||
    pType.includes("jeans") ||
    pType.includes("pant") ||
    name.includes("jeans") ||
    name.includes("trousers") ||
    name.includes("palazzos") ||
    name.includes("pants");

  if (isBottom) return "bottom";

  const isDress =
    cat.includes("dress") ||
    pType.includes("dress") ||
    name.includes("dress") ||
    name.includes("jumpsuit");

  if (isDress) return "dress";

  const isTop =
    cat.includes("top") ||
    cat.includes("shirt") ||
    cat.includes("t-shirt") ||
    cat.includes("jacket") ||
    cat.includes("hoodie") ||
    cat.includes("sweater") ||
    cat.includes("blouse") ||
    pType.includes("shirt") ||
    pType.includes("top") ||
    pType.includes("jacket") ||
    name.includes("top") ||
    name.includes("shirt") ||
    name.includes("jacket") ||
    name.includes("t-shirt") ||
    name.includes("tee");

  if (isTop) return "top";

  return "other";
}

/**
 * Normalizes rawSizes into structured ProductSizeChart in centimeters (B3)
 * Returns null if rawSizes contains no measurable dimensions.
 */
export function parseSizeChart(
  rawSizes: any,
  productInfo: { category?: string | null; productType?: string | null; name?: string | null } = {}
): ProductSizeChart | null {
  if (!rawSizes || !Array.isArray(rawSizes) || rawSizes.length === 0) {
    return null;
  }

  const garmentType = classifyGarmentType(productInfo);

  // Group raw entries by size label
  const sizeMap: Record<string, Partial<ParsedSizeEntry>> = {};

  for (const item of rawSizes) {
    if (!item || typeof item !== "object") continue;

    const sizeLabel = String(item.size || item.name || "").trim();
    if (!sizeLabel || sizeLabel.toLowerCase() === "onesize" && !item.value) {
      continue;
    }

    if (!sizeMap[sizeLabel]) {
      sizeMap[sizeLabel] = {
        label: sizeLabel,
        type: garmentType,
      };
    }

    const valueName = String(item.value_name || item.name || "").trim().toLowerCase();
    const cmValue = parseDimensionToCm(item.value);

    if (cmValue === undefined) continue;

    if (valueName.includes("chest") || valueName.includes("bust")) {
      sizeMap[sizeLabel].chestCm = cmValue;
    } else if (valueName.includes("waist")) {
      sizeMap[sizeLabel].waistCm = cmValue;
    } else if (valueName.includes("hip")) {
      sizeMap[sizeLabel].hipsCm = cmValue;
    } else if (valueName.includes("shoulder")) {
      sizeMap[sizeLabel].shoulderCm = cmValue;
    } else if (valueName.includes("front length") || valueName.includes("garment length") || valueName === "length") {
      sizeMap[sizeLabel].lengthCm = cmValue;
    } else if (valueName.includes("inseam")) {
      sizeMap[sizeLabel].inseamCm = cmValue;
    }
  }

  // Convert map to list and filter out sizes with zero measurements
  const sizes: ParsedSizeEntry[] = [];
  for (const entry of Object.values(sizeMap)) {
    const hasAnyMeasurement =
      entry.chestCm !== undefined ||
      entry.waistCm !== undefined ||
      entry.hipsCm !== undefined ||
      entry.shoulderCm !== undefined ||
      entry.lengthCm !== undefined ||
      entry.inseamCm !== undefined;

    if (hasAnyMeasurement) {
      sizes.push(entry as ParsedSizeEntry);
    }
  }

  if (sizes.length === 0) {
    return null;
  }

  return {
    garmentType,
    unit: "cm",
    sizes,
  };
}
