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

  const subtotal = input.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  let discount = 0;
  let appliedCoupon: string | null = null;
  if (input.couponCode) {
    const couponResult = await validateCoupon(input.couponCode, subtotal);
    if (couponResult.valid && couponResult.discountAmount) {
      discount = couponResult.discountAmount;
      appliedCoupon = couponResult.code ?? null;
    }
  }

  // Standard 5% restaurant GST
  const taxableAmount = Math.max(0, subtotal - discount);
  const tax = Math.round(taxableAmount * 0.05);
  const total = taxableAmount + tax;

  const orderNumber = generateOrderNumber();
  const paymentStatus: PaymentStatus =
    input.paymentMethod === "CARD_ONLINE" ? "PAID" : "PAY_AT_PICKUP";

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
        create: input.items.map((item) => ({
          dishId: item.dishId || null,
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
