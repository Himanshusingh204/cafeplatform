"use client";

import { useState, useTransition } from "react";
import {
  adminCreateTableAction,
  adminUpdateTableStatusAction,
  adminDeleteTableAction,
} from "@/app/admin/actions/tables";
import {
  adminAddToWaitlistAction,
  adminNotifyWaitlistAction,
  adminSeatWaitlistAction,
  adminCancelWaitlistAction,
} from "@/app/admin/actions/waitlist";
import type { TableStatus, TableShape, WaitlistStatus } from "@/lib/generated/prisma/enums";
import {
  Plus,
  QrCode,
  Users,
  Clock,
  Bell,
  CheckCircle2,
  Trash2,
  Share2,
  Sparkles,
} from "lucide-react";

export interface DiningTableItem {
  id: string;
  tableNumber: string;
  capacity: number;
  status: TableStatus;
  shape: TableShape;
  section: string;
  currentOrderId: string | null;
}

export interface WaitlistEntryItem {
  id: string;
  customerName: string;
  customerPhone: string;
  partySize: number;
  specialNotes: string | null;
  status: WaitlistStatus;
  estimatedWaitMinutes: number;
  createdAt: Date | string;
}

interface FloorplanManagerProps {
  initialTables: DiningTableItem[];
  initialWaitlist: WaitlistEntryItem[];
}

