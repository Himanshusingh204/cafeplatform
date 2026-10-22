/**
 * Money arithmetic in integer minor units.
 *
 * The database stores money as `Decimal(10, 2)` (paise for INR). That is exact;
 * JavaScript `number` is not, so the moment an amount becomes a float the totals
 * stop round-tripping — `0.1 + 0.2 !== 0.3`, and discount + tax + tip rounding
 * compounds the error. This module is the only place allowed to interpret a
 * money value, and it never uses floating point for it.
 *
 * Rules:
 *
 * - Amounts are **integer minor units** (paise) inside the application.
 * - Derived amounts (tax, percentage discounts) are rounded **half-up, away
 *   from zero**, exactly once, by `roundHalfUp`.
 * - Conversion to `Decimal` happens only at the database boundary, as a
 *   fixed-point string: `toDecimalString(12345) === "123.45"`. A string is
 *   exact, which is the whole point — `123.45` as a `number` is not.
 * - Anything that cannot be interpreted exactly **throws** `MoneyError` rather
 *   than guessing. On the money path, a wrong answer is worse than no answer.
 *
 * See `docs/adr/0005-decimal-money-and-integer-minor-units.md`.
 */

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyError";
  }
}

/** 100 paise to the rupee, 100 cents to the dollar. */
export const MINOR_UNITS_PER_MAJOR = 100;

/** Each derived amount is computed in thousandths of a percent. */
const PERCENT_SCALE = 1000;

/**
 * Anything that can be read as an exact decimal. Prisma's `Decimal` satisfies
 * `{ toString(): string }`, as does a plain string.
 */
export type MoneyInput = number | string | { toString(): string };

function toPlainString(value: MoneyInput): string {
  if (typeof value === "string") return value.trim();
  // `String(n)` is exact for every finite number below 1e21; above that it
  // switches to exponential notation, which is not a money value.
  return String(value).trim();
}

/**
 * Parse an exact decimal into integer minor units, rounding half-up at the
 * third decimal place.
 *
 * Accepts `Decimal`, a decimal string, or a number. Rejects `NaN`, `Infinity`,
 * exponential notation and anything that is not a plain decimal number.
 */
export function toMinorUnits(value: MoneyInput): number {
  if (value === null || value === undefined) {
    throw new MoneyError("Money value is required.");
  }

  const raw = toPlainString(value);
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(raw);
  if (!match) {
    throw new MoneyError(`Not a money value: "${raw}".`);
  }

  const [, sign, integerPart, fractionPart = ""] = match;

  const wholeUnits = Number(integerPart);
  if (!Number.isSafeInteger(wholeUnits)) {
    throw new MoneyError(`Money value is too large: "${raw}".`);
  }

  // Only the first three decimals matter: two are stored, the third decides the
  // half-up rounding. Digits beyond that are float noise, not information.
  const fraction3 = fractionPart.padEnd(3, "0").slice(0, 3);
  const hundredths = Number(fraction3.slice(0, 2));
  const thousandths = Number(fraction3[2]);

  let minorUnits = wholeUnits * MINOR_UNITS_PER_MAJOR + hundredths;
  if (thousandths >= 5) {
    minorUnits += 1;
  }

  if (!Number.isSafeInteger(minorUnits)) {
    throw new MoneyError(`Money value is too large: "${raw}".`);
  }

  return sign === "-" ? -minorUnits : minorUnits;
}

/**
 * Minor units back to a `number` in major units.
 *
 * **For display and legacy call sites only.** Never use the result for
 * arithmetic — that is exactly the float path this module exists to remove.
 */
export function toMajorUnits(minorUnits: number): number {
  assertIntegerAmount(minorUnits);
  return minorUnits / MINOR_UNITS_PER_MAJOR;
}

/**
 * Minor units as a fixed-point string for a `Decimal(10, 2)` column or a
 * `Decimal`-typed Prisma argument. Exact, unlike `toMajorUnits`.
 */
export function toDecimalString(minorUnits: number): string {
  assertIntegerAmount(minorUnits);
  const sign = minorUnits < 0 ? "-" : "";
  const magnitude = Math.abs(minorUnits);
  const whole = Math.floor(magnitude / MINOR_UNITS_PER_MAJOR);
  const fraction = String(magnitude % MINOR_UNITS_PER_MAJOR).padStart(2, "0");
  return `${sign}${whole}.${fraction}`;
}

/**
 * The single rounding primitive: `numerator / denominator`, rounded half-up,
 * in integer arithmetic.
 *
 * `roundHalfUp(45, 100) === 0` and `roundHalfUp(50, 100) === 1` — the half
 * rounds away from zero, which is the convention invoices use.
 */
export function roundHalfUp(numerator: number, denominator: number): number {
  if (!Number.isSafeInteger(numerator) || numerator < 0) {
    throw new MoneyError(`roundHalfUp expects a non-negative integer numerator, got ${numerator}.`);
  }
  if (!Number.isSafeInteger(denominator) || denominator <= 0) {
    throw new MoneyError(`roundHalfUp expects a positive integer denominator, got ${denominator}.`);
  }

  return Math.floor((2 * numerator + denominator) / (2 * denominator));
}

/**
 * `percent` of an amount, rounded half-up once.
 *
 * The rate is scaled to thousandths of a percent, so 5 %, 5.5 % and 5.125 % are
 * all exact; 5 % is never the float `0.05`.
 */
export function applyRatePercent(minorUnits: number, percent: number): number {
  assertIntegerAmount(minorUnits);
  if (minorUnits < 0) {
    throw new MoneyError(`applyRatePercent expects a non-negative amount, got ${minorUnits}.`);
  }
  if (!Number.isFinite(percent) || percent < 0) {
    throw new MoneyError(`applyRatePercent expects a non-negative rate, got ${percent}.`);
  }

  const scaledPercent = Math.round(percent * PERCENT_SCALE);
  const product = minorUnits * scaledPercent;
  if (!Number.isSafeInteger(product)) {
    throw new MoneyError(`Amount ${minorUnits} at ${percent}% is out of range.`);
  }

  return roundHalfUp(product, MINOR_UNITS_PER_MAJOR * PERCENT_SCALE);
}

function assertIntegerAmount(minorUnits: number): void {
  if (!Number.isSafeInteger(minorUnits)) {
    throw new MoneyError(`Minor units must be a safe integer, got ${minorUnits}.`);
  }
}
