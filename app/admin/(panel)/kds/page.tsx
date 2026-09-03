import { requirePermission } from "@/lib/auth/guards";
import { permissions } from "@/config/roles";
import { db } from "@/lib/db/prisma";
import { KDSBoard, KDSTicket } from "@/components/admin/kds-board";

export const dynamic = "force-dynamic";

export default async function KDSPage() {
  await requirePermission(permissions.VIEW_MENU);

  const initialRawOrders = await db.order.findMany({
    where: {
      orderStatus: {
        in: ["PENDING", "CONFIRMED", "PREPARING", "READY", "COMPLETED"],
      },
    },
    orderBy: { createdAt: "desc" },
    take: 40,
    include: {
      items: true,
    },
  });

  const initialOrders: KDSTicket[] = initialRawOrders.map((o) => ({
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
      <KDSBoard initialOrders={initialOrders} />
    </div>
  );
}
