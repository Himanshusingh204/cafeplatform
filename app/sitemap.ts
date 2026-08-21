import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const lastModified = new Date();

  const routes = ["", "/about", "/menu", "/gallery", "/contact", "/faq", "/privacy", "/terms"];

  return routes.map((route) => ({
    url: `${appUrl}${route}`,
    lastModified,
    changeFrequency: route === "" || route === "/menu" ? "weekly" : "monthly",
    priority: route === "" ? 1 : route === "/menu" ? 0.9 : 0.7,
  }));
}
