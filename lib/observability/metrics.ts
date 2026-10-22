/** Dependency-free in-process metrics (per instance) rendered as Prometheus text. */

type Labels = Record<string, string>;

const counters = new Map<string, { help: string; values: Map<string, number> }>();
const histograms = new Map<
  string,
  { help: string; buckets: number[]; series: Map<string, { counts: number[]; sum: number; count: number }> }
>();

const DURATION_BUCKETS_MS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000];

function labelKey(labels: Labels): string {
  return Object.keys(labels)
    .sort()
    .map((k) => `${k}="${String(labels[k]).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`)
    .join(",");
}

export function incCounter(name: string, help: string, labels: Labels = {}, by = 1): void {
  let c = counters.get(name);
  if (!c) counters.set(name, (c = { help, values: new Map() }));
  const k = labelKey(labels);
  c.values.set(k, (c.values.get(k) ?? 0) + by);
}

export function observeHistogram(
  name: string,
  help: string,
  value: number,
  labels: Labels = {},
  buckets: number[] = DURATION_BUCKETS_MS
): void {
  let h = histograms.get(name);
  if (!h) histograms.set(name, (h = { help, buckets, series: new Map() }));
  const k = labelKey(labels);
  let s = h.series.get(k);
  if (!s) h.series.set(k, (s = { counts: h.buckets.map(() => 0), sum: 0, count: 0 }));
  const series = s;
  h.buckets.forEach((b, i) => {
    if (value <= b) series.counts[i] += 1;
  });
  series.sum += value;
  series.count += 1;
}

export function statusClass(status: number): string {
  return `${Math.floor(status / 100)}xx`;
}

export function recordHttpRequest(route: string, status: number, durationMs: number): void {
  const labels = { route, status_class: statusClass(status) };
  incCounter("http_requests_total", "HTTP requests by route and status class", labels);
  observeHistogram("http_request_duration_ms", "HTTP request duration in milliseconds", durationMs, labels);
}

export function recordOrderCreated(): void {
  incCounter("orders_created_total", "Orders created");
}
export function recordOrderFailed(): void {
  incCounter("orders_failed_total", "Order creation failures");
}
export function recordOutboxProcessed(n = 1): void {
  if (n > 0) incCounter("outbox_processed_total", "Outbox events completed", {}, n);
}
export function recordOutboxDead(n = 1): void {
  if (n > 0) incCounter("outbox_dead_total", "Outbox events moved to DEAD", {}, n);
}

export interface Gauge {
  name: string;
  help: string;
  value: number;
}

export function renderPrometheus(gauges: Gauge[] = []): string {
  const lines: string[] = [];
  const wrap = (k: string) => (k ? `{${k}}` : "");
  for (const [name, c] of counters) {
    lines.push(`# HELP ${name} ${c.help}`, `# TYPE ${name} counter`);
    for (const [k, v] of c.values) lines.push(`${name}${wrap(k)} ${v}`);
  }
  for (const [name, h] of histograms) {
    lines.push(`# HELP ${name} ${h.help}`, `# TYPE ${name} histogram`);
    for (const [k, s] of h.series) {
      const sep = k ? `${k},` : "";
      h.buckets.forEach((b, i) => lines.push(`${name}_bucket{${sep}le="${b}"} ${s.counts[i]}`));
      lines.push(`${name}_bucket{${sep}le="+Inf"} ${s.count}`);
      lines.push(`${name}_sum${wrap(k)} ${s.sum}`, `${name}_count${wrap(k)} ${s.count}`);
    }
  }
  for (const g of gauges) {
    lines.push(`# HELP ${g.name} ${g.help}`, `# TYPE ${g.name} gauge`, `${g.name} ${g.value}`);
  }
  return lines.join("\n") + "\n";
}

export function resetMetrics(): void {
  counters.clear();
  histograms.clear();
}
