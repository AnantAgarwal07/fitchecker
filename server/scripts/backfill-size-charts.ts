import { PrismaClient } from "@prisma/client";
import { parseSizeChart } from "../src/services/sizeChart.js";

const prisma = new PrismaClient();

async function backfillSizeCharts() {
  console.log("📏 Starting high-speed parallel size charts backfill (PRD B3)...");

  const products = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      category: true,
      productType: true,
      rawSizes: true,
      sizeChart: true,
    },
  });

  console.log(`🔍 Processing ${products.length} products in concurrent batches...`);

  let updatedCount = 0;
  let skippedNullCount = 0;
  let alreadyUpToDateCount = 0;

  const BATCH_SIZE = 25;

  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (product) => {
        const chart = parseSizeChart(product.rawSizes, {
          category: product.category,
          productType: product.productType,
          name: product.name,
        });

        if (!chart) {
          if (product.sizeChart !== null) {
            await prisma.product.update({
              where: { id: product.id },
              data: { sizeChart: null as any },
            });
          }
          skippedNullCount++;
          return;
        }

        const currentJson = JSON.stringify(product.sizeChart);
        const newJson = JSON.stringify(chart);

        if (currentJson === newJson) {
          alreadyUpToDateCount++;
          return;
        }

        await prisma.product.update({
          where: { id: product.id },
          data: { sizeChart: chart as any },
        });

        updatedCount++;
      })
    );

    if ((i + BATCH_SIZE) % 100 === 0 || i + BATCH_SIZE >= products.length) {
      console.log(`Progress: ${Math.min(i + BATCH_SIZE, products.length)} / ${products.length} products processed`);
    }
  }

  console.log(`✅ Backfill complete!
  - Updated with normalized sizeChart: ${updatedCount}
  - Already up-to-date: ${alreadyUpToDateCount}
  - Skipped (unparseable or accessories): ${skippedNullCount}`);
}

backfillSizeCharts()
  .catch((e) => {
    console.error("❌ Size chart backfill failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
