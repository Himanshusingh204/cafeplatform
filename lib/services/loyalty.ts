import "server-only";

import { db } from "@/lib/db/prisma";
import { Prisma } from "@/lib/generated/prisma/client";
import { toMajorUnits } from "@/lib/money";
import { loyaltyDiscountMinorUnits } from "@/config/pricing";
import type { LoyaltyTier } from "@/lib/generated/prisma/enums";

export interface CustomerProfileInput {
  email: string;
  name: string;
  phone?: string;
  tenantId?: string;
}

export const TIER_CONFIG: Record<
  LoyaltyTier,
  {
    name: string;
    minSpend: number;
    multiplier: number;
    badgeColor: string;
    perks: string[];
  }
> = {
  BRONZE: {
    name: "Bronze Member",
    minSpend: 0,
    multiplier: 1.0,
    badgeColor: "bg-amber-700/20 text-amber-700 border-amber-600/30",
    perks: ["10 pts per ₹100 spent", "Birthday surprise chai"],
  },
  SILVER: {
    name: "Silver VIP",
    minSpend: 5000,
    multiplier: 1.25,
    badgeColor: "bg-slate-300/20 text-slate-300 border-slate-400/30",
    perks: ["1.25x points multiplier", "Priority table waitlist", "Free Gulab Jamun on orders > ₹1000"],
  },
  GOLD: {
    name: "Gold Connoisseur",
    minSpend: 15000,
    multiplier: 1.5,
    badgeColor: "bg-amber-500/20 text-amber-400 border-amber-500/40",
    perks: ["1.5x points multiplier", "Dedicated table reservation", "Complimentary chef tasting starter"],
  },
  PLATINUM: {
    name: "Platinum Maharaja",
    minSpend: 30000,
    multiplier: 2.0,
    badgeColor: "bg-purple-500/20 text-purple-300 border-purple-500/40",
    perks: ["2x points multiplier", "Instant table seating", "Secret seasonal menu access", "Direct manager concierge"],
  },
};

/**
 * Determine tier based on lifetime spend
 */
export function calculateTier(lifetimeSpend: number): LoyaltyTier {
  if (lifetimeSpend >= 30000) return "PLATINUM";
  if (lifetimeSpend >= 15000) return "GOLD";
  if (lifetimeSpend >= 5000) return "SILVER";
  return "BRONZE";
}

/**
 * Calculate points earned based on subtotal and tier
 */
export function calculatePointsEarned(subtotal: number, tier: LoyaltyTier): number {
  const basePoints = (subtotal / 100) * 10;
  const multiplier = TIER_CONFIG[tier]?.multiplier || 1.0;
  return Math.max(0, Math.floor(basePoints * multiplier));
}

/**
 * Find or create a CustomerUser profile
 */
export async function findOrCreateCustomer(input: CustomerProfileInput) {
  const email = input.email.toLowerCase().trim();

  let customer = await db.customerUser.findUnique({
    where: { email },
  });

  if (!customer) {
    customer = await db.customerUser.create({
      data: {
        email,
        name: input.name.trim(),
        phone: input.phone?.trim() || null,
        tenantId: input.tenantId || null,
        loyaltyPoints: 0,
        loyaltyTier: "BRONZE",
        lifetimeSpend: new Prisma.Decimal(0),
      },
    });
  } else if (input.phone && !customer.phone) {
    // Fill in phone if missing
    customer = await db.customerUser.update({
      where: { id: customer.id },
      data: { phone: input.phone.trim() },
    });
  }

  return customer;
}

/**
 * Process loyalty rewards when an order is created or confirmed
 */
