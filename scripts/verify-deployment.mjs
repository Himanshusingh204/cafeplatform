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
