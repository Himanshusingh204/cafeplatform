import "server-only";

import { randomBytes } from "node:crypto";

import { db } from "@/lib/db/prisma";
import { logAction } from "@/lib/services/audit";
import { broadcastEvent } from "@/lib/realtime/bus";
import { dispatchWebhook } from "@/lib/webhooks/dispatcher";
import { depleteInventoryForOrder } from "@/lib/services/inventory";
import { occupyTableWithOrder, freeTable } from "@/lib/services/tables";
import { processLoyaltyForOrder, redeemPoints } from "@/lib/services/loyalty";
import { sendOrderReceipt } from "@/lib/email/notifier";
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

export interface OrderItemModifierInput {
  groupName: string;
  optionName: string;
  priceDelta: number;
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
  /** Owning tenant. Omit only for legacy, tenant-less orders. */
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
}

export async function validateCoupon(code: string, subtotal: number) {
  try {
    const coupon = await db.coupon.findUnique({
      where: { code: code.toUpperCase().trim() },
    });

    if (!coupon || !coupon.isActive) {
      return { valid: false, message: "Invalid or expired coupon code" };
    }

    if (coupon.validUntil && coupon.validUntil < new Date()) {
      return { valid: false, message: "Coupon has expired" };
    }

    if (coupon.minOrder && subtotal < Number(coupon.minOrder)) {
      return {
        valid: false,
        message: `Minimum order amount of ₹${coupon.minOrder} required for this coupon`,
      };
    }

    const discountAmount = Math.round((subtotal * coupon.discountPercent) / 100);
    return {
      valid: true,
      code: coupon.code,
      discountPercent: coupon.discountPercent,
      discountAmount,
    };
  } catch {
    return { valid: false, message: "Error validating coupon code" };
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

  // Security Check: Look up authoritative dishes from the database when dishId is supplied.
  // This prevents attackers from tampering with client prices (e.g. buying a ₹350 dish for ₹1).
  const dishIds = input.items
    .map((item) => item.dishId)
    .filter((id): id is string => Boolean(id));

  const dbDishes =
    dishIds.length > 0
      ? await db.dish.findMany({
          where: { id: { in: dishIds }, deletedAt: null },
          select: { id: true, name: true, price: true, isAvailable: true, station: true },
        })
      : [];

  const dishMap = new Map(dbDishes.map((d) => [d.id, d]));

  const validatedItems = input.items.map((item) => {
    const qty = Math.floor(Number(item.quantity));
    if (!Number.isInteger(qty) || qty < 1 || qty > 99) {
      throw new OrderValidationError(`Invalid quantity for "${item.dishName}". Must be between 1 and 99.`);
    }

    let authoritativeBasePrice = Number(item.price);
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
      authoritativeBasePrice = Number(dbDish.price);
      authoritativeName = dbDish.name;
      station = dbDish.station || station;
    } else {
      if (typeof authoritativeBasePrice !== "number" || isNaN(authoritativeBasePrice) || authoritativeBasePrice <= 0) {
        throw new OrderValidationError(`Invalid price for item "${item.dishName}".`);
      }
    }

    const validatedModifiers = (item.modifiers || []).map((m) => ({
      groupName: String(m.groupName || "").trim(),
      optionName: String(m.optionName || "").trim(),
      priceDelta: Math.max(0, Number(m.priceDelta || 0)),
    }));

    const modifiersDelta = validatedModifiers.reduce((sum, m) => sum + m.priceDelta, 0);
    const unitPrice = authoritativeBasePrice + modifiersDelta;

    return {
      dishId: item.dishId || null,
      dishName: authoritativeName,
      quantity: qty,
      price: unitPrice,
      station,
      modifiers: validatedModifiers,
    };
  });

  const subtotal = validatedItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  if (subtotal <= 0) {
    throw new OrderValidationError("Order subtotal must be greater than zero.");
  }

  let discount = 0;
  let appliedCoupon: string | null = null;
  if (input.couponCode) {
    const couponResult = await validateCoupon(input.couponCode, subtotal);
    if (couponResult.valid && couponResult.discountAmount) {
      discount = Math.min(subtotal, couponResult.discountAmount);
      appliedCoupon = couponResult.code ?? null;
    }
  }

  let loyaltyDiscount = 0;
  let pointsUsed = 0;
  if (input.loyaltyPointsToRedeem && input.loyaltyPointsToRedeem >= 100) {
    const customer = await db.customerUser.findUnique({
      where: { email: input.customerEmail.toLowerCase().trim() },
    });
    if (customer && customer.loyaltyPoints >= input.loyaltyPointsToRedeem) {
      pointsUsed = input.loyaltyPointsToRedeem;
      loyaltyDiscount = Math.floor(pointsUsed / 100) * 50;
    }
  }

  const totalDiscount = Math.min(subtotal, discount + loyaltyDiscount);
  const tip = Math.max(0, Math.round(Number(input.tip || 0)));
  // Standard 5% restaurant GST
  const taxableAmount = Math.max(0, subtotal - totalDiscount);
  const tax = Math.round(taxableAmount * 0.05);
  const total = taxableAmount + tax + tip;

  const diningMode: DiningMode = input.diningMode || "TAKEAWAY";
  const pickupTime = input.pickupTime?.trim() || (diningMode === "DINE_IN" ? "DINE-IN" : "ASAP (~20–30 mins)");

  // Online orders start in PENDING state until confirmed via a gateway signature
  // or webhook, unless a trusted B2B caller explicitly states otherwise.
  const paymentStatus: PaymentStatus =
    input.paymentStatus ??
    (input.paymentMethod === "CARD_ONLINE" ? "PENDING" : "PAY_AT_PICKUP");

  const orderData = {
    tenantId: input.tenantId ?? null,
    customerName: input.customerName.trim(),
    customerEmail: input.customerEmail.toLowerCase().trim(),
    customerPhone: input.customerPhone.trim(),
    pickupTime,
    diningMode,
    tableNumber: input.tableNumber?.trim() || null,
    tip,
    specialInstructions: input.specialInstructions?.trim() || null,
    subtotal,
    tax,
    discount: totalDiscount,
    total,
    loyaltyPointsUsed: pointsUsed,
    paymentStatus,
    orderStatus: "PENDING" as const,
    couponCode: appliedCoupon,
    items: {
      create: validatedItems.map((item) => ({
        dishId: item.dishId,
        dishName: item.dishName,
        quantity: item.quantity,
        price: item.price,
        station: item.station,
        isCompleted: false,
        modifiers: item.modifiers.length > 0
          ? {
              create: item.modifiers.map((m) => ({
                groupName: m.groupName,
                optionName: m.optionName,
                priceDelta: m.priceDelta,
              })),
            }
          : undefined,
      })),
    },
  };

  // Retry with a fresh number if the generated one collides on the unique index.
  const createWithRetry = async () => {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await db.order.create({
          data: { ...orderData, orderNumber: generateOrderNumber() },
          include: { items: { include: { modifiers: true } } },
        });
      } catch (error) {
        if ((error as { code?: string }).code === "P2002" && attempt < 3) continue;
        throw error;
      }
    }
    throw new Error("Could not allocate a unique order number after 3 attempts.");
  };

  const order = await createWithRetry();

  // Deduct redeemed loyalty points if any
  if (pointsUsed > 0) {
    const customer = await db.customerUser.findUnique({
      where: { email: order.customerEmail },
    });
    if (customer) {
      await redeemPoints(customer.id, pointsUsed, order.id).catch(() => {});
    }
  }

  // Deplete inventory and auto-86 if stock reaches 0
  await depleteInventoryForOrder(order.id).catch((err) => {
    console.error("depleteInventoryForOrder error:", err);
  });

  // Table occupancy if Dine-In
  if (order.diningMode === "DINE_IN" && order.tableNumber) {
    await occupyTableWithOrder(order.tableNumber, order.id).catch((err) => {
      console.error("occupyTableWithOrder error:", err);
    });
  }

  // Award customer loyalty points
  await processLoyaltyForOrder(order.id).catch((err) => {
    console.error("processLoyaltyForOrder error:", err);
  });

  const tenantId = order.tenantId || "spice-saffron";
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

  // Best-effort customer receipt. Phase 3 replaces this direct call with the
  // durable outbox so it survives a deploy; today it must never fail an order.
  void sendOrderReceipt({
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    orderNumber: order.orderNumber,
    pickupTime: order.pickupTime,
    total: Number(order.total),
    items: order.items.map((item) => ({
      dishName: item.dishName,
      quantity: item.quantity,
      price: Number(item.price),
    })),
  }).catch(() => {});

  return order;
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
}) {
  try {
    const page = Math.max(1, options?.page ?? 1);
    const pageSize = Math.max(1, Math.min(100, options?.pageSize ?? 30));
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = {};
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
  actorId?: string | null
) {
  const updated = await db.order.update({
    where: { id },
    data: { orderStatus: status },
  });

  await logAction({
    actorId,
    action: "ORDER_STATUS_CHANGED",
    entityType: "Order",
    entityId: id,
    metadata: { newStatus: status, orderNumber: updated.orderNumber },
  });

  const tenantId = updated.tenantId || "spice-saffron";
  broadcastEvent({
    type: "order:status_changed",
    tenantId,
    timestamp: new Date().toISOString(),
    data: {
      id: updated.id,
      orderNumber: updated.orderNumber,
      orderStatus: updated.orderStatus,
    },
  });

  dispatchWebhook({
    event: "order.status_changed",
    tenantId,
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
  isCompleted: boolean
) {
  const item = await db.orderItem.update({
    where: { id: orderItemId },
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

  const tenantId = item.order.tenantId || "spice-saffron";
  broadcastEvent({
    type: "kds:item_bumped",
    tenantId,
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

export async function getOrderStats() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [activeOrders, completedToday, totalRevenueAgg] = await Promise.all([
      db.order.count({
        where: { orderStatus: { in: ["PENDING", "CONFIRMED", "PREPARING", "READY"] } },
      }),
      db.order.count({
        where: {
          orderStatus: "COMPLETED",
          createdAt: { gte: today },
        },
      }),
      db.order.aggregate({
        where: { orderStatus: { not: "CANCELLED" }, createdAt: { gte: today } },
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

