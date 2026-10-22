import "server-only";

import { randomBytes } from "node:crypto";

import { z } from "zod";

import { db } from "@/lib/db/prisma";
import { logAction } from "@/lib/services/audit";
import { broadcastEvent } from "@/lib/realtime/bus";
import { dispatchWebhook } from "@/lib/webhooks/dispatcher";
import { depleteInventoryForOrder } from "@/lib/services/inventory";
import { occupyTableWithOrder, freeTable } from "@/lib/services/tables";
import { processLoyaltyForOrder } from "@/lib/services/loyalty";
import { after } from "next/server";
import { isEmailConfigured } from "@/lib/email/notifier";
import { enqueueOutboxEvent } from "@/lib/outbox/enqueue";
import { ORDER_INVENTORY_EVENT, ORDER_LOYALTY_EVENT } from "@/lib/outbox/handlers";
import { ORDER_RECEIPT_EVENT } from "@/lib/outbox/handlers";
import { processOutbox } from "@/lib/outbox/process";
import {
  applyRatePercent,
  toDecimalString,
  toMajorUnits,
  toMinorUnits,
  MoneyError,
} from "@/lib/money";
import { priceCart } from "@/lib/money/cart";
import { getTenantById, resolveTenant } from "@/lib/db/tenant";
import { assertWithinPlan } from "@/lib/plans";
import { loyaltyDiscountMinorUnits, resolveTaxRatePercent } from "@/config/pricing";
import type { OrderStatus, PaymentStatus, DiningMode } from "@/lib/generated/prisma/enums";

/**
 * Thrown when an order fails a business rule (bad quantity, dish unavailable,
 * a tampered client price). Adapters must map this to HTTP 422 — never a 500.
 */
export class OrderValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderValidationError";
  }
}

/**
 * Read a money value from untrusted input, converting a parse failure into a
 * business-rule error (HTTP 422) rather than a 500. See `lib/money`.
 */
function moneyOrThrow(value: unknown, message: string): number {
  try {
    return toMinorUnits(value as number | string);
  } catch (error) {
    if (error instanceof MoneyError) throw new OrderValidationError(message);
    throw error;
  }
}

export interface OrderItemModifierInput {
  /** Catalog modifier option id. Preferred: its database delta is authoritative. */
  optionId?: string;
  /** Legacy name-based selector, matched against the dish's catalog options. */
  groupName?: string;
  optionName?: string;
  /**
   * Legacy client-supplied delta. Accepted for wire compatibility and ignored:
   * the catalog delta always wins, so a client can never mark its own modifier up.
   */
  priceDelta?: number;
}

export interface OrderItemInput {
  dishId?: string;
  dishName: string;
  quantity: number;
  /** Required only for ad-hoc items with no `dishId`; always ignored when `dishId` is set. */
  price?: number;
  station?: string;
  modifiers?: OrderItemModifierInput[];
}

export interface CreateOrderInput {
  /** Owning tenant. When omitted, the default tenant is used only if allowed (see lib/db/tenant.ts). */
  tenantId?: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  pickupTime?: string;
  diningMode?: DiningMode;
  tableNumber?: string;
  tip?: number;
  specialInstructions?: string;
  items: OrderItemInput[];
  couponCode?: string;
  loyaltyPointsToRedeem?: number;
  paymentMethod?: "PAY_AT_PICKUP" | "CARD_ONLINE";
  /** Explicit override for trusted B2B callers (e.g. a POS that already took payment). */
  paymentStatus?: PaymentStatus;
  /**
   * Permit items without a `dishId` (custom/ad-hoc lines priced by the caller).
   * Only trusted internal callers (S2S POS, admin tools) may enable this; the
   * public storefront path must never be able to name its own price.
   */
  allowAdHoc?: boolean;
}

