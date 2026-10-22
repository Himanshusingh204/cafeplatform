const SENSITIVE_KEY =
  /^(authorization|cookie|set-cookie|password|passwd|secret|token|accesstoken|refreshtoken|apikey|api_key|x-api-key|email|phone|mobile)$/i;

export const REDACTED = "[REDACTED]";

/** Deep-copy `value`, replacing values of sensitive keys. Cycle- and depth-safe. */
export function redact(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (value === null || typeof value !== "object") return value;
  if (depth > 6 || seen.has(value)) return "[Truncated]";
  seen.add(value);
  if (value instanceof Error) return { name: value.name, message: value.message };
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1, seen));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SENSITIVE_KEY.test(k) ? REDACTED : redact(v, depth + 1, seen);
  }
  return out;
}
