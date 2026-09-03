import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/guards";
import { permissions } from "@/config/roles";
import { listOrdersAdmin, getOrderStats } from "@/lib/services/orders";
import { formatPrice } from "@/lib/utils/format";
import { OrderManager } from "@/components/admin/order-manager";
import type { OrderStatus } from "@/lib/generated/prisma/enums";

export const metadata: Metadata = { title: "Takeaway Orders" };
export const dynamic = "force-dynamic";

interface OrdersPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminOrdersPage({ searchParams }: OrdersPageProps) {
  await requirePermission(permissions.VIEW_MENU);
  const query = await searchParams;
  const statusParam = typeof query.status === "string" ? (query.status as OrderStatus) : undefined;

  const [data, stats] = await Promise.all([
    listOrdersAdmin({
      status: statusParam,
      pageSize: 50,
    }),
    getOrderStats(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="heading-display text-3xl">Takeaway Orders</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Live kitchen queue, preparation times, and takeaway fulfillment.
        </p>
      </div>

      {/* KPI Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <span className="text-xs text-muted-foreground font-medium">Active Kitchen Orders</span>
          <p className="heading-display mt-1 text-2xl font-bold text-amber-500">{stats.activeOrders}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <span className="text-xs text-muted-foreground font-medium">Completed Today</span>
          <p className="heading-display mt-1 text-2xl font-bold text-success">{stats.completedToday}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <span className="text-xs text-muted-foreground font-medium">Today&apos;s Takeaway Sales</span>
          <p className="heading-display mt-1 text-2xl font-bold text-primary">{formatPrice(stats.todayRevenue)}</p>
        </div>
      </div>

      <OrderManager
        orders={data.items.map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          customerName: o.customerName,
          customerEmail: o.customerEmail,
          customerPhone: o.customerPhone,
          pickupTime: o.pickupTime,
          specialInstructions: o.specialInstructions,
          subtotal: Number(o.subtotal),
          discount: Number(o.discount),
          tax: Number(o.tax),
          total: Number(o.total),
          paymentStatus: o.paymentStatus,
          orderStatus: o.orderStatus,
          couponCode: o.couponCode,
          createdAt: o.createdAt.toISOString(),
          items: o.items.map((i) => ({
            id: i.id,
            dishName: i.dishName,
            quantity: i.quantity,
            price: Number(i.price),
          })),
        }))}
      />
    </div>
  );
}
