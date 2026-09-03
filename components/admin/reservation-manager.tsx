"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { updateReservationStatusAction } from "@/app/admin/actions/reservations";
import type { ReservationStatus } from "@/lib/generated/prisma/enums";

export interface ReservationRow {
  id: string;
  referenceCode: string;
  name: string;
  email: string;
  phone: string;
  guests: number;
  date: string;
  timeSlot: string;
  specialRequests?: string | null;
  status: ReservationStatus;
  notes?: string | null;
}

export function ReservationManager({ reservations: initialRows }: { reservations: ReservationRow[] }) {
  const [rows, setRows] = React.useState(initialRows);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("ALL");
  const [loadingId, setLoadingId] = React.useState<string | null>(null);

  const filtered = rows.filter((r) => {
    const matchesSearch =
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.phone.includes(search) ||
      r.referenceCode.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  async function handleStatus(id: string, status: ReservationStatus) {
    setLoadingId(id);
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));

    await updateReservationStatusAction(id, status);
    setLoadingId(null);
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {["ALL", "PENDING", "CONFIRMED", "SEATED", "CANCELLED"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                statusFilter === st
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-card text-muted-foreground hover:bg-muted"
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search bookings..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-60 rounded-full border border-border bg-card pl-9 pr-3 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {filtered.length === 0 ? (
          <p className="p-12 text-center text-sm text-muted-foreground">No reservations found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/40 font-semibold text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">Code</th>
                  <th className="px-5 py-3">Date & Time</th>
                  <th className="px-5 py-3">Guests</th>
                  <th className="px-5 py-3">Lead Contact</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="px-5 py-3.5 font-bold tracking-wider text-primary">
                      {r.referenceCode}
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-foreground">{r.date}</p>
                      <p className="text-[11px] text-muted-foreground">{r.timeSlot}</p>
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-foreground">
                      {r.guests} {r.guests === 1 ? "person" : "people"}
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-foreground">{r.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {r.phone} · {r.email}
                      </p>
                      {r.specialRequests && (
                        <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400 italic">
                          Note: {r.specialRequests}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          r.status === "CONFIRMED"
                            ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                            : r.status === "SEATED"
                            ? "bg-success/15 text-success"
                            : r.status === "PENDING"
                            ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right space-x-1.5">
                      {r.status === "PENDING" && (
                        <button
                          disabled={loadingId === r.id}
                          onClick={() => handleStatus(r.id, "CONFIRMED")}
                          className="rounded-lg bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-blue-700"
                        >
                          Confirm
                        </button>
                      )}
                      {r.status === "CONFIRMED" && (
                        <button
                          disabled={loadingId === r.id}
                          onClick={() => handleStatus(r.id, "SEATED")}
                          className="rounded-lg bg-success px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-success/90"
                        >
                          Seat Table
                        </button>
                      )}
                      {r.status !== "CANCELLED" && (
                        <button
                          disabled={loadingId === r.id}
                          onClick={() => handleStatus(r.id, "CANCELLED")}
                          className="rounded-lg border border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-destructive hover:text-white"
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
