import type { Metadata, Viewport } from "next";
import { Geist, Marcellus } from "next/font/google";
import "./globals.css";
import { site } from "@/config/site";
import { seo } from "@/config/seo";
import {
  jsonLdGraph,
  restaurantSchema,
  serializeJsonLd,
  websiteSchema,
} from "@/lib/seo/jsonld";

const geistSans = Geist({
  variable: "--font-sans-serif",
  subsets: ["latin"],
  display: "swap",
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
  applicationName: site.name,
  authors: [{ name: site.name }],
  creator: site.name,
  publisher: site.name,
  category: "Restaurant",
  keywords: [...seo.keywords],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    ...seo.openGraph,
    title: seo.defaultTitle,
    description: seo.description,
  },
  twitter: seo.twitter,
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "light",
  themeColor: site.brand.accent,
};

const structuredData = serializeJsonLd(
  jsonLdGraph(restaurantSchema(), websiteSchema()),
);

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${marcellus.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: structuredData }}
        />
        {children}
      </body>
    </html>
  );
}
