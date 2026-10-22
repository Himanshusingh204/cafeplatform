import type { Metadata } from "next";
import { seo } from "@/config/seo";

type PageMetadataInput = {
  /** Page title without the site suffix (the root template appends it). */
  readonly title: string;
  readonly description: string;
  /** Relative canonical route, e.g. "/menu". */
  readonly path: string;
  readonly images?: readonly string[];
  readonly noindex?: boolean;
};

/**
 * Builds unique title, description, canonical, Open Graph and Twitter metadata
 * for a page. Open Graph does not inherit from the parent once a page sets
 * its own, so every field is emitted explicitly.
 */
export function pageMetadata(input: PageMetadataInput): Metadata {
  const images = input.images?.map((url) => ({ url }));

  return {
    title: input.title,
    description: input.description,
    alternates: { canonical: input.path },
    openGraph: {
      ...seo.openGraph,
      title: input.title,
      description: input.description,
      url: input.path,
      ...(images ? { images } : {}),
    },
    twitter: {
      ...seo.twitter,
      title: input.title,
      description: input.description,
      ...(input.images ? { images: [...input.images] } : {}),
    },
    ...(input.noindex ? { robots: { index: false, follow: false } } : {}),
  };
}
