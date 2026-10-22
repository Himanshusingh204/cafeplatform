import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/guards";
import { hasPermission, permissions } from "@/config/roles";
import { getAllTables } from "@/lib/services/tables";
import { getActiveWaitlist } from "@/lib/services/waitlist";
import { FloorplanManager } from "@/components/admin/floorplan-manager";

export const metadata: Metadata = { title: "Floorplan & Waitlist" };

export const dynamic = "force-dynamic";

export default async function AdminTablesPage() {
  const admin = await requirePermission(permissions.VIEW_MENU);

  const [rawTables, rawWaitlist] = await Promise.all([
    getAllTables(),
    getActiveWaitlist(),
  ]);

  const tables = rawTables.map((t) => ({
    id: t.id,
    tableNumber: t.tableNumber,
    capacity: t.capacity,
    status: t.status,
    shape: t.shape,
    section: t.section,
    currentOrderId: t.currentOrderId,
  }));

  const waitlist = rawWaitlist.map((w) => ({
    id: w.id,
    customerName: w.customerName,
    customerPhone: w.customerPhone,
    partySize: w.partySize,
    specialNotes: w.specialNotes,
    status: w.status,
    estimatedWaitMinutes: w.estimatedWaitMinutes,
    createdAt: w.createdAt,
  }));

  return (
    <FloorplanManager
      initialTables={tables}
      initialWaitlist={waitlist}
      canManageTables={hasPermission(admin.role, permissions.MANAGE_SETTINGS)}
    />
  );
}