/**
 * The only shape the anonymous storefront may submit.
 *
 * Zod strips unknown keys by default, so a caller that injects `paymentStatus`,
 * `tenantId`, `total`, `subtotal`, `tax`, `discount` or `loyaltyPointsUsed` does
 * not reach `createOrder` with those fields. `priceDelta` and `price` are
 * accepted for wire compatibility with older clients but are never trusted —
 * `createOrder` derives every rupee from the catalog.
 */
export const publicOrderInputSchema = z.object({
  customerName: z.string().trim().min(2).max(100),
  customerEmail: z.string().email().max(254),
  customerPhone: z.string().trim().min(8).max(20),
  pickupTime: z.string().max(80).optional(),
  diningMode: z.enum(["DINE_IN", "TAKEAWAY", "DELIVERY"]).optional(),
  tableNumber: z.string().max(20).optional(),
  tip: z.number().nonnegative().max(100000).optional(),
  specialInstructions: z.string().max(500).optional(),
  couponCode: z.string().trim().max(40).optional(),
  loyaltyPointsToRedeem: z.number().int().nonnegative().optional(),
  paymentMethod: z.enum(["PAY_AT_PICKUP", "CARD_ONLINE"]).optional(),
  items: z
    .array(
      z.object({
        // The public path is catalog-only: an ad-hoc line would reintroduce a
        // caller-controlled price.
        dishId: z.string().uuid(),
        dishName: z.string().min(1).max(200),
        quantity: z.number().int().positive().max(99),
        price: z.number().nonnegative().optional(),
        station: z.string().max(40).optional(),
        modifiers: z
          .array(
            z
              .object({
                optionId: z.string().uuid().optional(),
                groupName: z.string().max(80).optional(),
                optionName: z.string().max(80).optional(),
                priceDelta: z.number().optional(),
              })
              .refine(
                (m) => Boolean(m.optionId) || Boolean(m.groupName && m.optionName),
                { message: "Each modifier needs an optionId or a group and option name." }
              )
          )
          .max(20)
          .optional(),
      })
    )
    .min(1, "Your takeaway bag is empty.")
    .max(50),
});

export type PublicOrderInput = z.infer<typeof publicOrderInputSchema>;

/** The customer-facing shape of a coupon check: major units, discriminated. */
export type CouponValidationResult =
  | { valid: true; code: string; discountPercent: number; discountAmount: number }
  | { valid: false; message: string };

export async function validateCoupon(
  code: string,
  subtotal: number,
  tenantId?: string
): Promise<CouponValidationResult> {
  try {
    const scopedTenantId = tenantId ?? (await resolveTenant()).id;
    const result = await resolveCoupon(code, toMinorUnits(subtotal), scopedTenantId);
    if (!result.valid) {
      return { valid: false, message: result.message };
    }

    // Legacy call sites (`lib/actions/public.ts`, `server/api.ts`) speak major
    // units. The discount itself was computed exactly in minor units; only this
    // presentation value is a float.
    return {
      valid: true,
      code: result.code,
      discountPercent: result.discountPercent,
      discountAmount: toMajorUnits(result.discountMinorUnits),
    };
  } catch {
    return { valid: false, message: "Error validating coupon code" };
  }
}

/**
 * The exact coupon rule, in minor units. `validateCoupon` is a major-unit
 * wrapper around this; `createOrder` calls it directly so the discount it
 * applies is never round-tripped through a float.
 */
async function resolveCoupon(code: string, subtotalMinorUnits: number, tenantId: string) {
  try {
    const coupon = await db.coupon.findUnique({
      where: { tenantId_code: { tenantId, code: code.toUpperCase().trim() } },
    });

    if (!coupon || !coupon.isActive) {
      return { valid: false as const, message: "Invalid or expired coupon code" };
    }

    if (coupon.validUntil && coupon.validUntil < new Date()) {
      return { valid: false as const, message: "Coupon has expired" };
    }

    const minOrderMinorUnits = coupon.minOrder === null ? 0 : toMinorUnits(coupon.minOrder);
    if (minOrderMinorUnits > 0 && subtotalMinorUnits < minOrderMinorUnits) {
      return {
        valid: false as const,
        message: `Minimum order amount of ₹${toDecimalString(minOrderMinorUnits)} required for this coupon`,
      };
    }

    const discountMinorUnits = applyRatePercent(subtotalMinorUnits, coupon.discountPercent);
    return {
      valid: true as const,
      code: coupon.code,
      discountPercent: coupon.discountPercent,
      discountMinorUnits,
    };
  } catch {
    return { valid: false as const, message: "Error validating coupon code" };
  }
}

