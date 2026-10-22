import { z } from "zod";

const orderItemSchema = z.object({
  dishId: z.string().uuid().optional(),
  dishName: z.string().min(1).max(200),
  quantity: z.number().int().positive().max(50),
  // Accepted only for ad-hoc items without a dishId. When dishId is present the
  // server always uses the authoritative catalog price and ignores this field.
  price: z.number().positive().optional(),
  station: z.string().max(40).optional(),
  modifiers: z
    .array(
      z.object({
        groupName: z.string().min(1).max(80),
        optionName: z.string().min(1).max(80),
        priceDelta: z.number().nonnegative(),
      })
    )
    .optional(),
});

export const createOrderSchema = z.object({
  customerName: z.string().min(2).max(100),
  customerEmail: z.string().email(),
  customerPhone: z.string().min(8).max(20),
  pickupTime: z.string().max(80).optional(),
  diningMode: z.enum(["DINE_IN", "TAKEAWAY", "DELIVERY"]).optional(),
  tableNumber: z.string().max(20).optional(),
  tip: z.number().nonnegative().max(100000).optional(),
  specialInstructions: z.string().max(500).optional(),
  items: z.array(orderItemSchema).min(1, "At least one item is required"),
  couponCode: z.string().max(40).optional(),
  loyaltyPointsToRedeem: z.number().int().nonnegative().optional(),
  paymentMethod: z.enum(["PAY_AT_PICKUP", "CARD_ONLINE"]).optional(),
  paymentStatus: z.enum(["PENDING", "PAID", "PAY_AT_PICKUP"]).optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
