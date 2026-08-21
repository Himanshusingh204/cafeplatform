import { site } from "@/config/site";

export const seo = {
  defaultTitle: `${site.name} — Indian Café`,
  titleTemplate: `%s | ${site.name}`,
  description: site.description,
  keywords: [
    "indian café",
    "indian restaurant",
    site.area,
    "butter chicken",
    "paneer",
    "breakfast",
    "lunch",
    "dinner",
    "desserts",
  ],
  openGraph: {
    type: "website",
    locale: "en_IN",
    siteName: site.name,
  },
  twitter: {
    card: "summary_large_image",
  },
} as const;