// Crockford-style base32: no I, L, O or U, so an order number can be read aloud
// without ambiguity.
const ORDER_NUMBER_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const ORDER_NUMBER_SUFFIX_LENGTH = 6;

/**
 * Human-readable, collision-resistant order number: `ORD-YYMMDD-XXXXXX`.
 *
 * The previous `ORD-####` scheme had only 9 000 possible values, so two orders
 * could collide on the globally-unique `orderNumber` column. This yields
 * 32^6 ≈ 1.07 billion suffixes per day, and `createOrder` still retries on a
 * unique-constraint violation as a final guard.
 */
export function generateOrderNumber(): string {
  const now = new Date();
  const stamp =
    String(now.getUTCFullYear()).slice(-2) +
    String(now.getUTCMonth() + 1).padStart(2, "0") +
    String(now.getUTCDate()).padStart(2, "0");

  const bytes = randomBytes(ORDER_NUMBER_SUFFIX_LENGTH);
  let suffix = "";
  for (let i = 0; i < ORDER_NUMBER_SUFFIX_LENGTH; i += 1) {
    suffix += ORDER_NUMBER_ALPHABET[bytes[i] % ORDER_NUMBER_ALPHABET.length];
  }

  return `ORD-${stamp}-${suffix}`;
}

export async function createOrder(input: CreateOrderInput) {
  if (!input.items || input.items.length === 0) {
    throw new OrderValidationError("Order must have at least one item.");
  }

  // Fail closed: an order always belongs to a concrete tenant. An omitted
  // tenantId resolves the default tenant only where that is explicitly allowed.
  const tenant = input.tenantId
    ? await getTenantById(input.tenantId)
    : await resolveTenant();

  // Security Check: Look up authoritative dishes from the database when dishId is supplied.
  // This prevents attackers from tampering with client prices (e.g. buying a ₹350 dish for ₹1).
  // Scoped to the order's tenant, so another café's dish id is treated as unavailable.
  const dishIds = input.items
    .map((item) => item.dishId)
    .filter((id): id is string => Boolean(id));

  const dbDishes =
    dishIds.length > 0
      ? await db.dish.findMany({
          where: { id: { in: dishIds }, tenantId: tenant.id, deletedAt: null },
          select: {
            id: true,
            name: true,
            price: true,
            isAvailable: true,
            station: true,
            modifierGroups: {
              select: {
                id: true,
                name: true,
                options: {
                  select: { id: true, name: true, priceDelta: true, isAvailable: true },
                },
              },
            },
          },
        })
      : [];

  const dishMap = new Map(dbDishes.map((d) => [d.id, d]));

  const validatedItems = input.items.map((item) => {
    const qty = Math.floor(Number(item.quantity));
    if (!Number.isInteger(qty) || qty < 1 || qty > 99) {
      throw new OrderValidationError(`Invalid quantity for "${item.dishName}". Must be between 1 and 99.`);
    }

    let authoritativeBasePriceMinor: number;
    let authoritativeName = item.dishName.trim();
    let station = item.station || "HOT_KITCHEN";

    if (item.dishId) {
      const dbDish = dishMap.get(item.dishId);
      if (!dbDish) {
        throw new OrderValidationError(`Dish "${item.dishName}" is no longer available.`);
      }
      if (!dbDish.isAvailable) {
        throw new OrderValidationError(`Dish "${dbDish.name}" is currently marked out of stock.`);
      }
      // The catalog price wins; a client-supplied `price` is never read here.
      authoritativeBasePriceMinor = moneyOrThrow(
        dbDish.price,
        `Invalid catalog price for dish "${dbDish.name}".`
      );
      authoritativeName = dbDish.name;
      station = dbDish.station || station;
    } else {
      if (!input.allowAdHoc) {
        throw new OrderValidationError(
          `Item "${item.dishName}" is not on the menu. Please pick a dish from the current menu.`
        );
      }
      authoritativeBasePriceMinor = moneyOrThrow(
        item.price,
        `Invalid price for item "${item.dishName}".`
      );
      if (authoritativeBasePriceMinor <= 0) {
        throw new OrderValidationError(`Invalid price for item "${item.dishName}".`);
      }
    }

    const catalogOptions = item.dishId
      ? (dishMap.get(item.dishId)?.modifierGroups ?? []).flatMap((group) =>
          group.options.map((option) => ({ group, option }))
        )
      : [];

    const validatedModifiers = (item.modifiers || []).map((m) => {
      const optionId = m.optionId?.trim();
      const groupName = m.groupName?.trim() ?? "";
      const optionName = m.optionName?.trim() ?? "";

      if (catalogOptions.length === 0) {
        throw new OrderValidationError(
          `Modifiers are not available for item "${authoritativeName}".`
        );
      }

      const match = optionId
        ? catalogOptions.find((entry) => entry.option.id === optionId)
        : catalogOptions.find(
            (entry) =>
              entry.group.name.toLowerCase() === groupName.toLowerCase() &&
              entry.option.name.toLowerCase() === optionName.toLowerCase()
          );

      if (!match) {
        // The client sent a modifier we do not sell on this dish. Never fall
        // back to its claimed delta: that is the money-tampering path.
        throw new OrderValidationError(
          `Modifier "${optionName || optionId || "unknown"}" is not available for "${authoritativeName}".`
        );
      }
      if (!match.option.isAvailable) {
        throw new OrderValidationError(
          `Modifier "${match.option.name}" is currently unavailable for "${authoritativeName}".`
        );
      }

      return {
        groupName: match.group.name,
        optionName: match.option.name,
        // Catalog delta only; `m.priceDelta` is intentionally ignored.
        priceDeltaMinor: moneyOrThrow(
          match.option.priceDelta,
          `Invalid catalog price for modifier "${match.option.name}".`
        ),
      };
    });

    const modifiersDeltaMinor = validatedModifiers.reduce((sum, m) => sum + m.priceDeltaMinor, 0);

    return {
      dishId: item.dishId || null,
      dishName: authoritativeName,
      quantity: qty,
      unitPriceMinor: authoritativeBasePriceMinor + modifiersDeltaMinor,
      station,
      modifiers: validatedModifiers,
    };
  });

  const subtotalMinor = validatedItems.reduce(
    (sum, item) => sum + item.unitPriceMinor * item.quantity,
    0
  );

  if (subtotalMinor <= 0) {
    throw new OrderValidationError("Order subtotal must be greater than zero.");
  }

  // Plan quota (Phase 9): throws PlanLimitError before anything is written.
  await assertWithinPlan(tenant.id, "ordersPerMonth");

  let couponDiscountMinor = 0;
  let appliedCoupon: string | null = null;
  if (input.couponCode) {
    const couponResult = await resolveCoupon(input.couponCode, subtotalMinor, tenant.id);
    if (couponResult.valid && couponResult.discountMinorUnits > 0) {
      couponDiscountMinor = Math.min(subtotalMinor, couponResult.discountMinorUnits);
      appliedCoupon = couponResult.code ?? null;
    }
  }

  let loyaltyDiscountMinor = 0;
  let pointsUsed = 0;
  let loyaltyCustomerId: string | null = null;
  if (input.loyaltyPointsToRedeem && input.loyaltyPointsToRedeem >= 100) {
    const customer = await db.customerUser.findUnique({
      where: { email: input.customerEmail.toLowerCase().trim() },
    });
    if (customer && customer.loyaltyPoints >= input.loyaltyPointsToRedeem) {
      pointsUsed = input.loyaltyPointsToRedeem;
      loyaltyCustomerId = customer.id;
      loyaltyDiscountMinor = loyaltyDiscountMinorUnits(pointsUsed);
    }
  }

  let tipMinor = 0;
  if (input.tip !== undefined && input.tip !== null) {
    tipMinor = Math.max(0, moneyOrThrow(input.tip, "Invalid tip amount."));
  }

  // One rule, shared with the storefront: see `lib/money/cart.ts`.
  const cart = priceCart({
    subtotalMinorUnits: subtotalMinor,
    couponDiscountMinorUnits: couponDiscountMinor,
    loyaltyDiscountMinorUnits: loyaltyDiscountMinor,
    tipMinorUnits: tipMinor,
    taxRatePercent: resolveTaxRatePercent(tenant),
  });

  const totalDiscountMinor = cart.discountMinorUnits;
  const taxMinor = cart.taxMinorUnits;
  const totalMinor = cart.totalMinorUnits;

  const diningMode: DiningMode = input.diningMode || "TAKEAWAY";
  const pickupTime = input.pickupTime?.trim() || (diningMode === "DINE_IN" ? "DINE-IN" : "ASAP (~20–30 mins)");

  // Online orders start in PENDING state until confirmed via a gateway signature
  // or webhook, unless a trusted B2B caller explicitly states otherwise.
  const paymentStatus: PaymentStatus =
    input.paymentStatus ??
    (input.paymentMethod === "CARD_ONLINE" ? "PENDING" : "PAY_AT_PICKUP");

  const orderData = {
    tenantId: tenant.id,
    customerName: input.customerName.trim(),
    customerEmail: input.customerEmail.toLowerCase().trim(),
    customerPhone: input.customerPhone.trim(),
    pickupTime,
    diningMode,
    tableNumber: input.tableNumber?.trim() || null,
    tip: toDecimalString(tipMinor),
    specialInstructions: input.specialInstructions?.trim() || null,
    subtotal: toDecimalString(subtotalMinor),
    tax: toDecimalString(taxMinor),
    discount: toDecimalString(totalDiscountMinor),
    total: toDecimalString(totalMinor),
    loyaltyPointsUsed: pointsUsed,
    paymentStatus,
    orderStatus: "PENDING" as const,
    couponCode: appliedCoupon,
    items: {
      create: validatedItems.map((item) => ({
        dishId: item.dishId,
        dishName: item.dishName,
        quantity: item.quantity,
        price: toDecimalString(item.unitPriceMinor),
        station: item.station,
        isCompleted: false,
        modifiers: item.modifiers.length > 0
          ? {
              create: item.modifiers.map((m) => ({
                groupName: m.groupName,
                optionName: m.optionName,
                priceDelta: toDecimalString(m.priceDeltaMinor),
              })),
            }
          : undefined,
      })),
    },
  };

  // Order creation and loyalty redemption commit together. The redemption is a
  // conditional decrement, so two concurrent orders cannot both spend the same
  // points: the loser matches zero rows and the whole transaction rolls back.
  // A unique order-number collision aborts and rolls back the transaction too,
  // so the retry below starts from a clean slate.
  const createWithRetry = async () => {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await db.$transaction(async (tx) => {
          if (pointsUsed > 0 && loyaltyCustomerId) {
            const redeemed = await tx.customerUser.updateMany({
              where: {
                id: loyaltyCustomerId,
                loyaltyPoints: { gte: pointsUsed },
              },
              data: { loyaltyPoints: { decrement: pointsUsed } },
            });
            if (redeemed.count === 0) {
              throw new OrderValidationError(
                "Your loyalty-point balance changed. Please refresh and try again."
              );
            }
          }

          const created = await tx.order.create({
            data: { ...orderData, orderNumber: generateOrderNumber() },
            include: { items: { include: { modifiers: true } } },
          });

          // The ledger entry is written only after the decrement succeeded, in
          // the same transaction, so the balance and the audit trail agree.
          if (pointsUsed > 0 && loyaltyCustomerId) {
            await tx.loyaltyLedger.create({
              data: {
                customerId: loyaltyCustomerId,
                orderId: created.id,
                pointsDelta: -pointsUsed,
                reason: `Redeemed ${pointsUsed} points for ₹${toMajorUnits(loyaltyDiscountMinor)} discount`,
              },
            });
          }

          // Receipt goes to the durable outbox in the SAME transaction: it exists
          // if and only if the order does. Skipped when email is unconfigured.
          if (created.customerEmail && isEmailConfigured()) {
            await enqueueOutboxEvent(tx, {
              tenantId: created.tenantId,
              type: ORDER_RECEIPT_EVENT,
              payload: {
                customerName: created.customerName,
                customerEmail: created.customerEmail,
                orderNumber: created.orderNumber,
                pickupTime: created.pickupTime,
                total: Number(created.total),
                items: created.items.map((item) => ({
                  dishName: item.dishName,
                  quantity: item.quantity,
                  price: Number(item.price),
                })),
              },
            });
          }

          return created;
        });
      } catch (error) {
        if ((error as { code?: string }).code === "P2002" && attempt < 3) continue;
        throw error;
      }
    }
    throw new Error("Could not allocate a unique order number after 3 attempts.");
  };

  const order = await createWithRetry();

  // Deplete inventory and auto-86 if stock reaches 0
  await depleteInventoryForOrder(order.id).catch((err) =>
    deferOrderStep(ORDER_INVENTORY_EVENT, order, err)
  );

  // Table occupancy if Dine-In
  if (order.diningMode === "DINE_IN" && order.tableNumber) {
    await occupyTableWithOrder(order.tableNumber, order.id).catch((err) => {
      console.error("occupyTableWithOrder error:", err);
    });
  }

  // Award customer loyalty points
  await processLoyaltyForOrder(order.id).catch((err) =>
    deferOrderStep(ORDER_LOYALTY_EVENT, order, err)
  );

  const tenantId = order.tenantId;
  broadcastEvent({
    type: "order:created",
    tenantId,
    timestamp: new Date().toISOString(),
    data: {
      id: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      diningMode: order.diningMode,
      tableNumber: order.tableNumber,
      tip: Number(order.tip),
      total: Number(order.total),
      pickupTime: order.pickupTime,
      items: order.items,
    },
  });

  dispatchWebhook({
    event: "order.created",
    tenantId,
    data: {
      id: order.id,
      orderNumber: order.orderNumber,
      diningMode: order.diningMode,
      tableNumber: order.tableNumber,
      tip: Number(order.tip),
      total: Number(order.total),
      customerName: order.customerName,
      pickupTime: order.pickupTime,
      items: order.items,
    },
  }).catch(() => {});

  // Opportunistic drain after the response; the cron route is the guaranteed path.
  try {
    after(() => processOutbox(5).catch(() => {}));
  } catch {
    // Not inside a Next request scope (e.g. the Express adapter or tests).
  }

  return order;
}