export async function processLoyaltyForOrder(orderId: string) {
  const order = await db.order.findUnique({
    where: { id: orderId },
  });

  if (!order || !order.customerEmail) {
    return null;
  }

  const customer = await findOrCreateCustomer({
    email: order.customerEmail,
    name: order.customerName,
    phone: order.customerPhone,
    tenantId: order.tenantId || undefined,
  });

  const subtotal = Number(order.subtotal);
  const currentTier = customer.loyaltyTier;
  const pointsEarned = calculatePointsEarned(subtotal, currentTier);

  // One transaction with atomic increments: concurrent orders or a redemption
  // cannot overwrite each other's balance, and a failure leaves nothing half-written
  // so the whole step can be retried safely.
  const updated = await db.$transaction(async (tx) => {
    const alreadyAwarded = await tx.loyaltyLedger.findFirst({
      where: { orderId: order.id, pointsDelta: { gt: 0 } },
      select: { id: true },
    });
    if (alreadyAwarded) return null;

    const bumped = await tx.customerUser.update({
      where: { id: customer.id },
      data: {
        loyaltyPoints: { increment: pointsEarned },
        lifetimeSpend: { increment: new Prisma.Decimal(subtotal) },
      },
    });
    const tier = calculateTier(Number(bumped.lifetimeSpend));
    if (tier !== bumped.loyaltyTier) {
      await tx.customerUser.update({ where: { id: customer.id }, data: { loyaltyTier: tier } });
    }

    if (pointsEarned > 0) {
      await tx.loyaltyLedger.create({
        data: {
          customerId: customer.id,
          orderId: order.id,
          pointsDelta: pointsEarned,
          reason: `Earned on order ${order.orderNumber} (${pointsEarned} pts at ${TIER_CONFIG[currentTier]?.name || currentTier})`,
        },
      });
    }

    await tx.order.update({
      where: { id: order.id },
      data: { customerUserId: customer.id, loyaltyPointsEarned: pointsEarned },
    });
    return { newPoints: bumped.loyaltyPoints, tier };
  });
  if (!updated) return null;
  const { newPoints, tier: newTier } = updated;

  return {
    customerId: customer.id,
    pointsEarned,
    newBalance: newPoints,
    tier: newTier,
  };
}

/**
 * Redeem loyalty points for a discount (100 pts = ₹50 discount).
 *
 * The value of a redemption block lives in `config/pricing.ts`, shared with the
 * order service, so what the customer is charged and what the ledger records can
 * never disagree.
 */
export async function redeemPoints(
  customerId: string,
  pointsToRedeem: number,
  orderId?: string
) {
  if (pointsToRedeem <= 0) {
    throw new Error("Points to redeem must be greater than zero.");
  }

  const customer = await db.customerUser.findUnique({
    where: { id: customerId },
  });

  if (!customer) {
    throw new Error("Customer not found.");
  }

  if (customer.loyaltyPoints < pointsToRedeem) {
    throw new Error(
      `Insufficient points. Balance: ${customer.loyaltyPoints}, Requested: ${pointsToRedeem}`
    );
  }

  const discountAmount = toMajorUnits(loyaltyDiscountMinorUnits(pointsToRedeem));

  const updatedCustomer = await db.customerUser.update({
    where: { id: customerId },
    data: {
      loyaltyPoints: customer.loyaltyPoints - pointsToRedeem,
    },
  });

  await db.loyaltyLedger.create({
    data: {
      customerId,
      orderId: orderId || null,
      pointsDelta: -pointsToRedeem,
      reason: `Redeemed ${pointsToRedeem} points for ₹${discountAmount} discount`,
    },
  });

  return {
    remainingPoints: updatedCustomer.loyaltyPoints,
    discountAmount,
  };
}

/**
 * Get comprehensive customer loyalty profile including past orders for 1-click reorder
 */
export async function getCustomerLoyaltyProfile(emailOrId: string) {
  const isEmail = emailOrId.includes("@");

  const customer = await db.customerUser.findFirst({
    where: isEmail ? { email: emailOrId.toLowerCase().trim() } : { id: emailOrId },
    include: {
      ledgerEntries: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      orders: {
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          items: {
            include: {
              modifiers: true,
            },
          },
        },
      },
    },
  });

  if (!customer) {
    return null;
  }

  const tierMeta = TIER_CONFIG[customer.loyaltyTier];
  const nextTierThreshold =
    customer.loyaltyTier === "BRONZE"
      ? 5000
      : customer.loyaltyTier === "SILVER"
      ? 15000
      : customer.loyaltyTier === "GOLD"
      ? 30000
      : null;

  const lifetimeSpend = Number(customer.lifetimeSpend);
  const spendToNextTier = nextTierThreshold ? Math.max(0, nextTierThreshold - lifetimeSpend) : 0;

  return {
    id: customer.id,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    loyaltyPoints: customer.loyaltyPoints,
    tier: customer.loyaltyTier,
    tierName: tierMeta.name,
    tierPerks: tierMeta.perks,
    badgeColor: tierMeta.badgeColor,
    lifetimeSpend,
    nextTierThreshold,
    spendToNextTier,
    recentLedger: customer.ledgerEntries.map((l) => ({
      id: l.id,
      pointsDelta: l.pointsDelta,
      reason: l.reason,
      createdAt: l.createdAt,
    })),
    recentOrders: customer.orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      total: Number(o.total),
      diningMode: o.diningMode,
      createdAt: o.createdAt,
      items: o.items.map((it) => ({
        dishId: it.dishId,
        dishName: it.dishName,
        quantity: it.quantity,
        price: Number(it.price),
        modifiers: it.modifiers.map((m) => ({
          groupName: m.groupName,
          optionName: m.optionName,
          priceDelta: Number(m.priceDelta),
        })),
      })),
    })),
  };
}
