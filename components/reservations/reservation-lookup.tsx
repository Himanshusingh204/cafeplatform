"use client";

import * as React from "react";
import { Search, Users, AlertCircle } from "lucide-react";
import { cancelReservationAction, lookupReservationAction } from "@/lib/actions/public";

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
  const [confirming, setConfirming] = React.useState(false);
  const [cancelEmail, setCancelEmail] = React.useState("");
  const [cancelState, setCancelState] = React.useState<"idle" | "pending" | "success" | "error">("idle");
  const [cancelMessage, setCancelMessage] = React.useState<string | null>(null);

  async function handleCancel(e: React.FormEvent) {
    e.preventDefault();
    if (!result || !cancelEmail.trim()) return;
    setCancelState("pending");
    setCancelMessage(null);
    try {
      const res = await cancelReservationAction(result.referenceCode, cancelEmail);
      if (res.success) {
        setCancelState("success");
        setConfirming(false);
        setResult({ ...result, status: "CANCELLED" });
      } else {
        setCancelState("error");
        setCancelMessage(res.error ?? "We could not cancel this booking.");
      }
    } catch {
      setCancelState("error");
      setCancelMessage("We could not reach the booking system. Please try again in a moment.");
    }
  }

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;

    setError(null);
    setResult(null);
    setConfirming(false);
    setCancelEmail("");
    setCancelState("idle");
    setCancelMessage(null);
    setLoading(true);

    try {
      const res = await lookupReservationAction(code);
      if (!res.ok || !res.data) {
        setError(res.error ?? "We could not find a booking with that reference. Check it and try again.");
      } else {
        setResult(res.data);
      }
    } catch {
      setError("We could not reach the booking system. Please try again in a moment.");
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
        return <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-800 dark:text-amber-300">Pending review</span>;
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6 md:p-8 shadow-card space-y-6">
      <div className="flex items-center gap-2 text-foreground font-semibold">
        <Search className="h-4 w-4 text-primary" aria-hidden="true" />
        <span>Find Existing Reservation</span>
      </div>

      <p className="text-sm text-muted-foreground">
        Already booked a table? Enter your booking reference to see its status.
      </p>

      <form onSubmit={handleLookup} className="space-y-2" aria-busy={loading}>
        <label htmlFor="lookup-code" className="block text-sm font-medium text-foreground">
          Booking reference
        </label>
        <div className="flex gap-2">
        <input
          id="lookup-code"
          type="text"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={!!error}
          aria-describedby={error ? "lookup-error" : undefined}
          placeholder="RES-XYZ12"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm uppercase tracking-wider font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
        <button
          type="submit"
          disabled={loading || !code.trim()}
          className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50 transition-all shrink-0"
        >
          {loading ? "Searching" : "Check status"}
        </button>
        </div>
      </form>

      {!result && !error && !loading && (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          Your booking details will show here. The reference is in your confirmation.
        </p>
      )}

      {error && (
        <div id="lookup-error" role="alert" className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div role="status" className="rounded-xl border border-border bg-muted/30 p-5 space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <p className="text-sm text-muted-foreground">Reference</p>
              <p className="heading-display text-lg font-bold text-primary">{result.referenceCode}</p>
            </div>
            {getStatusBadge(result.status)}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
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
            <p className="text-sm text-muted-foreground border-t border-border pt-2">
              Note: &ldquo;{result.specialRequests}&rdquo;
            </p>
          )}

          {cancelState === "success" && (
            <p role="status" className="rounded-lg border border-success/30 bg-success/10 p-3 text-sm text-success">
              Your booking has been cancelled.
            </p>
          )}

          {(result.status === "PENDING" || result.status === "CONFIRMED") && cancelState !== "success" && (
            <div className="border-t border-border pt-3">
              {!confirming ? (
                <button
                  type="button"
                  onClick={() => setConfirming(true)}
                  className="rounded-xl border border-destructive/40 px-4 py-2 text-sm font-semibold text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
                >
                  Cancel booking
                </button>
              ) : (
                <form
                  onSubmit={handleCancel}
                  role="alertdialog"
                  aria-labelledby="cancel-title"
                  aria-describedby="cancel-desc"
                  aria-busy={cancelState === "pending"}
                  className="space-y-3"
                >
                  <p id="cancel-title" className="text-sm font-semibold text-foreground">Cancel this booking?</p>
                  <p id="cancel-desc" className="text-sm text-muted-foreground">
                    Enter the email used for the booking to confirm. This cannot be undone.
                  </p>
                  <label htmlFor="cancel-email" className="sr-only">Booking email</label>
                  <input
                    id="cancel-email"
                    type="email"
                    autoComplete="email"
                    autoFocus
                    required
                    value={cancelEmail}
                    onChange={(e) => setCancelEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  />
                  {cancelState === "error" && cancelMessage && (
                    <p role="alert" className="text-sm text-destructive">{cancelMessage}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={cancelState === "pending" || !cancelEmail.trim()}
                      className="rounded-xl bg-destructive px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {cancelState === "pending" ? "Cancelling" : "Yes, cancel booking"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setConfirming(false); setCancelState("idle"); setCancelMessage(null); }}
                      className="rounded-xl border border-border px-4 py-2 text-sm font-semibold"
                    >
                      Keep booking
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
