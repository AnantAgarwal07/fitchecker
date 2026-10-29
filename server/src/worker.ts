import "dotenv/config";
import { prisma } from "./db.js";
import { executeTryOnJob, claimJob } from "./services/tryOnPipeline.js";

const WORKER_ID = `worker-${process.pid}-${Math.random().toString(36).substring(2, 6)}`;
const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY) || 3;
const MAX_RPM = Number(process.env.GEMINI_MAX_RPM) || 15;
const MIN_POLL_MS = 2000;
const MAX_POLL_MS = 30000;

let isRunning = true;
let currentPollMs = MIN_POLL_MS;
let activeJobsCount = 0;

/**
 * Reaps orphaned jobs stuck in PROCESSING for more than 5 minutes (A4)
 */
async function reapStuckJobs() {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

  const stuckJobs = await prisma.renderJob.findMany({
    where: {
      status: "PROCESSING",
      lockedAt: { lt: fiveMinutesAgo },
    },
  });

  for (const job of stuckJobs) {
    console.warn(`⚠️ [Worker ${WORKER_ID}] Reaping stuck job #${job.id} (locked by ${job.lockedBy})...`);
    await prisma.renderJob.update({
      where: { id: job.id },
      data: {
        status: job.attempts < job.maxAttempts ? "QUEUED" : "FAILED",
        lockedAt: null,
        lockedBy: null,
        lastError: "Reaped after timeout in PROCESSING state (>5 min)",
      },
    });
  }
}

/**
 * Claims a single job atomically using claimJob (A4 & Phase 2)
 */
async function claimNextJob(): Promise<string | null> {
  const queuedJob = await prisma.renderJob.findFirst({
    where: {
      status: "QUEUED",
      OR: [{ nextRunAt: null }, { nextRunAt: { lte: new Date() } }],
    },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  if (!queuedJob) return null;

  const claimed = await claimJob(queuedJob.id, WORKER_ID);
  return claimed ? queuedJob.id : null;
}

/**
 * Main worker processing loop with idle backoff and concurrency limits
 */
async function runWorker() {
  console.log(`🚀 [FitsYou Worker ${WORKER_ID}] Started. Max Concurrency: ${CONCURRENCY}, Rate Cap: ${MAX_RPM} RPM`);

  let lastReapTime = 0;

  while (isRunning) {
    try {
      // 1. Run reaper every 60 seconds
      if (Date.now() - lastReapTime > 60000) {
        await reapStuckJobs();
        lastReapTime = Date.now();
      }

      // 2. Claim jobs if under concurrency cap
      while (activeJobsCount < CONCURRENCY && isRunning) {
        const jobId = await claimNextJob();
        if (!jobId) {
          // No jobs available; back off polling to allow Neon compute scale-to-zero
          currentPollMs = Math.min(currentPollMs * 1.5, MAX_POLL_MS);
          break;
        }

        // Job found; reset poll delay to rapid mode
        currentPollMs = MIN_POLL_MS;
        activeJobsCount++;

        // Process job asynchronously without blocking loop
        executeTryOnJob(jobId, WORKER_ID, true)
          .catch((err) => {
            console.error(`[Worker ${WORKER_ID}] Error processing job #${jobId}:`, err);
          })
          .finally(() => {
            activeJobsCount = Math.max(0, activeJobsCount - 1);
          });
      }
    } catch (err: any) {
      console.error(`[Worker ${WORKER_ID}] Polling loop exception:`, err.message);
    }

    // Sleep before next poll
    await new Promise((resolve) => setTimeout(resolve, currentPollMs));
  }

  console.log(`🛑 [FitsYou Worker ${WORKER_ID}] Stopped.`);
  await prisma.$disconnect();
}

// Graceful shutdown handling
["SIGINT", "SIGTERM"].forEach((signal) => {
  process.on(signal, () => {
    console.log(`\nReceived ${signal}, waiting for active tasks to finish...`);
    isRunning = false;
  });
});

runWorker();
