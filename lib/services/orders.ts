import "server-only";

import { db } from "@/lib/db/prisma";
import { logAction } from "@/lib/services/audit";
import { broadcastEvent } from "@/lib/realtime/bus";
import { dispatchWebhook } from "@/lib/webhooks/dispatcher";
import type { OrderStatus, PaymentStatus } from "@/lib/generated/prisma/enums";

export interface OrderItemInput {
  dishId?: string;
  dishName: string;
  quantity: number;
  price: number;
}

export interface CreateOrderInput {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  pickupTime: string;
  specialInstructions?: string;
  items: OrderItemInput[];
  couponCode?: string;
  paymentMethod?: "PAY_AT_PICKUP" | "CARD_ONLINE";
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

export function generateOrderNumber(): string {
  const digits = Math.floor(1000 + Math.random() * 9000);
  return `ORD-${digits}`;
}

export async function createOrder(input: CreateOrderInput) {
  if (!input.items || input.items.length === 0) {
    throw new Error("Order must have at least one item.");
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
          select: { id: true, name: true, price: true, isAvailable: true },
        })
      : [];

  const dishMap = new Map(dbDishes.map((d) => [d.id, d]));

  const validatedItems = input.items.map((item) => {
    const qty = Math.floor(Number(item.quantity));
    if (!Number.isInteger(qty) || qty < 1 || qty > 99) {
      throw new Error(`Invalid quantity for "${item.dishName}". Must be between 1 and 99.`);
    }

    let authoritativePrice = Number(item.price);
    let authoritativeName = item.dishName.trim();

    if (item.dishId) {
      const dbDish = dishMap.get(item.dishId);
      if (!dbDish) {
        throw new Error(`Dish "${item.dishName}" is no longer available.`);
      }
      if (!dbDish.isAvailable) {
        throw new Error(`Dish "${dbDish.name}" is currently marked out of stock.`);
      }
      authoritativePrice = Number(dbDish.price);
      authoritativeName = dbDish.name;
    } else {
      if (typeof authoritativePrice !== "number" || isNaN(authoritativePrice) || authoritativePrice <= 0) {
        throw new Error(`Invalid price for item "${item.dishName}".`);
      }
    }

    return {
      dishId: item.dishId || null,
      dishName: authoritativeName,
      quantity: qty,
      price: authoritativePrice,
    };
  });

  const subtotal = validatedItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  if (subtotal <= 0) {
    throw new Error("Order subtotal must be greater than zero.");
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

  // Standard 5% restaurant GST
  const taxableAmount = Math.max(0, subtotal - discount);
  const tax = Math.round(taxableAmount * 0.05);
  const total = taxableAmount + tax;

  const orderNumber = generateOrderNumber();
  // Online orders start in PENDING state until confirmed via gateway signature or webhook
  const paymentStatus: PaymentStatus =
    input.paymentMethod === "CARD_ONLINE" ? "PENDING" : "PAY_AT_PICKUP";

  const order = await db.order.create({
    data: {
      orderNumber,
      customerName: input.customerName.trim(),
      customerEmail: input.customerEmail.toLowerCase().trim(),
      customerPhone: input.customerPhone.trim(),
      pickupTime: input.pickupTime,
      specialInstructions: input.specialInstructions?.trim() || null,
      subtotal,
      tax,
      discount,
      total,
      paymentStatus,
      orderStatus: "PENDING",
      couponCode: appliedCoupon,
      items: {
        create: validatedItems.map((item) => ({
          dishId: item.dishId,
          dishName: item.dishName,
          quantity: item.quantity,
          price: item.price,
        })),
      },
    },
    include: {
      items: true,
    },
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
      total: Number(order.total),
      customerName: order.customerName,
      pickupTime: order.pickupTime,
    },
  }).catch(() => {});

  return order;
}

export async function getOrderById(id: string) {
  try {
    return await db.order.findUnique({
      where: { id },
      include: { items: true },
    });
  } catch {
    return null;
  }
}

export async function getOrderByNumber(orderNumber: string) {
  try {
    return await db.order.findUnique({
      where: { orderNumber: orderNumber.toUpperCase().trim() },
      include: { items: true },
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
        include: { items: true },
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

  return updated;
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
