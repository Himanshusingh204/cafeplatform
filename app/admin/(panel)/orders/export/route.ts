import { requirePermission } from "@/lib/auth/guards";
import { permissions } from "@/config/roles";
import { db } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

const STATUSES = ["PENDING", "CONFIRMED", "PREPARING", "READY", "COMPLETED", "CANCELLED"];

function cell(v: unknown): string {
  let s = String(v ?? "");
  // Neutralise spreadsheet formula injection.
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}

export async function GET(req: Request) {
  await requirePermission(permissions.MANAGE_ORDERS);
  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "";
  const date = url.searchParams.get("date") ?? "";

  const where: Record<string, unknown> = {};
  if (STATUSES.includes(status)) where.orderStatus = status;
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const start = new Date(`${date}T00:00:00.000Z`);
    where.createdAt = { gte: start, lt: new Date(start.getTime() + 86400000) };
  }

  const orders = await db.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 5000,
  });

  const header = ["Order", "Created", "Customer", "Phone", "Email", "Pickup", "Status", "Payment", "Subtotal", "Discount", "Tax", "Total", "Coupon"];
  const lines = orders.map((o) =>
    [
      o.orderNumber, o.createdAt.toISOString(), o.customerName, o.customerPhone, o.customerEmail,
      o.pickupTime, o.orderStatus, o.paymentStatus, Number(o.subtotal), Number(o.discount),
      Number(o.tax), Number(o.total), o.couponCode,
    ].map(cell).join(",")
  );

  return new Response([header.map(cell).join(","), ...lines].join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
