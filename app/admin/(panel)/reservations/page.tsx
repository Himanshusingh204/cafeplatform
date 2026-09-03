import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/guards";
import { permissions } from "@/config/roles";
import { listReservationsAdmin, getReservationStats } from "@/lib/services/reservations";
import { ReservationManager } from "@/components/admin/reservation-manager";
import type { ReservationStatus } from "@/lib/generated/prisma/enums";

export const metadata: Metadata = { title: "Table Reservations" };
export const dynamic = "force-dynamic";

interface ReservationsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminReservationsPage({ searchParams }: ReservationsPageProps) {
  await requirePermission(permissions.VIEW_MESSAGES);
  const query = await searchParams;
  const statusParam = typeof query.status === "string" ? (query.status as ReservationStatus) : undefined;

  const [data, stats] = await Promise.all([
    listReservationsAdmin({
      status: statusParam,
      pageSize: 50,
    }),
    getReservationStats(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="heading-display text-3xl">Table Bookings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage dining reservations, party sizes, and table seating status.
        </p>
      </div>

      {/* KPI Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <span className="text-xs text-muted-foreground font-medium">Pending Requests</span>
          <p className="heading-display mt-1 text-2xl font-bold text-amber-500">{stats.pendingCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <span className="text-xs text-muted-foreground font-medium">Bookings Today</span>
          <p className="heading-display mt-1 text-2xl font-bold text-primary">{stats.todayCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <span className="text-xs text-muted-foreground font-medium">Total Seated</span>
          <p className="heading-display mt-1 text-2xl font-bold text-success">{stats.totalSeated}</p>
        </div>
      </div>

      <ReservationManager
        reservations={data.items.map((r) => ({
          id: r.id,
          referenceCode: r.referenceCode,
          name: r.name,
          email: r.email,
          phone: r.phone,
          guests: r.guests,
          date: r.date.toISOString().split("T")[0],
          timeSlot: r.timeSlot,
          specialRequests: r.specialRequests,
          status: r.status,
          notes: r.notes,
        }))}
      />
    </div>
  );
}
