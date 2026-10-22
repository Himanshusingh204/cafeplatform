export async function register() {
  // Node runtime only: the edge runtime has no process-wide env contract to enforce.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertValidEnv } = await import("@/lib/config/env");
    assertValidEnv();
  }
}
