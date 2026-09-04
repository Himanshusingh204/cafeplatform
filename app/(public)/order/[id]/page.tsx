import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock, ChefHat, PackageCheck, MapPin, Phone, ArrowLeft } from "lucide-react";
import { getOrderById } from "@/lib/services/orders";
import { formatPrice } from "@/lib/utils/format";
import { OrderLiveTracker } from "@/components/order/order-live-tracker";

interface OrderPageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
  title: "Order Status",
};

const STATUS_STEPS = [
  { key: "PENDING", label: "Received", icon: Clock, desc: "Order sent to kitchen" },
  { key: "PREPARING", label: "Cooking", icon: ChefHat, desc: "Fresh in tandoor & pans" },
  { key: "READY", label: "Ready", icon: PackageCheck, desc: "Packed & warm at counter" },
  { key: "COMPLETED", label: "Picked Up", icon: CheckCircle2, desc: "Enjoy your meal!" },
];

function getStepIndex(status: string): number {
  switch (status) {
    case "PENDING":
    case "CONFIRMED":
      return 0;
    case "PREPARING":
      return 1;
    case "READY":
      return 2;
    case "COMPLETED":
      return 3;
    default:
      return 0;
  }
}

export default async function OrderStatusPage({ params }: OrderPageProps) {
  const { id } = await params;
  const order = await getOrderById(id);

  if (!order) {
    notFound();
  }

  const currentStep = getStepIndex(order.orderStatus);

  return (
    <div className="container-site max-w-3xl py-12 md:py-16">
      <Link
        href="/menu"
        className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Menu
      </Link>

      <div className="rounded-2xl border border-border bg-card p-6 md:p-10 shadow-card space-y-8">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">Takeaway Order Confirmed</p>
            <h1 className="heading-display mt-1 text-3xl font-bold text-foreground">
              {order.orderNumber}
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Placed on {new Date(order.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>

          <div className="text-right sm:text-right">
            <span className="inline-block rounded-full bg-primary/10 px-3.5 py-1 text-xs font-semibold text-primary">
              Pickup: {order.pickupTime}
            </span>
            <p className="text-xs text-muted-foreground mt-1.5">
              Payment: <strong className="text-foreground">{order.paymentStatus === "PAID" ? "Paid Online" : "Pay at Pickup"}</strong>
            </p>
          </div>
        </div>

        <OrderLiveTracker orderId={order.id} currentStatus={order.orderStatus} />

        {/* Live Stepper */}
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-6">
            Live Order Status
          </h2>

          <div className="grid grid-cols-4 gap-2">
            {STATUS_STEPS.map((step, idx) => {
              const isPast = idx < currentStep;
              const isCurrent = idx === currentStep;
              const Icon = step.icon;

              return (
                <div key={step.key} className="text-center space-y-2">
                  <div
                    className={`mx-auto flex h-11 w-11 items-center justify-center rounded-full transition-all ${
                      isCurrent
                        ? "bg-primary text-primary-foreground ring-4 ring-primary/20 scale-110"
                        : isPast
                        ? "bg-success text-success-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className={`text-xs font-semibold ${isCurrent ? "text-primary" : "text-foreground"}`}>
                      {step.label}
                    </p>
                    <p className="text-[10px] text-muted-foreground hidden sm:block mt-0.5">
                      {step.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 relative flex items-center justify-center">
            <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${((currentStep + 1) / STATUS_STEPS.length) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Order Items Breakdown */}
        <div className="border-t border-border pt-6 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Ordered Items
          </h3>
          <ul className="divide-y divide-border text-sm">
            {order.items.map((item) => (
              <li key={item.id} className="py-2.5 flex justify-between items-center text-xs">
                <span className="font-medium text-foreground">
                  {item.quantity} × {item.dishName}
                </span>
                <span className="font-semibold text-foreground">
                  {formatPrice(Number(item.price) * item.quantity)}
                </span>
              </li>
            ))}
          </ul>

          <div className="border-t border-border pt-3 space-y-1.5 text-xs">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>{formatPrice(Number(order.subtotal))}</span>
            </div>
            {Number(order.discount) > 0 && (
              <div className="flex justify-between text-success">
                <span>Coupon Discount ({order.couponCode})</span>
                <span>- {formatPrice(Number(order.discount))}</span>
              </div>
            )}
            <div className="flex justify-between text-muted-foreground">
              <span>GST (5%)</span>
              <span>{formatPrice(Number(order.tax))}</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-foreground border-t border-border pt-2">
              <span>Total</span>
              <span className="text-primary">{formatPrice(Number(order.total))}</span>
            </div>
          </div>
        </div>

        {/* Pickup Location Info */}
        <div className="rounded-xl border border-border bg-muted/30 p-5 space-y-3 text-xs">
          <h4 className="font-semibold text-foreground flex items-center gap-1.5">
            <MapPin className="h-4 w-4 text-primary" />
            Pickup Location
          </h4>
          <p className="text-muted-foreground">
            Spice & Saffron Café · 12 Café Lane, Hauz Khas Village, New Delhi 110016
          </p>
          <div className="flex flex-wrap gap-4 pt-1">
            <a
              href="tel:+919876543210"
              className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
            >
              <Phone className="h-3.5 w-3.5" /> Call Kitchen: +91 98765 43210
            </a>
            <a
              href="https://maps.google.com/?q=Hauz+Khas+New+Delhi"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
            >
              Get Directions
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
