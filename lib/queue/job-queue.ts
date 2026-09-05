import { EventEmitter } from "node:events";

export interface Job<T = unknown> {
  id: string;
  type: string;
  payload: T;
  attempts: number;
  maxRetries: number;
  createdAt: string;
  scheduledFor: number;
  lastError?: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "DLQ";
}

export type JobHandler<T = unknown> = (payload: T, job: Job<T>) => Promise<void>;

export interface QueueMetrics {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  dlq: number;
}

export class JobQueue extends EventEmitter {
  private queue: Job[] = [];
  private handlers = new Map<string, JobHandler<unknown>>();
  private dlq: Job[] = [];
  private completedCount = 0;
  private failedCount = 0;
  private isProcessing = false;
  private timer: NodeJS.Timeout | null = null;

  constructor(private intervalMs: number = 200) {
    super();
    this.startWorker();
  }

  /**
   * Register an asynchronous job handler for a given job type.
   */
  registerHandler<T>(type: string, handler: JobHandler<T>): void {
    this.handlers.set(type, handler as JobHandler<unknown>);
  }

  /**
   * Enqueue a new background job.
   */
  enqueue<T>(
    type: string,
    payload: T,
    options: { maxRetries?: number; delayMs?: number; priority?: boolean } = {}
  ): string {
    const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const now = Date.now();
    const delay = options.delayMs || 0;

    const job: Job<T> = {
      id,
      type,
      payload,
      attempts: 0,
      maxRetries: options.maxRetries ?? 3,
      createdAt: new Date().toISOString(),
      scheduledFor: now + delay,
      status: "PENDING",
    };

    if (options.priority) {
      this.queue.unshift(job as Job);
    } else {
      this.queue.push(job as Job);
    }

    this.emit("enqueued", job);
    return id;
  }

  /**
   * Start the worker processing loop.
   */
  private startWorker() {
    this.timer = setInterval(() => {
      this.processNext().catch((err) => {
        console.error("[JobQueue] Unhandled processing loop error:", err);
      });
    }, this.intervalMs);
  }

  /**
   * Process eligible jobs in the queue.
   */
  private async processNext() {
    if (this.isProcessing || this.queue.length === 0) return;

    const now = Date.now();
    const eligibleIndex = this.queue.findIndex((j) => j.status === "PENDING" && j.scheduledFor <= now);
    if (eligibleIndex === -1) return;

    const job = this.queue.splice(eligibleIndex, 1)[0];
    const handler = this.handlers.get(job.type);

    if (!handler) {
      job.status = "FAILED";
      job.lastError = `No registered handler for job type '${job.type}'`;
      this.dlq.push(job);
      this.emit("dlq", job);
      return;
    }

    this.isProcessing = true;
    job.status = "PROCESSING";
    job.attempts += 1;

    try {
      await handler(job.payload, job);
      job.status = "COMPLETED";
      this.completedCount += 1;
      this.emit("completed", job);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      job.lastError = errorMsg;

      if (job.attempts <= job.maxRetries) {
        // Exponential backoff: 2^attempt * 500ms
        const backoffMs = Math.pow(2, job.attempts) * 500;
        job.status = "PENDING";
        job.scheduledFor = Date.now() + backoffMs;
        this.queue.push(job);
        this.emit("retry", job, backoffMs);
      } else {
        job.status = "DLQ";
        this.failedCount += 1;
        this.dlq.push(job);
        this.emit("dlq", job);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Retrieve current operational metrics.
   */
  getMetrics(): QueueMetrics {
    return {
      pending: this.queue.filter((j) => j.status === "PENDING").length,
      processing: this.isProcessing ? 1 : 0,
      completed: this.completedCount,
      failed: this.failedCount,
      dlq: this.dlq.length,
    };
  }

  /**
   * Retrieve jobs stored in the Dead Letter Queue.
   */
  getDeadLetterQueue(): readonly Job[] {
    return [...this.dlq];
  }

  /**
   * Retry a specific job from the Dead Letter Queue.
   */
  retryFromDlq(jobId: string): boolean {
    const idx = this.dlq.findIndex((j) => j.id === jobId);
    if (idx === -1) return false;

    const job = this.dlq.splice(idx, 1)[0];
    job.status = "PENDING";
    job.attempts = 0;
    job.scheduledFor = Date.now();
    this.queue.push(job);
    return true;
  }

  /**
   * Graceful shutdown: stop polling and wait for in-flight job to finish.
   */
  async drain(timeoutMs: number = 3000): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    const start = Date.now();
    while (this.isProcessing && Date.now() - start < timeoutMs) {
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  /**
   * Clear state for tests.
   */
  clear(): void {
    this.queue = [];
    this.dlq = [];
    this.completedCount = 0;
    this.failedCount = 0;
  }
}

export const globalJobQueue = new JobQueue();
