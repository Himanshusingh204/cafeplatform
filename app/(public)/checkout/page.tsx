import type { Metadata } from "next";

import { resolveTaxRatePercent } from "@/config/pricing";
import CheckoutClient from "./checkout-client";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Review your order, apply a coupon and choose how to pay.",
  // A cart is per-session state; it has nothing to offer a search engine.
  robots: { index: false, follow: true },
};

/**
 * Server shell for the checkout island.
 *
 * Its only job is to resolve the tax rate on the server and hand it to the
 * client, so the total the customer sees is computed with the same configured
 * rate the order service charges. The alternative — reading the rate in the
 * browser — would silently fall back to the default and mis-state the total on
 * any deployment that configures `TAX_RATE_PERCENT`.
 */
export default function CheckoutPage() {
  return <CheckoutClient taxRatePercent={resolveTaxRatePercent()} />;
}
