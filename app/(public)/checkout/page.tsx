"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Clock, CreditCard, ShieldCheck, ShoppingBag, Tag, AlertCircle } from "lucide-react";
import { useCart } from "@/hooks/use-cart";
import { formatPrice } from "@/lib/utils/format";
import { checkCouponAction, submitTakeawayOrderAction } from "@/lib/actions/public";

const PICKUP_TIMES = [
  "In 25–30 minutes",
  "In 45 minutes",
  "In 1 hour",
  "1:00 PM (Lunch)",
  "2:00 PM (Lunch)",
  "7:30 PM (Dinner)",
  "8:30 PM (Dinner)",
  "9:30 PM (Dinner)",
];

export default function CheckoutPage() {
  const router = useRouter();
  const { items, subtotal, clearCart } = useCart();

  const [customerName, setCustomerName] = React.useState("");
  const [customerEmail, setCustomerEmail] = React.useState("");
  const [customerPhone, setCustomerPhone] = React.useState("");
  const [pickupTime, setPickupTime] = React.useState(PICKUP_TIMES[0]);
  const [specialInstructions, setSpecialInstructions] = React.useState("");
  const [paymentMethod, setPaymentMethod] = React.useState<"PAY_AT_PICKUP" | "CARD_ONLINE">("PAY_AT_PICKUP");

  const [couponCode, setCouponCode] = React.useState("");
  const [couponDiscount, setCouponDiscount] = React.useState(0);
  const [appliedCoupon, setAppliedCoupon] = React.useState<string | null>(null);
  const [couponError, setCouponError] = React.useState<string | null>(null);

  const [submitting, setSubmitting] = React.useState(false);
  const [orderError, setOrderError] = React.useState<string | null>(null);

  const taxableAmount = Math.max(0, subtotal - couponDiscount);
  const tax = Math.round(taxableAmount * 0.05); // 5% GST
  const grandTotal = taxableAmount + tax;

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

    setSubmitting(true);
    try {
      const res = await submitTakeawayOrderAction({
        customerName,
        customerEmail,
        customerPhone,
        pickupTime,
        specialInstructions,
        couponCode: appliedCoupon || undefined,
        paymentMethod,
        items: items.map((i) => ({
          dishId: i.id,
          dishName: i.name,
          quantity: i.quantity,
          price: i.price,
        })),
      });

      if (!res.ok || !res.data) {
        setOrderError(res.error ?? "Failed to place order.");
        setSubmitting(false);
      } else {
        clearCart();
        router.push(`/order/${res.data.id}`);
      }
    } catch {
      setOrderError("An unexpected error occurred. Please try again.");
      setSubmitting(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="container-site py-20 text-center">
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
        Takeaway Checkout
      </h1>
      <p className="text-sm text-muted-foreground mb-10">
        Review your order and select your preferred pickup time at Hauz Khas.
      </p>

      {orderError && (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{orderError}</span>
        </div>
      )}

      <form onSubmit={handlePlaceOrder} className="grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:gap-14 items-start">
        {/* Left Column: Details */}
        <div className="space-y-8">
          {/* Pickup Details */}
          <div className="rounded-2xl border border-border bg-card p-6 md:p-8 shadow-card space-y-6">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Pickup Schedule & Guest Details
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahul Verma"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Phone Number *</label>
                <input
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
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Email (for receipt & live tracking) *</label>
              <input
                type="email"
                required
                placeholder="rahul@example.com"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Preferred Pickup Time *</label>
              <select
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

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Special Cooking Notes (Optional)</label>
              <textarea
                rows={2}
                placeholder="Pack extra green chutney, separate gravy, mild spice..."
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
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
                  <p className="text-sm font-medium text-foreground">Pay at Counter</p>
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
                <li key={item.id} className="py-3 flex justify-between items-center gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
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

              {couponError && <p className="mt-1.5 text-xs text-destructive">{couponError}</p>}
              {appliedCoupon && (
                <p className="mt-1.5 text-xs text-success flex items-center gap-1 font-medium">
                  <Tag className="h-3.5 w-3.5" /> Coupon {appliedCoupon} applied ({formatPrice(couponDiscount)} discount)
                </p>
              )}
            </div>

            {/* Price Calculations */}
            <div className="border-t border-border pt-4 space-y-2 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              {couponDiscount > 0 && (
                <div className="flex justify-between text-success">
                  <span>Discount</span>
                  <span>- {formatPrice(couponDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between text-muted-foreground">
                <span>Restaurant GST (5%)</span>
                <span>{formatPrice(tax)}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-foreground border-t border-border pt-2">
                <span>Total Amount</span>
                <span className="text-primary">{formatPrice(grandTotal)}</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-md transition-all hover:bg-primary/90 disabled:opacity-50"
            >
              {submitting ? "Placing Order..." : `Confirm Takeaway Order (${formatPrice(grandTotal)})`}
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
