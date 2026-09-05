import { describe, it, expect, afterEach } from "vitest";
import { JobQueue } from "@/lib/queue/job-queue";

describe("JobQueue (Unit)", () => {
  let queue: JobQueue;

  afterEach(async () => {
    if (queue) {
      await queue.drain();
      queue.clear();
    }
  });

  it("registers handler and processes enqueued job", async () => {
    queue = new JobQueue(20); // 20ms poll tick for fast tests

    let processedPayload: { to: string } | null = null;
    queue.registerHandler("TEST_EMAIL", async (payload: unknown) => {
      processedPayload = payload as { to: string };
    });

    queue.enqueue("TEST_EMAIL", { to: "guest@example.com" });

    await new Promise<void>((resolve) => {
      queue.on("completed", (job) => {
        if (job.type === "TEST_EMAIL") resolve();
      });
    });

    expect(processedPayload).toEqual({ to: "guest@example.com" });
    const metrics = queue.getMetrics();
    expect(metrics.completed).toBe(1);
    expect(metrics.failed).toBe(0);
  });

  it("routes job to DLQ when maxRetries are exceeded", async () => {
    queue = new JobQueue(20);

    let attempts = 0;
    queue.registerHandler("FAILING_JOB", async () => {
      attempts += 1;
      throw new Error("Temporary network failure");
    });

    // maxRetries: 1
    queue.enqueue("FAILING_JOB", { test: true }, { maxRetries: 1 });

    await new Promise<void>((resolve) => {
      queue.on("dlq", (job) => {
        if (job.type === "FAILING_JOB") resolve();
      });
    });

    expect(attempts).toBeGreaterThanOrEqual(2); // Initial + 1 retry
    const dlq = queue.getDeadLetterQueue();
    expect(dlq.length).toBe(1);
    expect(dlq[0].lastError).toContain("Temporary network failure");
    expect(dlq[0].status).toBe("DLQ");
  });

  it("allows retrying a dead-letter job", async () => {
    queue = new JobQueue(20);

    let succeedOnSecondTime = false;
    queue.registerHandler("HEALABLE_JOB", async () => {
      if (!succeedOnSecondTime) {
        throw new Error("First attempt failure");
      }
    });

    const jobId = queue.enqueue("HEALABLE_JOB", { id: 1 }, { maxRetries: 0 });

    await new Promise<void>((resolve) => {
      queue.on("dlq", () => resolve());
    });

    expect(queue.getMetrics().dlq).toBe(1);

    // Fix condition and retry from DLQ
    succeedOnSecondTime = true;
    const retried = queue.retryFromDlq(jobId);
    expect(retried).toBe(true);

    await new Promise<void>((resolve) => {
      queue.on("completed", (job) => {
        if (job.id === jobId) resolve();
      });
    });

    expect(queue.getMetrics().completed).toBe(1);
  });
});
