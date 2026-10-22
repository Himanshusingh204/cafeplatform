import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Loyalty Rewards",
  description:
    "Look up your loyalty points and past orders, and reorder your favourites in a tap.",
  path: "/loyalty",
});

export default function LoyaltyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
