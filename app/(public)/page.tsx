import type { Metadata } from "next";
import HomePage from "@/components/home/homepage";

import { seo } from "@/config/seo";
import { pageMetadata } from "@/lib/seo/metadata";

export const revalidate = 300;

export const metadata: Metadata = {
  ...pageMetadata({
    title: seo.defaultTitle,
    description: seo.description,
    path: "/",
  }),
  title: { absolute: seo.defaultTitle },
};

export default function Home() {
  return <HomePage />;
}