export function FloorplanManager({
  initialTables,
  initialWaitlist,
}: FloorplanManagerProps) {
  const [tables, setTables] = useState<DiningTableItem[]>(initialTables);
  const [waitlist, setWaitlist] = useState<WaitlistEntryItem[]>(initialWaitlist);
  const [activeTab, setActiveTab] = useState<"floorplan" | "waitlist">("floorplan");
  const [selectedSection, setSelectedSection] = useState<string>("ALL");
  const [isAddTableOpen, setIsAddTableOpen] = useState(false);
  const [isAddWaitlistOpen, setIsAddWaitlistOpen] = useState(false);
  const [qrModalTable, setQrModalTable] = useState<DiningTableItem | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Distinct sections
  const sections = Array.from(new Set(tables.map((t) => t.section || "Main Dining")));

  const filteredTables = tables.filter((t) => {
    if (selectedSection === "ALL") return true;
    return t.section === selectedSection;
  });

  // KPI counters
  const totalSeats = tables.reduce((acc, t) => acc + t.capacity, 0);
  const occupiedCount = tables.filter((t) => t.status === "OCCUPIED").length;
  const availableCount = tables.filter((t) => t.status === "AVAILABLE").length;
  const dirtyCount = tables.filter((t) => t.status === "DIRTY").length;

  const handleStatusCycle = (table: DiningTableItem) => {
    const nextStatusMap: Record<TableStatus, TableStatus> = {
      AVAILABLE: "OCCUPIED",
      OCCUPIED: "DIRTY",
      DIRTY: "AVAILABLE",
      RESERVED: "AVAILABLE",
    };
    const nextStatus = nextStatusMap[table.status];

    setTables((prev) =>
      prev.map((t) => (t.id === table.id ? { ...t, status: nextStatus } : t))
    );

    startTransition(async () => {
      await adminUpdateTableStatusAction(table.id, nextStatus);
    });
  };

  const handleDeleteTable = (id: string, tableNumber: string) => {
    if (!confirm(`Delete Table ${tableNumber}?`)) return;

    setTables((prev) => prev.filter((t) => t.id !== id));
    startTransition(async () => {
      await adminDeleteTableAction(id);
    });
  };

  const handleCreateTableSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    setErrorMsg(null);
    startTransition(async () => {
      const res = await adminCreateTableAction(fd);
      if (res.ok) {
        setIsAddTableOpen(false);
        window.location.reload();
      } else {
        setErrorMsg(res.error || "Failed to create table");
      }
    });
  };

  const handleAddWaitlistSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    setErrorMsg(null);
    startTransition(async () => {
      const res = await adminAddToWaitlistAction(fd);
      if (res.ok) {
        setIsAddWaitlistOpen(false);
        window.location.reload();
      } else {
        setErrorMsg(res.error || "Failed to add to waitlist");
      }
    });
  };

  const handleNotifyWaitlist = (id: string) => {
    setWaitlist((prev) =>
      prev.map((w) => (w.id === id ? { ...w, status: "NOTIFIED" } : w))
    );
    startTransition(async () => {
      await adminNotifyWaitlistAction(id);
    });
  };

  const handleSeatWaitlist = (id: string) => {
    setWaitlist((prev) => prev.filter((w) => w.id !== id));
    startTransition(async () => {
      await adminSeatWaitlistAction(id);
    });
  };

  const handleCancelWaitlist = (id: string) => {
    setWaitlist((prev) => prev.filter((w) => w.id !== id));
    startTransition(async () => {
      await adminCancelWaitlistAction(id);
    });
  };

  const getTableColor = (status: TableStatus) => {
    switch (status) {
      case "AVAILABLE":
        return "border-emerald-500/60 bg-emerald-500/10 text-emerald-400 hover:border-emerald-400";
      case "OCCUPIED":
        return "border-rose-500/60 bg-rose-500/10 text-rose-400 hover:border-rose-400";
      case "DIRTY":
        return "border-amber-500/60 bg-amber-500/10 text-amber-400 hover:border-amber-400 animate-pulse";
      case "RESERVED":
        return "border-blue-500/60 bg-blue-500/10 text-blue-400 hover:border-blue-400";
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-serif text-foreground">
            Floorplan & Dynamic Waitlist
          </h1>
          <p className="text-sm text-muted-foreground">
            2D visual table management, QR dine-in ordering URLs, and real-time hostess waitlist engine.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-xl bg-card border border-border p-1">
            <button
              type="button"
              onClick={() => setActiveTab("floorplan")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "floorplan"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Floorplan View
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("waitlist")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === "waitlist"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>Waitlist Queue</span>
              {waitlist.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500 text-white font-bold">
                  {waitlist.length}
                </span>
              )}
            </button>
          </div>

          {activeTab === "floorplan" ? (
            <button
              type="button"
              onClick={() => setIsAddTableOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Table
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsAddWaitlistOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Party
            </button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium">
          {errorMsg}
        </div>
      )}

      {/* KPI Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-card border border-border">
          <div className="text-xs font-semibold text-muted-foreground uppercase">Total Capacity</div>
          <div className="text-2xl font-bold text-foreground mt-0.5">
            {totalSeats} <span className="text-xs font-normal text-muted-foreground">seats</span>
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">{tables.length} dining tables</div>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-emerald-500/30">
          <div className="text-xs font-semibold text-emerald-500 uppercase">Available</div>
          <div className="text-2xl font-bold text-emerald-400 mt-0.5">{availableCount}</div>
          <div className="text-[11px] text-muted-foreground mt-1">Ready for seating</div>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-rose-500/30">
          <div className="text-xs font-semibold text-rose-500 uppercase">Occupied</div>
          <div className="text-2xl font-bold text-rose-400 mt-0.5">{occupiedCount}</div>
          <div className="text-[11px] text-muted-foreground mt-1">Dining in progress</div>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-amber-500/30">
          <div className="text-xs font-semibold text-amber-500 uppercase">Dirty / Needs Bussing</div>
          <div className="text-2xl font-bold text-amber-400 mt-0.5">{dirtyCount}</div>
          <div className="text-[11px] text-muted-foreground mt-1">Tap to mark clean</div>
        </div>
      </div>

      {activeTab === "floorplan" ? (
        <div className="space-y-4">
          {/* Section Filter */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setSelectedSection("ALL")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                selectedSection === "ALL"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:text-foreground"
              }`}
            >
              All Sections ({tables.length})
            </button>
            {sections.map((sec) => (
              <button
                key={sec}
                type="button"
                onClick={() => setSelectedSection(sec)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  selectedSection === sec
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:text-foreground"
                }`}
              >
                {sec} ({tables.filter((t) => t.section === sec).length})
              </button>
            ))}
          </div>

          {/* Table Grid / Canvas */}
          <div className="p-6 rounded-3xl bg-card border border-border shadow-inner min-h-[420px]">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {filteredTables.map((table) => {
                const colorClass = getTableColor(table.status);
                const shapeClass =
                  table.shape === "ROUND"
                    ? "rounded-full aspect-square"
                    : table.shape === "BOOTH"
                    ? "rounded-2xl border-dashed"
                    : "rounded-2xl aspect-[4/3]";

                return (
                  <div
                    key={table.id}
                    className={`relative p-4 border-2 transition-all shadow-sm flex flex-col items-center justify-between group ${colorClass} ${shapeClass}`}
                  >
                    {/* Top Buttons: QR and Delete */}
                    <div className="w-full flex items-center justify-between opacity-70 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setQrModalTable(table);
                        }}
                        title="Generate Table QR Order Code"
                        className="p-1 rounded bg-background/80 hover:bg-background text-foreground transition-colors"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTable(table.id, table.tableNumber);
                        }}
                        className="p-1 rounded bg-background/80 hover:bg-rose-500/20 text-muted-foreground hover:text-rose-400 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Table Center Info */}
                    <button
                      type="button"
                      onClick={() => handleStatusCycle(table)}
                      className="text-center w-full py-1 cursor-pointer focus:outline-none"
                    >
                      <div className="text-xl font-bold font-serif text-foreground">
                        {table.tableNumber}
                      </div>
                      <div className="text-[11px] text-muted-foreground flex items-center justify-center gap-1">
                        <Users className="w-3 h-3" />
                        <span>{table.capacity} seats</span>
                      </div>
                      <div className="mt-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-background/70 border border-current">
                          {table.status}
                        </span>
                      </div>
                    </button>

                    {/* Section Tag */}
                    <span className="text-[10px] text-muted-foreground truncate max-w-full">
                      {table.section}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* Waitlist Tab */
        <div className="rounded-2xl bg-card border border-border overflow-hidden shadow-sm">
          <div className="p-4 border-b border-border flex items-center justify-between bg-muted/20">
            <div>
              <h2 className="text-base font-bold text-foreground">Active Hostess Waitlist</h2>
              <p className="text-xs text-muted-foreground">
                Guests currently waiting for an available table. Dynamic ETA updates based on queue length.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20">
              {waitlist.length} {waitlist.length === 1 ? "Party Waiting" : "Parties Waiting"}
            </span>
          </div>

          <div className="divide-y divide-border">
            {waitlist.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground text-xs">
                No guests currently waiting. Walk-in guests can be added immediately.
              </div>
            ) : (
              waitlist.map((entry, idx) => (
                <div
                  key={entry.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/10 transition-colors"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                      #{idx + 1}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-foreground">{entry.customerName}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted font-medium text-muted-foreground">
                          {entry.partySize} guests
                        </span>
                        {entry.status === "NOTIFIED" && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-semibold flex items-center gap-1">
                            <Bell className="w-3 h-3" /> Notified
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Phone: <strong className="text-foreground">{entry.customerPhone}</strong>
                        {entry.specialNotes && (
                          <span className="ml-2 text-amber-400">({entry.specialNotes})</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Est. Wait:{" "}
                          <strong className="text-foreground">{entry.estimatedWaitMinutes} mins</strong>
                        </span>
                        <a
                          href={`/waitlist?id=${entry.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline flex items-center gap-0.5"
                        >
                          <Share2 className="w-3 h-3" /> Live Customer Link
                        </a>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    {entry.status === "WAITING" && (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleNotifyWaitlist(entry.id)}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 transition-colors flex items-center gap-1.5"
                      >
                        <Bell className="w-3 h-3" /> Notify Buzzer
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleSeatWaitlist(entry.id)}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Seat Party
                    </button>

                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleCancelWaitlist(entry.id)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      title="Cancel waitlist entry"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {qrModalTable && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-card border border-border rounded-3xl shadow-2xl p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary mx-auto flex items-center justify-center">
              <QrCode className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-xl font-bold font-serif text-foreground">
                Table {qrModalTable.tableNumber}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Section: {qrModalTable.section} • Capacity: {qrModalTable.capacity} Seats
              </p>
            </div>

            {/* Mockup QR Code Frame */}
            <div className="p-4 bg-white rounded-2xl mx-auto w-48 h-48 flex flex-col items-center justify-center border shadow-inner">
              <div className="font-mono text-black font-extrabold text-sm mb-2">SPICE & SAFFRON</div>
              <div className="w-28 h-28 bg-slate-900 rounded-lg flex items-center justify-center text-white text-center p-2 text-xs font-mono">
                [ QR CODE ]
                <br />
                Table {qrModalTable.tableNumber}
              </div>
              <div className="text-[10px] text-slate-700 mt-2 font-semibold">Scan to Order & Pay</div>
            </div>

            <div className="p-2 rounded-xl bg-muted text-[11px] text-muted-foreground font-mono break-all select-all">
              /menu?table={encodeURIComponent(qrModalTable.tableNumber)}&mode=dine_in
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(
                    `${window.location.origin}/menu?table=${encodeURIComponent(qrModalTable.tableNumber)}&mode=dine_in`
                  );
                  setCopiedLink(true);
                  setTimeout(() => setCopiedLink(false), 2000);
                }}
                className="flex-1 py-2 px-3 rounded-xl text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground border border-border transition-colors flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {copiedLink ? "Copied Link!" : "Copy Order URL"}
              </button>
              <button
                type="button"
                onClick={() => setQrModalTable(null)}
                className="py-2 px-4 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Table Modal */}
      {isAddTableOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-xl p-6 space-y-4">
            <h3 className="text-lg font-bold font-serif text-foreground">
              Add New Dining Table
            </h3>

            <form onSubmit={handleCreateTableSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-foreground mb-1">Table Number / Label</label>
                <input
                  type="text"
                  name="tableNumber"
                  required
                  placeholder="e.g. T-1, Patio-4, Booth-1"
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-foreground mb-1">Seat Capacity</label>
                  <input
                    type="number"
                    name="capacity"
                    defaultValue="4"
                    min="1"
                    max="30"
                    required
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-foreground mb-1">Table Shape</label>
                  <select
                    name="shape"
                    defaultValue="RECTANGLE"
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="RECTANGLE">Rectangle</option>
                    <option value="ROUND">Round</option>
                    <option value="BOOTH">Booth</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">Section</label>
                <input
                  type="text"
                  name="section"
                  defaultValue="Main Dining"
                  placeholder="e.g. Main Dining, Outdoor Patio, Private Mezzanine"
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddTableOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground border border-border transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Add Table to Floor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Waitlist Modal */}
      {isAddWaitlistOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-xl p-6 space-y-4">
            <h3 className="text-lg font-bold font-serif text-foreground">
              Add Party to Waitlist
            </h3>

            <form onSubmit={handleAddWaitlistSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-foreground mb-1">Guest Name</label>
                <input
                  type="text"
                  name="customerName"
                  required
                  placeholder="e.g. Rahul Sharma"
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-foreground mb-1">Phone Number</label>
                  <input
                    type="tel"
                    name="customerPhone"
                    required
                    placeholder="+91 98765 43210"
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-foreground mb-1">Party Size</label>
                  <input
                    type="number"
                    name="partySize"
                    defaultValue="2"
                    min="1"
                    max="20"
                    required
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">Special Requests / Seating Notes</label>
                <input
                  type="text"
                  name="specialNotes"
                  placeholder="e.g. High chair needed, prefers patio"
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddWaitlistOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground border border-border transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Join Waitlist
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
