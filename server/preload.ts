/* eslint-disable @typescript-eslint/no-explicit-any */
import Module from "node:module";
import path from "node:path";
import dotenv from "dotenv";

// Load environment variables for standalone Node process
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

// Safely intercept 'server-only' module in standalone Node.js environment
const originalRequire = (Module.prototype as any).require;
(Module.prototype as any).require = function (id: string, ...args: any[]) {
  if (id === "server-only") {
    return {};
  }
  return originalRequire.apply(this, [id, ...args]);
};
