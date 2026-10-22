import { requirePermission } from "@/lib/auth/guards";
import { hasPermission, permissions } from "@/config/roles";
import { db } from "@/lib/db/prisma";
import { KDSBoard, KDSTicket } from "@/components/admin/kds-board";

export const dynamic = "force-dynamic";

export default async function KDSPage() {
  const admin = await requirePermission(permissions.VIEW_MENU);

  // Active queue only: COMPLETED/CANCELLED must never occupy the active window,
  // especially during a busy service where newest-first would hide live tickets.
  const [activeRawOrders, recentCompletedRawOrders] = await Promise.all([
    db.order.findMany({
      where: {
        orderStatus: {
          in: ["PENDING", "CONFIRMED", "PREPARING", "READY"],
        },
      },
      // FIFO: oldest active ticket first so the queue cannot be starved.
      orderBy: { createdAt: "asc" },
      take: 80,
      include: {
        items: true,
      },
    }),
    db.order.findMany({
      where: { orderStatus: "COMPLETED" },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        items: true,
      },
    }),
  ]);

  const initialOrders: KDSTicket[] = [...activeRawOrders, ...recentCompletedRawOrders].map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    customerName: o.customerName,
    pickupTime: o.pickupTime,
    specialInstructions: o.specialInstructions,
    total: Number(o.total),
    orderStatus: o.orderStatus as KDSTicket["orderStatus"],
    createdAt: o.createdAt.toISOString(),
    items: o.items.map((i) => ({
      id: i.id,
      dishName: i.dishName,
      quantity: i.quantity,
      price: Number(i.price),
    })),
  }));

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1800px] mx-auto">
      <KDSBoard initialOrders={initialOrders} canManage={hasPermission(admin.role, permissions.MANAGE_ORDERS)} />
    </div>
  );
}
