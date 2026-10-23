export type JobStatus = "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";

export interface TryOnJobData {
  jobId: string;
  tryOnSessionId: string;
  userId: string;
  productId: number;
  userPhotoUrl: string;
  userHeightCm: number;
  sizeSelected: string;
  status: JobStatus;
  progressPercent: number;
  promptUsed?: string;
  renderedImageUrl?: string;
  fitScore?: number;
  fitNote?: string;
  errorMessage?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  durationMs?: number;
}

class TryOnJobQueue {
  private jobs: Map<string, TryOnJobData> = new Map();

  createJob(data: Omit<TryOnJobData, "status" | "progressPercent" | "createdAt">): TryOnJobData {
    const job: TryOnJobData = {
      ...data,
      status: "QUEUED",
      progressPercent: 0,
      createdAt: new Date(),
    };
    this.jobs.set(job.jobId, job);
    return job;
  }

  getJob(jobId: string): TryOnJobData | undefined {
    return this.jobs.get(jobId);
  }

  updateJob(jobId: string, updates: Partial<TryOnJobData>): TryOnJobData | undefined {
    const job = this.jobs.get(jobId);
    if (!job) return undefined;

    const updated = { ...job, ...updates };
    this.jobs.set(jobId, updated);
    return updated;
  }

  listRecentJobs(userId?: string): TryOnJobData[] {
    const all = Array.from(this.jobs.values());
    if (userId) {
      return all.filter((j) => j.userId === userId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    return all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}

export const jobQueue = new TryOnJobQueue();
