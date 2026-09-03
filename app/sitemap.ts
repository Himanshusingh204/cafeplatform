import type { MetadataRoute } from "next";
import { db } from "@/lib/db/prisma";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const lastModified = new Date();

  const staticRoutes = ["", "/about", "/menu", "/gallery", "/contact", "/faq", "/privacy", "/terms"];

  const staticEntries = staticRoutes.map((route) => ({
    url: `${appUrl}${route}`,
    lastModified,
    changeFrequency: route === "" || route === "/menu" ? "weekly" as const : "monthly" as const,
    priority: route === "" ? 1 : route === "/menu" ? 0.9 : 0.7,
  }));

  let dishEntries: MetadataRoute.Sitemap = [];
  try {
    const dishes = await db.dish.findMany({
      where: { isAvailable: true, deletedAt: null },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    });

    dishEntries = dishes.map((dish) => ({
      url: `${appUrl}/menu/${dish.slug}`,
      lastModified: dish.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));
  } catch {
    // DB unavailable during build — return static entries only
  }

  return [...staticEntries, ...dishEntries];
}
