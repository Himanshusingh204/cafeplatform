import { site } from "@/config/site";

/**
 * Single source of truth for every absolute URL emitted in structured data.
 * `APP_URL` is the deployment origin; relative paths are resolved against it.
 */
export function baseUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

export function absoluteUrl(path: string): string {
  if (path === "" || path === "/") {
    return `${baseUrl()}/`;
  }

  return `${baseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

export type JsonLdSchema = {
  "@context": "https://schema.org";
  [key: string]: unknown;
};

export type JsonLdNode = Record<string, unknown>;

export type JsonLdGraph = {
  "@context": "https://schema.org";
  "@graph": JsonLdNode[];
};

export type BreadcrumbItem = {
  readonly name: string;
  /** Relative route. Omit for the current (last) breadcrumb. */
  readonly path?: string;
};

export type FaqItem = {
  readonly question: string;
  readonly answer: string;
};

export type MenuItemInput = {
  readonly name: string;
  readonly description?: string;
  readonly price: number;
  readonly currency?: string;
};

export type MenuSectionInput = {
  readonly name: string;
  readonly items: readonly MenuItemInput[];
};

type OpeningHoursSpecification = {
  "@type": "OpeningHoursSpecification";
  dayOfWeek: string;
  opens: string;
  closes: string;
};

const WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const satisfies readonly (keyof typeof site.openingHours)[];

const DAY_LABELS: Record<(typeof WEEKDAYS)[number], string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

/** "11:00 AM" -> "11:00", "9:00 PM" -> "21:00". Returns null when unparseable. */
function parseTime(value: string): string | null {
  const match = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i.exec(value.trim());
  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  if (hour < 1 || hour > 12) {
    return null;
  }

  const minute = match[2] ?? "00";
  const period = match[3].toUpperCase();
  const hours24 = period === "AM" ? hour % 12 : (hour % 12) + 12;

  return `${String(hours24).padStart(2, "0")}:${minute}`;
}

/** Derives schema.org opening hours from the human-readable strings in config. */
function openingHoursSpecification(): OpeningHoursSpecification[] {
  return WEEKDAYS.flatMap((day) => {
    const [opensRaw, closesRaw] = site.openingHours[day].split(/[–—-]/);
    const opens = parseTime(opensRaw ?? "");
    const closes = parseTime(closesRaw ?? "");

    if (!opens || !closes) {
      return [];
    }

    return [
      {
        "@type": "OpeningHoursSpecification" as const,
        dayOfWeek: DAY_LABELS[day],
        opens,
        closes,
      },
    ];
  });
}

export function restaurantSchema(): JsonLdSchema {
  const url = baseUrl();

  return {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    "@id": `${url}/#restaurant`,
    name: site.name,
    description: site.description,
    url: `${url}/`,
    telephone: site.phone,
    email: site.email,
    image: site.images.map((image) => absoluteUrl(image)),
    servesCuisine: [...site.cuisines],
    priceRange: site.priceRange,
    currenciesAccepted: site.currency,
    address: {
      "@type": "PostalAddress",
      streetAddress: site.addr.street,
      addressLocality: site.addr.locality,
      addressRegion: site.addr.region,
      postalCode: site.addr.postalCode,
      addressCountry: site.addr.country,
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: site.geo.latitude,
      longitude: site.geo.longitude,
    },
    openingHoursSpecification: openingHoursSpecification(),
    sameAs: [...site.sameAs],
    hasMenu: absoluteUrl("/menu"),
    acceptsReservations: absoluteUrl("/reservations"),
  };
}

export function websiteSchema(): JsonLdSchema {
  const url = baseUrl();

  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${url}/#website`,
    url: `${url}/`,
    name: site.name,
    description: site.description,
    inLanguage: "en-IN",
    publisher: {
      "@id": `${url}/#restaurant`,
    },
  };
}

export function breadcrumbSchema(
  items: readonly BreadcrumbItem[],
): JsonLdSchema {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      ...(item.path ? { item: absoluteUrl(item.path) } : {}),
    })),
  };
}

export function faqSchema(items: readonly FaqItem[]): JsonLdSchema {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

export function menuSchema(
  sections: readonly MenuSectionInput[] = [],
): JsonLdSchema {
  return {
    "@context": "https://schema.org",
    "@type": "Menu",
    "@id": `${baseUrl()}/menu#menu`,
    name: `${site.name} Menu`,
    description: `Food and drink menu at ${site.name}.`,
    url: absoluteUrl("/menu"),
    inLanguage: "en-IN",
    hasMenuSection: sections.map((section) => ({
      "@type": "MenuSection",
      name: section.name,
      hasMenuItem: section.items.map((item) => ({
        "@type": "MenuItem",
        name: item.name,
        ...(item.description ? { description: item.description } : {}),
        offers: {
          "@type": "Offer",
          price: String(item.price),
          priceCurrency: item.currency ?? site.currency,
        },
      })),
    })),
  };
}

export type DishSchemaInput = {
  readonly name: string;
  readonly slug: string;
  readonly description?: string | null;
  readonly image?: string | null;
  readonly price: number;
  readonly isVegetarian?: boolean;
  readonly isVegan?: boolean;
};

/** schema.org MenuItem for a single dish page. Data comes from the dish row. */
export function menuItemSchema(dish: DishSchemaInput): JsonLdSchema {
  const diets = [
    dish.isVegetarian ? "https://schema.org/VegetarianDiet" : null,
    dish.isVegan ? "https://schema.org/VeganDiet" : null,
  ].filter((diet): diet is string => diet !== null);

  return {
    "@context": "https://schema.org",
    "@type": "MenuItem",
    name: dish.name,
    url: absoluteUrl(`/menu/${dish.slug}`),
    ...(dish.description ? { description: dish.description } : {}),
    ...(dish.image ? { image: absoluteUrl(dish.image) } : {}),
    offers: {
      "@type": "Offer",
      price: String(dish.price),
      priceCurrency: site.currency,
    },
    ...(diets.length > 0 ? { suitableForDiet: diets } : {}),
  };
}

function toGraphNode(schema: JsonLdSchema): JsonLdNode {
  const node: JsonLdNode = { ...schema };
  delete node["@context"];

  return node;
}

/** Bundles multiple schemas into one `@graph` document for a single script tag. */
export function jsonLdGraph(...schemas: readonly JsonLdSchema[]): JsonLdGraph {
  return {
    "@context": "https://schema.org",
    "@graph": schemas.map(toGraphNode),
  };
}

/** Safe for `dangerouslySetInnerHTML` — escapes `<` so values cannot break out. */
export function serializeJsonLd(data: unknown): string {
  return (JSON.stringify(data) ?? "").replace(/</g, "\\u003c");
}
