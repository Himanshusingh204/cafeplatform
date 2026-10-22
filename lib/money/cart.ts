/**
 * The cart pricing rule, in one place.
 *
 * The storefront (a client component) shows the customer a total before the
 * server charges them. If those two computations live in different files they
 * drift — which is exactly what happened here: the checkout page computed
 * `Math.round(subtotal * 0.05)` in whole rupees while the order service rounded
 * paise, so a ₹10 order displayed ₹11 and charged ₹10.50.
 *
 * Both sides call `priceCart`, and the only thing that differs is where the
 * values come from. Pure and dependency-free, so a client bundle can use it.
 */

import { applyRatePercent, MoneyError, roundHalfUp, toMinorUnits } from "@/lib/money";

export interface CartPricingInput {
  /** Sum of line items, exclusive of tax, discounts and tip. */
  subtotalMinorUnits: number;
  /** Coupon discount from `validateCoupon`/`resolveCoupon`. Clamped to the subtotal. */
  couponDiscountMinorUnits?: number;
  /** Loyalty redemption value from `loyaltyDiscountMinorUnits`. Clamped to the subtotal. */
  loyaltyDiscountMinorUnits?: number;
  tipMinorUnits?: number;
  /** Resolved tax rate, as a percentage. Never a hardcoded literal at the call site. */
  taxRatePercent: number;
}

export interface CartPricing {
  subtotalMinorUnits: number;
  couponDiscountMinorUnits: number;
  loyaltyDiscountMinorUnits: number;
  /** Coupon + loyalty, capped at the subtotal so a total can never go negative. */
  discountMinorUnits: number;
  taxableMinorUnits: number;
  taxMinorUnits: number;
  tipMinorUnits: number;
  totalMinorUnits: number;
}

function nonNegative(minorUnits: number | undefined): number {
  if (minorUnits === undefined || !Number.isFinite(minorUnits)) return 0;
  return Math.max(0, Math.trunc(minorUnits));
}

export function priceCart(input: CartPricingInput): CartPricing {
  const subtotalMinorUnits = nonNegative(input.subtotalMinorUnits);
  const tipMinorUnits = nonNegative(input.tipMinorUnits);

  const couponDiscountMinorUnits = Math.min(subtotalMinorUnits, nonNegative(input.couponDiscountMinorUnits));
  const loyaltyDiscountMinorUnits = Math.min(subtotalMinorUnits, nonNegative(input.loyaltyDiscountMinorUnits));
  const discountMinorUnits = Math.min(
    subtotalMinorUnits,
    couponDiscountMinorUnits + loyaltyDiscountMinorUnits
  );

  const taxableMinorUnits = Math.max(0, subtotalMinorUnits - discountMinorUnits);
  // Tax is charged on what the customer pays for the food, never on the tip.
  const taxMinorUnits = applyRatePercent(taxableMinorUnits, input.taxRatePercent);

  return {
    subtotalMinorUnits,
    couponDiscountMinorUnits,
    loyaltyDiscountMinorUnits,
    discountMinorUnits,
    taxableMinorUnits,
    taxMinorUnits,
    tipMinorUnits,
    totalMinorUnits: taxableMinorUnits + taxMinorUnits + tipMinorUnits,
  };
}

/**
 * A tip percentage applied to the subtotal, rounded half-up in paise.
 * Shared by the checkout tip buttons and any server-side equivalent.
 */
export function tipFromPercent(subtotalMinorUnits: number, tipPercent: number): number {
  return applyRatePercent(nonNegative(subtotalMinorUnits), tipPercent);
}

/**
 * Read a money value from user input, treating anything unreadable as zero.
 * For UI fields (`customTip`) where a half-typed value must not throw.
 */
export function toMinorUnitsOrZero(value: unknown): number {
  try {
    return Math.max(0, toMinorUnits(value as number | string));
  } catch (error) {
    if (error instanceof MoneyError) return 0;
    throw error;
  }
}

/** Kept so callers do not need to reach into `lib/money` for a single name. */
export { roundHalfUp };