/** A post-order step failed: log it and queue a retry instead of losing it. */
async function deferOrderStep(type: string, order: { id: string; tenantId: string }, err: unknown) {
  console.error(`${type} failed for order ${order.id}:`, err);
  await enqueueOutboxEvent(db, { tenantId: order.tenantId, type, payload: { orderId: order.id } }).catch(
    (queueErr) => console.error(`${type} could not be queued for order ${order.id}:`, queueErr)
  );
}

export async function getOrderById(id: string) {
  try {
    return await db.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            modifiers: true,
          },
        },
      },
    });
  } catch {
    return null;
  }
}

export async function getOrderByNumber(orderNumber: string) {
  try {
    return await db.order.findUnique({
      where: { orderNumber: orderNumber.toUpperCase().trim() },
      include: {
        items: {
          include: {
            modifiers: true,
          },
        },
      },
    });
  } catch {
    return null;
  }
}

export async function listOrdersAdmin(options?: {
  status?: OrderStatus;
  page?: number;
  pageSize?: number;
  tenantId?: string;
}) {
  try {
    const page = Math.max(1, options?.page ?? 1);
    const pageSize = Math.max(1, Math.min(100, options?.pageSize ?? 30));
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = options?.tenantId ? { tenantId: options.tenantId } : {};
    if (options?.status) {
      where.orderStatus = options.status;
    }

    const [items, total] = await Promise.all([
      db.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        include: {
          items: {
            include: {
              modifiers: true,
            },
          },
        },
      }),
      db.order.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  } catch (error) {
    console.error("listOrdersAdmin error:", error);
    return { items: [], total: 0, page: 1, pageSize: 30, totalPages: 0 };
  }
}

