#!/usr/bin/env node

/**
 * Production Deployment Smoke & Health Verification Suite
 *
 * Usage:
 *   node scripts/verify-deployment.mjs https://your-domain.com
 *   or:
 *   APP_URL=https://your-domain.com npm run verify:prod
 */

import "dotenv/config";

const targetUrl = (process.argv[2] || process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");

console.log(`\n======================================================`);
console.log(`🚀 Verifying Deployment Target: ${targetUrl}`);
console.log(`======================================================\n`);

let passed = 0;
let failed = 0;

async function check(name, testFn) {
  try {
    const result = await testFn();
    if (result.ok) {
      console.log(`  ✅ [PASS] ${name}${result.details ? ` (${result.details})` : ""}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${name} — ${result.error}`);
      failed++;
    }
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name} — Unexpected error: ${err.message}`);
    failed++;
  }
}

async function runSuite() {
  // 1. API Health Check
  await check("API Health Endpoint (/api/health)", async () => {
    const res = await fetch(`${targetUrl}/api/health`);
    if (!res.ok) return { ok: false, error: `HTTP ${res.status} ${res.statusText}` };
    const json = await res.json();
    if (json.status !== "healthy") return { ok: false, error: `Unexpected health payload: ${JSON.stringify(json)}` };
    return { ok: true, details: `status=${json.status}, timestamp=${json.timestamp}` };
  });

  // 2. Security Headers on Homepage
  await check("Security Headers (Content-Security-Policy, HSTS, X-Frame)", async () => {
    const res = await fetch(`${targetUrl}/`);
    if (!res.ok) return { ok: false, error: `Homepage returned HTTP ${res.status}` };

    const headers = res.headers;
    const missing = [];

    if (!headers.get("content-security-policy")) missing.push("Content-Security-Policy");
    if (!headers.get("x-frame-options")) missing.push("X-Frame-Options");
    if (!headers.get("x-content-type-options")) missing.push("X-Content-Type-Options");
    if (!headers.get("referrer-policy")) missing.push("Referrer-Policy");

    if (targetUrl.startsWith("https://") && !headers.get("strict-transport-security")) {
      missing.push("Strict-Transport-Security");
    }

    if (missing.length > 0) {
      return { ok: false, error: `Missing expected headers: ${missing.join(", ")}` };
    }

    return {
      ok: true,
      details: `CSP & X-Frame: ${headers.get("x-frame-options")}`,
    };
  });

  // 3. SEO Assets
  await check("Robots.txt (/robots.txt)", async () => {
    const res = await fetch(`${targetUrl}/robots.txt`);
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const text = await res.text();
    if (!text.includes("User-agent:")) return { ok: false, error: "Invalid robots.txt content" };
    return { ok: true, details: "Valid robots.txt rules" };
  });

  await check("Sitemap XML (/sitemap.xml)", async () => {
    const res = await fetch(`${targetUrl}/sitemap.xml`);
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const text = await res.text();
    if (!text.includes("<urlset") && !text.includes("<sitemapindex")) {
      return { ok: false, error: "Missing XML urlset" };
    }
    return { ok: true, details: "Valid XML sitemap" };
  });

  // 4. Public Content Pages
  const publicPages = [
    "/",
    "/menu",
    "/about",
    "/gallery",
    "/reservations",
    "/contact",
    "/faq",
    "/privacy",
    "/terms",
  ];

  for (const page of publicPages) {
    await check(`Public Route: ${page}`, async () => {
      const res = await fetch(`${targetUrl}${page}`);
      if (!res.ok) return { ok: false, error: `HTTP ${res.status} ${res.statusText}` };
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("text/html")) return { ok: false, error: `Unexpected content-type: ${ct}` };
      return { ok: true, details: `HTTP 200 (${ct.split(";")[0]})` };
    });
  }

  // 5. Admin Security Gate Protection
  await check("Admin Gate Redirect (/admin -> /admin/login)", async () => {
    const res = await fetch(`${targetUrl}/admin`, { redirect: "manual" });
    // Expect 307 or 302 redirect
    if (res.status === 307 || res.status === 302 || res.status === 308) {
      const location = res.headers.get("location") || "";
      if (location.includes("/admin/login")) {
        return { ok: true, details: `Redirects ${res.status} to ${location}` };
      }
      return { ok: false, error: `Redirected to unexpected location: ${location}` };
    }
    return { ok: false, error: `Expected redirect (307/302), got HTTP ${res.status}` };
  });

  // 6. API Surface Reachability
  //
  // Credential-free and non-mutating: this suite is run against production.
  // The signal that matters is 401 versus 404 — a deployed Route Handler
  // answers 401 when the key is missing, whereas a route that did not deploy
  // (or was never served) 404s. Every `/api/v1/*` route requires an S2S key
  // except the public waitlist lookup, which is probed by its JSON error body.
  // Never give this script a real API key.
  const s2sGuardedRoutes = [
    { method: "GET", path: "/api/v1/menu" },
    { method: "GET", path: "/api/v1/orders" },
    { method: "POST", path: "/api/v1/orders" },
  ];

  for (const route of s2sGuardedRoutes) {
    await check(`API Surface: ${route.method} ${route.path} rejects unauthenticated callers`, async () => {
      const res = await fetch(`${targetUrl}${route.path}`, {
        method: route.method,
        ...(route.method === "POST"
          ? { headers: { "Content-Type": "application/json" }, body: "{}" }
          : {}),
      });
      if (res.status !== 401) {
        return { ok: false, error: `Expected HTTP 401 without credentials, got HTTP ${res.status}` };
      }
      return { ok: true, details: "HTTP 401 — route deployed, auth enforced" };
    });
  }

  await check("API Surface: GET /api/v1/waitlist/:id is served (public route)", async () => {
    const res = await fetch(`${targetUrl}/api/v1/waitlist/00000000-0000-0000-0000-000000000000`);
    if (res.status !== 404) {
      return { ok: false, error: `Expected HTTP 404 for an unknown entry, got HTTP ${res.status}` };
    }
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      // A framework 404 is HTML; the route's own 404 is JSON.
      return { ok: false, error: `Route did not handle the request (content-type: ${ct})` };
    }
    return { ok: true, details: "HTTP 404 with a JSON body — route deployed" };
  });

  // Summary
  console.log(`\n------------------------------------------------------`);
  console.log(`Summary: ${passed} Passed, ${failed} Failed`);
  console.log(`------------------------------------------------------\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error("Verification suite failed to execute:", err);
  process.exit(1);
});
