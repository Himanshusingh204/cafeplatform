import type { Metadata } from "next";
import { Geist, Marcellus } from "next/font/google";
import "./globals.css";
import { site } from "@/config/site";
import { seo } from "@/config/seo";

const geistSans = Geist({
  variable: "--font-sans-serif",
  subsets: ["latin"],
});

const marcellus = Marcellus({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  title: {
    default: seo.defaultTitle,
    template: seo.titleTemplate,
  },
  description: seo.description,
  keywords: [...seo.keywords],
  openGraph: {
    ...seo.openGraph,
    title: seo.defaultTitle,
    description: seo.description,
  },
  twitter: seo.twitter,
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: site.name,
    description: site.description,
    image: [
      `${process.env.APP_URL ?? "http://localhost:3000"}/images/placeholders/hero-placeholder.jpg`,
      `${process.env.APP_URL ?? "http://localhost:3000"}/images/placeholders/about-placeholder.jpg`,
      `${process.env.APP_URL ?? "http://localhost:3000"}/images/menu/butter-chicken.jpg`,
    ],
    telephone: site.phone,
    email: site.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: "12 Café Lane, Hauz Khas",
      addressLocality: "New Delhi",
      postalCode: "110016",
      addressCountry: "IN",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: "28.5535",
      longitude: "77.1945",
    },
    openingHours: [
      "Mo-Th 11:00-23:00",
      "Fr 11:00-23:30",
      "Sa 09:00-23:30",
      "Su 09:00-23:00",
    ],
    servesCuisine: ["Indian", "North Indian", "Tandoori", "Mughlai", "Café"],
    priceRange: "₹₹",
    menu: `${process.env.APP_URL ?? "http://localhost:3000"}/menu`,
  };

  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${marcellus.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
        {children}
      </body>
    </html>
  );
}