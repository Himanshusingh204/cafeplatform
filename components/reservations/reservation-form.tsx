"use client";

import * as React from "react";
import Link from "next/link";
import { Calendar, Clock, Users, CheckCircle2, AlertCircle } from "lucide-react";
import { submitReservationAction } from "@/lib/actions/public";

const TIME_SLOTS = [
  "12:00 PM",
  "12:30 PM",
  "1:00 PM",
  "1:30 PM",
  "2:00 PM",
  "2:30 PM",
  "7:00 PM",
  "7:30 PM",
  "8:00 PM",
  "8:30 PM",
  "9:00 PM",
  "9:30 PM",
  "10:00 PM",
];

const GUEST_OPTIONS = [1, 2, 3, 4, 5, 6, 8, 10];

export function ReservationForm() {
  const [guests, setGuests] = React.useState(2);
  const [date, setDate] = React.useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split("T")[0];
  });
  const [timeSlot, setTimeSlot] = React.useState("8:00 PM");
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [specialRequests, setSpecialRequests] = React.useState("");

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [confirmedCode, setConfirmedCode] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await submitReservationAction({
        name,
        email,
        phone,
        guests,
        date: new Date(date),
        timeSlot,
        specialRequests,
      });

      if (!result.ok || !result.data) {
        setError(result.error ?? "Could not book reservation.");
      } else {
        setConfirmedCode(result.data.referenceCode);
      }
    } catch {
      setError("An unexpected error occurred. Please call the café directly.");
    } finally {
      setLoading(false);
    }
  }

  if (confirmedCode) {
    return (
      <div className="rounded-2xl border border-success/30 bg-card p-8 md:p-12 shadow-card text-center animate-in fade-in duration-300">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/15 text-success">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h3 className="heading-display mt-5 text-3xl font-bold text-foreground">Table Reserved!</h3>
        <p className="mt-2 text-muted-foreground">
          We look forward to hosting you at Spice & Saffron.
        </p>

        <div className="my-6 rounded-xl border border-border bg-muted/40 p-5 max-w-sm mx-auto">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Booking Reference</p>
          <p className="heading-display mt-1 text-2xl font-bold tracking-widest text-primary">
            {confirmedCode}
          </p>
          <div className="mt-3 flex justify-between border-t border-border pt-3 text-xs text-muted-foreground">
            <span>{date}</span>
            <span>{timeSlot}</span>
            <span>{guests} {guests === 1 ? "Guest" : "Guests"}</span>
          </div>
        </div>

        <p className="text-xs text-muted-foreground max-w-md mx-auto">
          A confirmation note has been recorded. If your plans change, please give us a quick ring at +91 98765 43210.
        </p>

        <div className="mt-8 flex justify-center gap-4">
          <Link
            href="/menu"
            className="rounded-full bg-primary px-6 py-2.5 text-xs font-semibold text-primary-foreground transition-all hover:bg-primary/90"
          >
            Explore Today&apos;s Menu
          </Link>
          <button
            onClick={() => setConfirmedCode(null)}
            className="rounded-full border border-border px-6 py-2.5 text-xs font-medium text-muted-foreground hover:bg-muted"
          >
            Make Another Booking
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-card p-6 md:p-10 shadow-card space-y-8">
      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Step 1: Party Size */}
      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-foreground mb-3">
          <Users className="h-4 w-4 text-primary" />
          Number of Guests
        </label>
        <div className="flex flex-wrap gap-2">
          {GUEST_OPTIONS.map((num) => (
            <button
              type="button"
              key={num}
              onClick={() => setGuests(num)}
              className={`h-10 w-12 rounded-lg text-sm font-semibold transition-all ${
                guests === num
                  ? "bg-primary text-primary-foreground shadow-sm scale-105"
                  : "border border-border bg-background text-muted-foreground hover:border-primary/50"
              }`}
            >
              {num}
            </button>
          ))}
        </div>
      </div>

      {/* Step 2: Date & Slot */}
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="res-date" className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
            <Calendar className="h-4 w-4 text-primary" />
            Reservation Date
          </label>
          <input
            id="res-date"
            type="date"
            required
            value={date}
            min={new Date().toISOString().split("T")[0]}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
        </div>

        <div>
          <label htmlFor="res-time" className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
            <Clock className="h-4 w-4 text-primary" />
            Preferred Time Slot
          </label>
          <select
            id="res-time"
            value={timeSlot}
            onChange={(e) => setTimeSlot(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {TIME_SLOTS.map((slot) => (
              <option key={slot} value={slot}>
                {slot}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Step 3: Contact Details */}
      <div className="border-t border-border pt-6 space-y-4">
        <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Lead Guest Information
        </h4>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="res-name" className="text-xs font-medium text-muted-foreground mb-1 block">
              Full Name *
            </label>
            <input
              id="res-name"
              type="text"
              required
              placeholder="e.g. Aditi Roy"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>

          <div>
            <label htmlFor="res-email" className="text-xs font-medium text-muted-foreground mb-1 block">
              Email Address *
            </label>
            <input
              id="res-email"
              type="email"
              required
              placeholder="aditi@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>

          <div>
            <label htmlFor="res-phone" className="text-xs font-medium text-muted-foreground mb-1 block">
              Phone Number *
            </label>
            <input
              id="res-phone"
              type="tel"
              required
              placeholder="+91 98765 43210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>
        </div>

        <div>
          <label htmlFor="res-special" className="text-xs font-medium text-muted-foreground mb-1 block">
            Special Requests & Dietary Notes (Optional)
          </label>
          <textarea
            id="res-special"
            rows={2}
            placeholder="Anniversary celebration, high chair needed, mild spice requested..."
            value={specialRequests}
            onChange={(e) => setSpecialRequests(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-md transition-all hover:bg-primary/90 hover:shadow-lg disabled:opacity-50"
      >
        {loading ? "Confirming Table..." : `Confirm Table for ${guests} ${guests === 1 ? "Guest" : "Guests"}`}
      </button>
    </form>
  );
}
