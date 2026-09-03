import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { AboutValues } from "@/components/about/about-values";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "About Us",
  description:
    "The story behind our café — whole spices, slow cooking and honest hospitality in the heart of Hauz Khas.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <>
      <PageHeader
        title="A café built on patience"
        description="We started with a tandoor, a spice grinder and a simple belief: Indian food deserves the same care as any great cuisine."
      />
      <AboutValues />
    </>
  );
}