export async function updateOrderStatus(
  id: string,
  status: OrderStatus,
  actorId?: string | null,
  tenantId?: string
) {
  // With a tenantId, an id from another tenant matches nothing and Prisma throws P2025.
  const updated = await db.order.update({
    where: tenantId ? { id, tenantId } : { id },
    data: { orderStatus: status },
  });

  await logAction({
    actorId,
    action: "ORDER_STATUS_CHANGED",
    entityType: "Order",
    entityId: id,
    metadata: { newStatus: status, orderNumber: updated.orderNumber },
  });

  broadcastEvent({
    type: "order:status_changed",
    tenantId: updated.tenantId,
    timestamp: new Date().toISOString(),
    data: {
      id: updated.id,
      orderNumber: updated.orderNumber,
      orderStatus: updated.orderStatus,
    },
  });

  dispatchWebhook({
    event: "order.status_changed",
    tenantId: updated.tenantId,
    data: {
      id: updated.id,
      orderNumber: updated.orderNumber,
      orderStatus: updated.orderStatus,
    },
  }).catch(() => {});

  if ((status === "COMPLETED" || status === "CANCELLED") && updated.tableNumber) {
    await freeTable(updated.tableNumber).catch(() => {});
  }

  return updated;
}

export async function updateOrderItemCompletion(
  orderItemId: string,
  isCompleted: boolean,
  tenantId?: string
) {
  const item = await db.orderItem.update({
    where: tenantId ? { id: orderItemId, order: { tenantId } } : { id: orderItemId },
    data: { isCompleted },
    include: {
      order: {
        include: {
          items: true,
        },
      },
    },
  });

  // Check if all items for this order are completed; if so, advance order to READY
  const allCompleted = item.order.items.every((i) => i.isCompleted);
  if (
    allCompleted &&
    (item.order.orderStatus === "PREPARING" || item.order.orderStatus === "CONFIRMED")
  ) {
    await updateOrderStatus(item.order.id, "READY");
  }

  broadcastEvent({
    type: "kds:item_bumped",
    tenantId: item.order.tenantId,
    timestamp: new Date().toISOString(),
    data: {
      orderId: item.order.id,
      orderItemId: item.id,
      isCompleted: item.isCompleted,
      allCompleted,
    },
  });

  return item;
}

export async function getOrderStats(tenantId?: string) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const scope = tenantId ? { tenantId } : {};

    const [activeOrders, completedToday, totalRevenueAgg] = await Promise.all([
      db.order.count({
        where: { ...scope, orderStatus: { in: ["PENDING", "CONFIRMED", "PREPARING", "READY"] } },
      }),
      db.order.count({
        where: {
          ...scope,
          orderStatus: "COMPLETED",
          createdAt: { gte: today },
        },
      }),
      db.order.aggregate({
        where: { ...scope, orderStatus: { not: "CANCELLED" }, createdAt: { gte: today } },
        _sum: { total: true },
      }),
    ]);

    return {
      activeOrders,
      completedToday,
      todayRevenue: Number(totalRevenueAgg._sum.total ?? 0),
    };
  } catch (error) {
    console.error("getOrderStats error:", error);
    return { activeOrders: 0, completedToday: 0, todayRevenue: 0 };
  }
}

