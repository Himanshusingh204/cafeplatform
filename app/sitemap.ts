import type { MetadataRoute } from "next";
import { db } from "@/lib/db/prisma";
import { baseUrl } from "@/lib/seo/jsonld";

type StaticRoute = {
  path: string;
  changeFrequency: "weekly" | "monthly" | "yearly";
  priority: number;
};

// Indexable routes only — `/checkout`, `/order/[id]` and `/admin/*` are private.
const STATIC_ROUTES: readonly StaticRoute[] = [
  { path: "", changeFrequency: "weekly", priority: 1 },
  { path: "/about", changeFrequency: "monthly", priority: 0.7 },
  { path: "/menu", changeFrequency: "weekly", priority: 0.9 },
  { path: "/gallery", changeFrequency: "monthly", priority: 0.7 },
  { path: "/contact", changeFrequency: "monthly", priority: 0.7 },
  { path: "/faq", changeFrequency: "monthly", priority: 0.6 },
  { path: "/reservations", changeFrequency: "weekly", priority: 0.8 },
  { path: "/loyalty", changeFrequency: "monthly", priority: 0.6 },
  { path: "/waitlist", changeFrequency: "weekly", priority: 0.7 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.3 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const appUrl = baseUrl();
  // Date-only so repeated builds on the same day produce identical output.
  const lastModified = new Date(new Date().toISOString().slice(0, 10));

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: route.path === "" ? `${appUrl}/` : `${appUrl}${route.path}`,
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
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
  } catch (error) {
    // DB unavailable during build — serve static entries, but surface the failure.
    console.warn(
      "[sitemap] Dish query failed; returning static routes only.",
      error,
    );
  }

  return [...staticEntries, ...dishEntries];
}
