import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Join the Waitlist",
  description:
    "No free table right now? Join the waitlist and track your place in the queue live.",
  path: "/waitlist",
});

export default function WaitlistLayout({ children }: { children: React.ReactNode }) {
  return children;
}
