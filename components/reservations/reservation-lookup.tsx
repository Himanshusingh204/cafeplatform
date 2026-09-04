"use client";

import * as React from "react";
import { Search, Users, AlertCircle } from "lucide-react";
import { lookupReservationAction } from "@/lib/actions/public";

export function ReservationLookup() {
  const [code, setCode] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<{
    referenceCode: string;
    name: string;
    guests: number;
    date: string;
    timeSlot: string;
    status: string;
    specialRequests?: string | null;
  } | null>(null);

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;

    setError(null);
    setResult(null);
    setLoading(true);

    try {
      const res = await lookupReservationAction(code);
      if (!res.ok || !res.data) {
        setError(res.error ?? "No reservation found with this code.");
      } else {
        setResult(res.data);
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "CONFIRMED":
        return <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-3 py-1 text-xs font-semibold text-success">Confirmed</span>;
      case "SEATED":
        return <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">Seated</span>;
      case "CANCELLED":
        return <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-3 py-1 text-xs font-semibold text-destructive">Cancelled</span>;
      default:
        return <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400">Pending Review</span>;
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6 md:p-8 shadow-card space-y-6">
      <div className="flex items-center gap-2 text-foreground font-semibold">
        <Search className="h-4 w-4 text-primary" />
        <span>Find Existing Reservation</span>
      </div>

      <p className="text-xs text-muted-foreground">
        Already booked a table? Enter your 8-character booking reference to verify confirmation status.
      </p>

      <form onSubmit={handleLookup} className="flex gap-2">
        <input
          type="text"
          placeholder="e.g. RES-XYZ12"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm uppercase tracking-wider font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
        <button
          type="submit"
          disabled={loading || !code.trim()}
          className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50 transition-all shrink-0"
        >
          {loading ? "Searching..." : "Check Status"}
        </button>
      </form>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="rounded-xl border border-border bg-muted/30 p-5 space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Reference</p>
              <p className="heading-display text-lg font-bold text-primary">{result.referenceCode}</p>
            </div>
            {getStatusBadge(result.status)}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-muted-foreground block">Guest Name</span>
              <span className="font-semibold text-foreground mt-0.5 block">{result.name}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Party Size</span>
              <span className="font-semibold text-foreground mt-0.5 block flex items-center gap-1">
                <Users className="h-3 w-3 text-primary" /> {result.guests} {result.guests === 1 ? "Guest" : "Guests"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block">Schedule</span>
              <span className="font-semibold text-foreground mt-0.5 block">
                {result.date} at {result.timeSlot}
              </span>
            </div>
          </div>

          {result.specialRequests && (
            <p className="text-xs text-muted-foreground border-t border-border pt-2 italic">
              Note: &ldquo;{result.specialRequests}&rdquo;
            </p>
          )}
        </div>
      )}
    </div>
  );
}
