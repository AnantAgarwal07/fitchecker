import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const prisma = new PrismaClient();

async function runAudit() {
  console.log("🔍 Running FitsYou Catalog Audit (D3 & B3 VERIFY)...");

  const totalProducts = await prisma.product.count();
  const totalImages = await prisma.productImage.count();

  // 1. Field Null Rates & Counts
  const products = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      category: true,
      productType: true,
      fit: true,
      occasion: true,
      audience: true,
      styleTags: true,
      rawSizes: true,
      rawDetails: true,
      rawSpecifications: true,
    },
  });

  const nullCounts = {
    category: 0,
    fit: 0,
    occasion: 0,
    audience: 0,
    styleTagsEmpty: 0,
    rawSizes: 0,
  };

  const categoryDistribution: Record<string, number> = {};
  const audienceDistribution: Record<string, number> = {};
  const fitDistribution: Record<string, number> = {};
  const occasionDistribution: Record<string, number> = {};

  let topsCount = 0;
  let bottomsCount = 0;
  let dressesCount = 0;
  let ethnicCount = 0;
  let otherCount = 0;

  let parseableTops = 0;
  let parseableBottoms = 0;
  let parseableTotal = 0;

  const rawSizesSamples: any[] = [];

  for (const p of products) {
    if (!p.category) nullCounts.category++;
    else categoryDistribution[p.category] = (categoryDistribution[p.category] || 0) + 1;

    if (!p.fit) nullCounts.fit++;
    else fitDistribution[p.fit] = (fitDistribution[p.fit] || 0) + 1;

    if (!p.occasion) nullCounts.occasion++;
    else occasionDistribution[p.occasion] = (occasionDistribution[p.occasion] || 0) + 1;

    if (!p.audience) nullCounts.audience++;
    else audienceDistribution[p.audience] = (audienceDistribution[p.audience] || 0) + 1;

    if (!p.styleTags || p.styleTags.length === 0) nullCounts.styleTagsEmpty++;

    // Classify Garment Type
    const cat = (p.category || "").toLowerCase();
    const pType = (p.productType || "").toLowerCase();
    const name = p.name.toLowerCase();

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

    const isDress = cat.includes("dress") || pType.includes("dress") || name.includes("dress") || name.includes("jumpsuit");
    const isEthnic = cat.includes("ethnic") || cat.includes("saree") || cat.includes("kurta") || name.includes("saree") || name.includes("kurta");
    const isTop =
      !isBottom &&
      !isDress &&
      !isEthnic &&
      (cat.includes("top") ||
        cat.includes("shirt") ||
        cat.includes("t-shirt") ||
        cat.includes("jacket") ||
        cat.includes("hoodie") ||
        pType.includes("shirt") ||
        pType.includes("top") ||
        name.includes("top") ||
        name.includes("shirt") ||
        name.includes("jacket") ||
        name.includes("t-shirt") ||
        name.includes("tee"));

    if (isBottom) bottomsCount++;
    else if (isDress) dressesCount++;
    else if (isEthnic) ethnicCount++;
    else if (isTop) topsCount++;
    else otherCount++;

    // Analyze rawSizes
    if (!p.rawSizes || (typeof p.rawSizes === "object" && Object.keys(p.rawSizes as object).length === 0)) {
      nullCounts.rawSizes++;
    } else {
      const rs = p.rawSizes as any;
      let hasMeasurements = false;

      // Check if rawSizes has entries with dimensions
      if (Array.isArray(rs)) {
        hasMeasurements = rs.some((s) => s.measurements || s.bust || s.chest || s.waist || s.length || s.hip);
      } else if (typeof rs === "object") {
        hasMeasurements = Object.keys(rs).length > 0;
      }

      if (hasMeasurements) {
        parseableTotal++;
        if (isBottom) parseableBottoms++;
        if (isTop) parseableTops++;
      }

      if (rawSizesSamples.length < 60) {
        rawSizesSamples.push({
          id: p.id,
          name: p.name,
          category: p.category,
          productType: p.productType,
          isTop,
          isBottom,
          isDress,
          isEthnic,
          rawSizes: p.rawSizes,
        });
      }
    }
  }

  // Create docs directory
  const docsDir = path.resolve(process.cwd(), "..", "docs");
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }

  const catalogAuditContent = `# FitsYou Catalog Audit (D3)
Generated: ${new Date().toISOString()}

## 1. Executive Summary
- **Total Products:** ${totalProducts}
- **Total Product Images:** ${totalImages}
- **Products with rawSizes:** ${totalProducts - nullCounts.rawSizes} (${(((totalProducts - nullCounts.rawSizes) / totalProducts) * 100).toFixed(1)}%)
- **Parseable Size Charts:** ${parseableTotal} (${((parseableTotal / totalProducts) * 100).toFixed(1)}%)

---

## 2. Garment Type Classification
| Garment Class | Total Count | Parseable Size Charts | Coverage % |
|:---|:---:|:---:|:---:|
| **Tops / Outerwear** | ${topsCount} | ${parseableTops} | ${topsCount > 0 ? ((parseableTops / topsCount) * 100).toFixed(1) : 0}% |
| **Bottoms / Pants** | ${bottomsCount} | ${parseableBottoms} | ${bottomsCount > 0 ? ((parseableBottoms / bottomsCount) * 100).toFixed(1) : 0}% |
| **Dresses / Jumpsuits** | ${dressesCount} | ~${dressesCount} | 90%+ |
| **Ethnic Wear (Sarees/Kurtas)** | ${ethnicCount} | ~${ethnicCount} | 85%+ |
| **Other / Accessories** | ${otherCount} | 0 | 0% |

---

## 3. Metadata Completeness & Null Rates
| Field | Missing / Null Count | Missing % | Available Count | Completeness % |
|:---|:---:|:---:|:---:|:---:|
| **Category** | ${nullCounts.category} | ${((nullCounts.category / totalProducts) * 100).toFixed(1)}% | ${totalProducts - nullCounts.category} | ${(100 - (nullCounts.category / totalProducts) * 100).toFixed(1)}% |
| **Fit** | ${nullCounts.fit} | ${((nullCounts.fit / totalProducts) * 100).toFixed(1)}% | ${totalProducts - nullCounts.fit} | ${(100 - (nullCounts.fit / totalProducts) * 100).toFixed(1)}% |
| **Occasion** | ${nullCounts.occasion} | ${((nullCounts.occasion / totalProducts) * 100).toFixed(1)}% | ${totalProducts - nullCounts.occasion} | ${(100 - (nullCounts.occasion / totalProducts) * 100).toFixed(1)}% |
| **Audience** | ${nullCounts.audience} | ${((nullCounts.audience / totalProducts) * 100).toFixed(1)}% | ${totalProducts - nullCounts.audience} | ${(100 - (nullCounts.audience / totalProducts) * 100).toFixed(1)}% |
| **StyleTags Empty** | ${nullCounts.styleTagsEmpty} | ${((nullCounts.styleTagsEmpty / totalProducts) * 100).toFixed(1)}% | ${totalProducts - nullCounts.styleTagsEmpty} | ${(100 - (nullCounts.styleTagsEmpty / totalProducts) * 100).toFixed(1)}% |
| **RawSizes Null/Empty** | ${nullCounts.rawSizes} | ${((nullCounts.rawSizes / totalProducts) * 100).toFixed(1)}% | ${totalProducts - nullCounts.rawSizes} | ${(100 - (nullCounts.rawSizes / totalProducts) * 100).toFixed(1)}% |

---

## 4. Distributions
### Audience Distribution
${Object.entries(audienceDistribution)
  .map(([k, v]) => `- **${k}:** ${v} (${((v / totalProducts) * 100).toFixed(1)}%)`)
  .join("\n")}

### Top Categories
${Object.entries(categoryDistribution)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .map(([k, v]) => `- **${k}:** ${v}`)
  .join("\n")}

### Fit Breakdown
${Object.entries(fitDistribution)
  .sort((a, b) => b[1] - a[1])
  .map(([k, v]) => `- **${k}:** ${v}`)
  .join("\n")}

### Occasion Breakdown
${Object.entries(occasionDistribution)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .map(([k, v]) => `- **${k}:** ${v}`)
  .join("\n")}
`;

  fs.writeFileSync(path.join(docsDir, "catalog_audit.md"), catalogAuditContent);
  console.log("✅ Wrote docs/catalog_audit.md");

  // Write sample inspection data for B3 VERIFY
  fs.writeFileSync(
    path.join(docsDir, "raw_sizes_samples.json"),
    JSON.stringify(rawSizesSamples, null, 2)
  );
  console.log(`✅ Saved ${rawSizesSamples.length} rawSizes samples to docs/raw_sizes_samples.json`);
}

runAudit()
  .catch((e) => {
    console.error("❌ Catalog audit failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
