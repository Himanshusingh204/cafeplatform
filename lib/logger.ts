import "server-only";

import { getRequestId } from "@/lib/observability/context";
import { redact } from "@/lib/observability/redact";

type Level = "info" | "warn" | "error";

interface LogFields {
  route?: string;
  requestId?: string;
  userId?: string;
  result?: string;
  durationMs?: number;
  [key: string]: unknown;
}

export type LogInput = { event: string } & LogFields;

function write(level: Level, entry: LogInput) {
  const output = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    ...(redact(entry) as Record<string, unknown>),
    ...(entry.requestId || !getRequestId() ? {} : { requestId: getRequestId() }),
  });

  if (level === "error") {
    console.error(output);
  } else if (level === "warn") {
    console.warn(output);
  } else {
    console.log(output);
  }
}

export const logger = {
  info: (entry: LogInput) => write("info", entry),
  warn: (entry: LogInput) => write("warn", entry),
  error: (entry: LogInput) => write("error", entry),
};
