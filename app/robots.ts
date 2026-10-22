import type { MetadataRoute } from "next";
import { baseUrl } from "@/lib/seo/jsonld";

export default function robots(): MetadataRoute.Robots {
  const appUrl = baseUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api"],
      },
    ],
    sitemap: `${appUrl}/sitemap.xml`,
    host: appUrl,
  };
}
