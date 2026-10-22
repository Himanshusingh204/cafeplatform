import "./preload";

// Process entry for the self-hosted Express API. The app itself lives in
// ./app so tests can import it without binding a port.
async function main() {
  const { assertValidEnv } = await import("@/lib/config/env");
  assertValidEnv();
  const { app, PORT, CLIENT_URL } = await import("./app");
  const { logger } = await import("@/lib/logger");

  const server = app.listen(PORT, () => {
    logger.info({
      event: "backend.started",
      message: `Standalone Spice & Saffron Backend API active on http://localhost:${PORT}`,
      allowedOrigin: CLIENT_URL,
    });
  });

  process.on("SIGTERM", () => {
    server.close(() => process.exit(0));
  });
}

void main();
