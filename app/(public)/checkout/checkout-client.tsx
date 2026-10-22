"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Clock, CreditCard, ShieldCheck, ShoppingBag, Tag, AlertCircle, Utensils, Heart } from "lucide-react";
import { useCart } from "@/hooks/use-cart";
import { formatPrice } from "@/lib/utils/format";
import { toMajorUnits } from "@/lib/money";
import { priceCart, tipFromPercent, toMinorUnitsOrZero } from "@/lib/money/cart";
import { loyaltyDiscountMinorUnits } from "@/config/pricing";
import { checkCouponAction, submitTakeawayOrderAction } from "@/lib/actions/public";
import { initiateOrderPaymentAction, verifyClientPaymentAction } from "@/lib/actions/payments";

const PICKUP_TIMES = [
  "In 25-30 minutes",
  "In 45 minutes",
  "In 1 hour",
  "1:00 PM (Lunch)",
  "2:00 PM (Lunch)",
  "7:30 PM (Dinner)",
  "8:30 PM (Dinner)",
  "9:30 PM (Dinner)",
];

export default function CheckoutClient({ taxRatePercent }: { taxRatePercent: number }) {
  const router = useRouter();
  const { items, subtotal, clearCart } = useCart();

  const [diningMode, setDiningMode] = React.useState<"TAKEAWAY" | "DINE_IN">(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("table") || params.get("mode") === "dine_in") {
        return "DINE_IN";
      }
    }
    return "TAKEAWAY";
  });
  const [tableNumber, setTableNumber] = React.useState(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return params.get("table") || "";
    }
    return "";
  });
  const [customerName, setCustomerName] = React.useState("");
  const [customerEmail, setCustomerEmail] = React.useState("");
  const [customerPhone, setCustomerPhone] = React.useState("");
  const [pickupTime, setPickupTime] = React.useState(PICKUP_TIMES[0]);
  const [specialInstructions, setSpecialInstructions] = React.useState("");
  const [paymentMethod, setPaymentMethod] = React.useState<"PAY_AT_PICKUP" | "CARD_ONLINE">("PAY_AT_PICKUP");

  const [selectedTipPct, setSelectedTipPct] = React.useState<number | null>(15);
  const [customTip, setCustomTip] = React.useState("");

  const [couponCode, setCouponCode] = React.useState("");
  const [couponDiscount, setCouponDiscount] = React.useState(0);
  const [appliedCoupon, setAppliedCoupon] = React.useState<string | null>(null);
  const [couponError, setCouponError] = React.useState<string | null>(null);

  const [loyaltyPointsToRedeem, setLoyaltyPointsToRedeem] = React.useState<number>(0);

  const [submitting, setSubmitting] = React.useState(false);
  const [orderError, setOrderError] = React.useState<string | null>(null);

  // All money is computed in integer paise through the same rule the server
  // uses (`lib/money/cart.ts`), then converted to major units for display only.
  // The tax rate is supplied by the server so a configured rate can never
  // disagree with what the customer is charged.
  const subtotalMinor = toMinorUnitsOrZero(subtotal);
  const loyaltyDiscountMinor = loyaltyDiscountMinorUnits(loyaltyPointsToRedeem);
  const tipMinor =
    customTip !== ""
      ? toMinorUnitsOrZero(customTip)
      : selectedTipPct
      ? tipFromPercent(subtotalMinor, selectedTipPct)
      : 0;

  const cart = priceCart({
    subtotalMinorUnits: subtotalMinor,
    couponDiscountMinorUnits: toMinorUnitsOrZero(couponDiscount),
    loyaltyDiscountMinorUnits: loyaltyDiscountMinor,
    tipMinorUnits: tipMinor,
    taxRatePercent,
  });

  const loyaltyDiscount = toMajorUnits(cart.loyaltyDiscountMinorUnits);
  const couponDiscountDisplay = toMajorUnits(cart.couponDiscountMinorUnits);
  const tipAmount = toMajorUnits(cart.tipMinorUnits);
  const tax = toMajorUnits(cart.taxMinorUnits);
  const grandTotal = toMajorUnits(cart.totalMinorUnits);

  async function handleApplyCoupon(e: React.FormEvent) {
    e.preventDefault();
    setCouponError(null);
    if (!couponCode.trim()) return;

    const result = await checkCouponAction(couponCode, subtotal);
    if (!result.valid) {
      setCouponError(result.message ?? "Invalid coupon code");
      setCouponDiscount(0);
      setAppliedCoupon(null);
    } else {
      setCouponDiscount(result.discountAmount ?? 0);
      setAppliedCoupon(result.code ?? couponCode.toUpperCase());
    }
  }

  async function handlePlaceOrder(e: React.FormEvent) {
    e.preventDefault();
    setOrderError(null);
    if (items.length === 0) return;

    if (diningMode === "DINE_IN" && !tableNumber.trim()) {
      setOrderError("Please enter your Table Number for Dine-In service.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await submitTakeawayOrderAction({
        customerName,
        customerEmail,
        customerPhone,
        pickupTime: diningMode === "DINE_IN" ? `Table ${tableNumber}` : pickupTime,
        diningMode,
        tableNumber: diningMode === "DINE_IN" ? tableNumber : undefined,
        tip: tipAmount,
        specialInstructions,
        couponCode: appliedCoupon || undefined,
        loyaltyPointsToRedeem: loyaltyPointsToRedeem > 0 ? loyaltyPointsToRedeem : undefined,
        paymentMethod,
        items: items.map((i) => ({
          dishId: i.dishId || i.id,
          dishName: i.name,
          quantity: i.quantity,
          price: i.price,
          modifiers: i.modifiers?.map((m) => ({
            groupName: m.groupName,
            optionName: m.optionName,
            priceDelta: m.priceDelta,
          })),
        })),
      });

      if (!res.ok || !res.data) {
        setOrderError(res.error ?? "Failed to place order.");
        setSubmitting(false);
        return;
      }

      const orderId = res.data.id;

      if (paymentMethod === "CARD_ONLINE") {
        const payInit = await initiateOrderPaymentAction(orderId);
        if (payInit.ok && payInit.data) {
          const payData = payInit.data;
          if (payData.provider === "RAZORPAY" && payData.keyId) {
            // Dynamically load Razorpay SDK
            const loaded = await new Promise<boolean>((resolve) => {
              if (document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]')) {
                return resolve(true);
              }
              const s = document.createElement("script");
              s.src = "https://checkout.razorpay.com/v1/checkout.js";
              s.onload = () => resolve(true);
              s.onerror = () => resolve(false);
              document.body.appendChild(s);
            });

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const Razorpay = (window as any).Razorpay;
            if (loaded && Razorpay) {
              const rzp = new Razorpay({
                key: payData.keyId,
                amount: payData.amount,
                currency: payData.currency,
                name: "Spice & Saffron",
                description: `Order ${res.data.orderNumber}`,
                order_id: payData.gatewayOrderId,
                prefill: {
                  name: customerName,
                  email: customerEmail,
                  contact: customerPhone,
                },
                theme: { color: "#9A3412" },
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                handler: async function (response: any) {
                  await verifyClientPaymentAction({
                    orderId,
                    paymentId: response.razorpay_payment_id,
                    signature: response.razorpay_signature,
                  });
                  clearCart();
                  router.push(`/order/${orderId}`);
                },
                modal: {
                  ondismiss: function () {
                    clearCart();
                    router.push(`/order/${orderId}`);
                  },
                },
              });
              rzp.open();
              return;
            }
          }
        }
      }

      clearCart();
      router.push(`/order/${orderId}`);
    } catch {
      setOrderError("An unexpected error occurred. Please try again.");
      setSubmitting(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="container-site py-12 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
          <ShoppingBag className="h-8 w-8" />
        </div>
        <h1 className="heading-display mt-4 text-3xl font-bold">Your bag is empty</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Select freshly prepared dishes from our menu to place a takeaway order.
        </p>
        <Link
          href="/menu"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Menu
        </Link>
      </div>
    );
  }

  return (
    <div className="container-site py-12 md:py-16">
      <Link
        href="/menu"
        className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground mb-8"
      >
        <ArrowLeft className="h-4 w-4" /> Continue Ordering
      </Link>

      <h1 className="heading-display text-3xl md:text-4xl font-bold text-foreground mb-2">
        {diningMode === "DINE_IN" ? "Dine-In Order & Checkout" : "Takeaway Order & Checkout"}
      </h1>
      <p className="text-sm text-muted-foreground mb-10">
        {diningMode === "DINE_IN"
          ? "Ordering directly to your dining table at Spice & Saffron."
          : "Review your order and select your preferred pickup time at Hauz Khas."}
      </p>

      {orderError && (
        <div role="alert" className="mb-6 flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{orderError}</span>
        </div>
      )}

      <form onSubmit={handlePlaceOrder} className="grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:gap-14 items-start">
        {/* Left Column: Details */}
        <div className="space-y-8">
          {/* Dining Experience Mode */}
          <div className="rounded-2xl border border-border bg-card p-6 md:p-8 shadow-card space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-foreground flex items-center gap-2">
                <Utensils className="h-4 w-4 text-primary" />
                Dining Experience
              </h2>
              {diningMode === "DINE_IN" && tableNumber && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 font-mono font-semibold">
                  Table {tableNumber}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDiningMode("TAKEAWAY")}
                className={`p-4 rounded-xl border text-left transition-all ${
                  diningMode === "TAKEAWAY"
                    ? "border-primary bg-primary/5 shadow-xs ring-1 ring-primary/40"
                    : "border-border bg-background hover:bg-muted/40"
                }`}
              >
                <div className="flex items-center gap-2 font-medium text-sm text-foreground">
                  <ShoppingBag className="h-4 w-4 text-primary" />
                  Takeaway Pickup
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Packed fresh & ready at front counter.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setDiningMode("DINE_IN")}
                className={`p-4 rounded-xl border text-left transition-all ${
                  diningMode === "DINE_IN"
                    ? "border-primary bg-primary/5 shadow-xs ring-1 ring-primary/40"
                    : "border-border bg-background hover:bg-muted/40"
                }`}
              >
                <div className="flex items-center gap-2 font-medium text-sm text-foreground">
                  <Utensils className="h-4 w-4 text-primary" />
                  Dine-In Table
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Served hot directly to your table.
                </p>
              </button>
            </div>

            {diningMode === "DINE_IN" && (
              <div className="pt-2">
                <label htmlFor="checkout-table" className="text-xs font-medium text-muted-foreground mb-1 block">
                  Table Number *
                </label>
                <input
                  id="checkout-table"
                  type="text"
                  required
                  placeholder="e.g. 4 or Outdoor-B"
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                />
              </div>
            )}
          </div>

          {/* Guest Details */}
          <div className="rounded-2xl border border-border bg-card p-6 md:p-8 shadow-card space-y-6">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              {diningMode === "DINE_IN" ? "Guest Details" : "Pickup Schedule & Guest Details"}
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="checkout-name" className="text-xs font-medium text-muted-foreground mb-1 block">Full Name *</label>
                <input
                  id="checkout-name"
                  autoComplete="name"
                  type="text"
                  required
                  placeholder="e.g. Rahul Verma"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                />
              </div>

              <div>
                <label htmlFor="checkout-phone" className="text-xs font-medium text-muted-foreground mb-1 block">Phone Number *</label>
                <input
                  id="checkout-phone"
                  autoComplete="tel"
                  type="tel"
                  required
                  placeholder="+91 98765 43210"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                />
              </div>
            </div>

            <div>
              <label htmlFor="checkout-email" className="text-xs font-medium text-muted-foreground mb-1 block">Email (for receipt & live tracking) *</label>
              <input
                id="checkout-email"
                autoComplete="email"
                type="email"
                required
                placeholder="rahul@example.com"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>

            {diningMode === "TAKEAWAY" && (
              <div>
                <label htmlFor="checkout-pickup" className="text-xs font-medium text-muted-foreground mb-1 block">Preferred Pickup Time *</label>
                <select
                  id="checkout-pickup"
                  value={pickupTime}
                  onChange={(e) => setPickupTime(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {PICKUP_TIMES.map((time) => (
                    <option key={time} value={time}>
                      {time}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Special Cooking Notes (Optional)</label>
              <textarea
                rows={2}
                placeholder="Extra green chutney, less oil, mild spice..."
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>
          </div>

          {/* Staff Gratuity & Appreciation */}
          <div className="rounded-2xl border border-border bg-card p-6 md:p-8 shadow-card space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-foreground flex items-center gap-2">
                <Heart className="h-4 w-4 text-primary" />
                Staff Gratuity & Appreciation
              </h2>
              {tipAmount > 0 && (
                <span className="text-sm font-semibold text-primary font-mono">
                  +{formatPrice(tipAmount)}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              100% of tips are distributed directly to our kitchen cooks, baristas, and floor service staff.
            </p>

            <div className="grid grid-cols-5 gap-2">
              {[0, 10, 15, 18, 20].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => {
                    setSelectedTipPct(pct);
                    setCustomTip("");
                  }}
                  className={`py-2 px-2 rounded-xl border text-xs font-semibold transition-all ${
                    selectedTipPct === pct && customTip === ""
                      ? "border-primary bg-primary text-primary-foreground shadow-xs"
                      : "border-border bg-background hover:bg-muted/40 text-foreground"
                  }`}
                >
                  {pct === 0 ? "No Tip" : `${pct}%`}
                </button>
              ))}
            </div>
          </div>

          {/* Payment Method */}
          <div className="rounded-2xl border border-border bg-card p-6 md:p-8 shadow-card space-y-4">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" />
              Payment Selection
            </h2>

            <div className="grid gap-3 sm:grid-cols-2">
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-all ${
                  paymentMethod === "PAY_AT_PICKUP"
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border bg-background hover:bg-muted/40"
                }`}
              >
                <input
                  type="radio"
                  name="payment"
                  checked={paymentMethod === "PAY_AT_PICKUP"}
                  onChange={() => setPaymentMethod("PAY_AT_PICKUP")}
                  className="mt-1"
                />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {diningMode === "DINE_IN" ? "Pay at Table / Counter" : "Pay at Counter"}
                  </p>
                  <p className="text-xs text-muted-foreground">Cash, UPI (GPay/PhonePe), or Card at the café</p>
                </div>
              </label>

              <label
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-all ${
                  paymentMethod === "CARD_ONLINE"
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border bg-background hover:bg-muted/40"
                }`}
              >
                <input
                  type="radio"
                  name="payment"
                  checked={paymentMethod === "CARD_ONLINE"}
                  onChange={() => setPaymentMethod("CARD_ONLINE")}
                  className="mt-1"
                />
                <div>
                  <p className="text-sm font-medium text-foreground">Pay Online (Card / UPI)</p>
                  <p className="text-xs text-muted-foreground">Instant digital checkout simulation</p>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Right Column: Summary & Coupon */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-card space-y-5">
            <h3 className="font-semibold text-foreground">Order Items ({items.length})</h3>

            <ul className="divide-y divide-border text-sm">
              {items.map((item) => (
                <li key={item.id} className="py-3 flex justify-between items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground truncate">{item.name}</p>
                    {item.modifiers && item.modifiers.length > 0 && (
                      <div className="mt-0.5 space-y-0.5">
                        {item.modifiers.map((m) => (
                          <p key={`${m.groupId}-${m.optionId}`} className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <span>• {m.optionName}</span>
                            {m.priceDelta > 0 && (
                              <span className="text-primary font-mono text-[10px]">
                                (+{formatPrice(m.priceDelta)})
                              </span>
                            )}
                          </p>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatPrice(item.price)} × {item.quantity}
                    </p>
                  </div>
                  <span className="font-semibold text-foreground shrink-0">
                    {formatPrice(item.price * item.quantity)}
                  </span>
                </li>
              ))}
            </ul>

            {/* Coupon Code Input */}
            <div className="border-t border-border pt-4">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Promo Coupon</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. WELCOME10"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs uppercase tracking-wider focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                />
                <button
                  type="button"
                  onClick={handleApplyCoupon}
                  className="rounded-lg bg-muted px-4 py-1.5 text-xs font-semibold text-foreground hover:bg-muted/80 shrink-0"
                >
                  Apply
                </button>
              </div>

              {couponError && <p role="alert" className="mt-1.5 text-xs text-destructive">{couponError}</p>}
              {appliedCoupon && (
                <p className="mt-1.5 text-xs text-success flex items-center gap-1 font-medium">
                  <Tag className="h-3.5 w-3.5" /> Coupon {appliedCoupon} applied ({formatPrice(couponDiscountDisplay)} discount)
                </p>
              )}
            </div>

            {/* VIP Loyalty Points Redemption */}
            <div className="border-t border-border pt-4">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-muted-foreground block">
                  👑 VIP Loyalty Points
                </label>
                <span className="text-[10px] text-muted-foreground">100 pts = ₹50 off</span>
              </div>
              <div className="flex items-center gap-2">
                {[0, 100, 200, 400].map((pts) => (
                  <button
                    key={pts}
                    type="button"
                    onClick={() => setLoyaltyPointsToRedeem(pts)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                      loyaltyPointsToRedeem === pts
                        ? "bg-amber-500/20 text-amber-400 border-amber-500/50 shadow-sm"
                        : "bg-background text-muted-foreground border-border hover:text-foreground"
                    }`}
                  >
                    {pts === 0 ? "None" : `${pts} pts (-${formatPrice(toMajorUnits(loyaltyDiscountMinorUnits(pts)))})`}
                  </button>
                ))}
              </div>
            </div>

            {/* Price Calculations */}
            <div className="border-t border-border pt-4 space-y-2 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              {couponDiscountDisplay > 0 && (
                <div className="flex justify-between text-success">
                  <span>Promo Coupon Discount</span>
                  <span>- {formatPrice(couponDiscountDisplay)}</span>
                </div>
              )}
              {loyaltyDiscount > 0 && (
                <div className="flex justify-between text-amber-400 font-medium">
                  <span>VIP Points Discount ({loyaltyPointsToRedeem} pts)</span>
                  <span>- {formatPrice(loyaltyDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between text-muted-foreground">
                <span>Restaurant GST ({taxRatePercent}%)</span>
                <span>{formatPrice(tax)}</span>
              </div>
              {tipAmount > 0 && (
                <div className="flex justify-between text-foreground font-medium">
                  <span>Staff Gratuity</span>
                  <span className="text-primary font-mono">+{formatPrice(tipAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-foreground border-t border-border pt-2">
                <span>Total Amount</span>
                <span className="text-primary">{formatPrice(grandTotal)}</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              aria-busy={submitting}
              className="w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-md transition-all hover:bg-primary/90 disabled:opacity-50"
            >
              {submitting
                ? "Placing Order..."
                : `Confirm ${diningMode === "DINE_IN" ? "Dine-In" : "Takeaway"} Order (${formatPrice(grandTotal)})`}
            </button>
          </div>

          <div className="rounded-xl bg-muted/40 p-4 text-xs text-muted-foreground flex items-center gap-2.5">
            <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
            <span>Prepared hygienically to order. You will receive live status updates.</span>
          </div>
        </div>
      </form>
    </div>
  );
}
