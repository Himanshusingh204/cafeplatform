// Pricing configuration — the rates and rules that a café owner would change,
// kept out of the code paths that compute money.
//
// "Hardcode to humanize": `5` (percent GST) belongs here, not inline in the
// order service, and not as the float `0.05` anywhere.

function nonNegativeNumberFromEnv(value: string | undefined, fallback: number): number {  if (value === undefined || value.trim() === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

/**
 * A tenant that may (from Phase 2) carry its own tax rate. Until
 * `Tenant.taxRatePercent` exists, every tenant falls through to the default —
 * the *call site* is already correct, only the data source is pending.
 * See `docs/plans/phase-1-completion.md` §7 (D1).
 */
export interface TaxConfigurableTenant {
  taxRatePercent?: { toString(): string } | number | null;
}

export const pricing = {
  /** ISO 4217 code. Money is never a bare number — see ADR-0005. */
  currency: "INR",

  /**
   * Restaurant GST, as a percentage. Overridable per deployment via
   * `TAX_RATE_PERCENT` so a café in another jurisdiction does not need a code
   * change; a per-tenant rate arrives with `Tenant.taxRatePercent` in Phase 2.
   */
  defaultTaxRatePercent: nonNegativeNumberFromEnv(process.env.TAX_RATE_PERCENT, 5),

  /** Loyalty: points needed to earn one redemption unit. */
  loyaltyPointsPerRedemption: 100,
  /** Loyalty: the value of one redemption unit, in rupees. */
  loyaltyRedemptionValueRupees: 50,
} as const;

/**
 * The tax rate to apply for a tenant.
 *
 * Today this always returns the configured default; Phase 2 reads the tenant
 * column first. Call sites do not change when that lands.
 */
export function resolveTaxRatePercent(tenant?: TaxConfigurableTenant | null): number {
  const raw = tenant?.taxRatePercent;
  const tenantRate = raw === null || raw === undefined ? null : Number(raw.toString());
  if (typeof tenantRate === "number" && Number.isFinite(tenantRate) && tenantRate >= 0) {
    return tenantRate;
  }
  return pricing.defaultTaxRatePercent;
}

/**
 * The cash value of redeemed loyalty points, in minor units.
 *
 * `points` are redeemed in whole blocks of `loyaltyPointsPerRedemption`; a
 * partial block earns nothing. This is the single definition of the rule —
 * `lib/services/orders.ts` (what the customer is charged) and
 * `lib/services/loyalty.ts` (what the ledger records) both call it, so they
 * cannot disagree.
 */
export function loyaltyDiscountMinorUnits(points: number): number {
  if (!Number.isFinite(points) || points <= 0) return 0;
  // Whole blocks only: 150 points redeem one block, not one and a half.
  const blocks = Math.floor(Math.floor(points) / pricing.loyaltyPointsPerRedemption);
  return blocks * pricing.loyaltyRedemptionValueRupees * 100;
}
