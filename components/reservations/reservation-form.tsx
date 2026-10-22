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

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[invalid=true]:border-destructive";
const labelClass = "mb-2 flex items-center gap-2 text-sm font-medium text-foreground";

type FieldKey = "name" | "email" | "phone" | "date";

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 text-sm text-destructive">
      {message}
    </p>
  );
}

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
  const [fieldErrors, setFieldErrors] = React.useState<Partial<Record<FieldKey, string>>>({});
  const [confirmedCode, setConfirmedCode] = React.useState<string | null>(null);
  const successRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (confirmedCode) successRef.current?.focus();
  }, [confirmedCode]);

  function validate(): Partial<Record<FieldKey, string>> {
    const errs: Partial<Record<FieldKey, string>> = {};
    if (name.trim().length < 2) errs.name = "Enter the name for the booking.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errs.email = "Enter a valid email address.";
    if (phone.replace(/\D/g, "").length < 7) errs.phone = "Enter a phone number we can reach you on.";
    if (!date) errs.date = "Choose a date.";
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);

    const errs = validate();
    setFieldErrors(errs);
    const first = (["name", "email", "phone", "date"] as FieldKey[]).find((k) => errs[k]);
    if (first) {
      document.getElementById(`res-${first}`)?.focus();
      return;
    }

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
        setError(result.error ?? "We could not book that table. Please try again.");
      } else {
        setConfirmedCode(result.data.referenceCode);
      }
    } catch {
      setError("Something went wrong on our side. Please try again, or call the cafe.");
    } finally {
      setLoading(false);
    }
  }

  if (confirmedCode) {
    return (
      <div
        ref={successRef}
        tabIndex={-1}
        role="status"
        className="rounded-2xl border border-success/30 bg-card p-8 text-center shadow-card focus:outline-none md:p-12"
      >
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/15 text-success">
          <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
        </div>
        <h2 className="heading-display mt-5 text-3xl text-foreground">Table requested</h2>
        <p className="mx-auto mt-2 max-w-md text-muted-foreground">
          We look forward to seeing you at Spice &amp; Saffron. Keep this reference to check your booking later.
        </p>

        <div className="mx-auto my-6 max-w-sm rounded-xl border border-border bg-muted/40 p-5">
          <p className="text-sm text-muted-foreground">Booking reference</p>
          <p className="heading-display mt-1 text-2xl tracking-widest text-primary">{confirmedCode}</p>
          <div className="mt-3 flex justify-between border-t border-border pt-3 text-sm text-muted-foreground">
            <span>{date}</span>
            <span>{timeSlot}</span>
            <span>
              {guests} {guests === 1 ? "guest" : "guests"}
            </span>
          </div>
        </div>

        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          If your plans change, please call the cafe as soon as you can.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/menu"
            className="rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            View the menu
          </Link>
          <button
            type="button"
            onClick={() => setConfirmedCode(null)}
            className="rounded-full border border-border px-6 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
          >
            Book another table
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-busy={loading}
      className="space-y-8 rounded-2xl border border-border bg-card p-6 shadow-card md:p-10"
    >
      {error && (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <AlertCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <fieldset>
        <legend className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
          <Users className="h-4 w-4 text-primary" aria-hidden="true" />
          Number of guests
        </legend>
        <div className="flex flex-wrap gap-2">
          {GUEST_OPTIONS.map((num) => (
            <button
              type="button"
              key={num}
              aria-pressed={guests === num}
              aria-label={`${num} ${num === 1 ? "guest" : "guests"}`}
              onClick={() => setGuests(num)}
              className={`h-11 w-12 rounded-lg text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                guests === num
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "border border-border bg-background text-foreground hover:border-primary/50"
              }`}
            >
              {num}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="res-date" className={labelClass}>
            <Calendar className="h-4 w-4 text-primary" aria-hidden="true" />
            Date
          </label>
          <input
            id="res-date"
            type="date"
            required
            value={date}
            min={new Date().toISOString().split("T")[0]}
            onChange={(e) => setDate(e.target.value)}
            aria-invalid={!!fieldErrors.date}
            aria-describedby={fieldErrors.date ? "res-date-error" : undefined}
            className={inputClass}
          />
          <FieldError id="res-date-error" message={fieldErrors.date} />
        </div>

        <div>
          <label htmlFor="res-time" className={labelClass}>
            <Clock className="h-4 w-4 text-primary" aria-hidden="true" />
            Time
          </label>
          <select
            id="res-time"
            value={timeSlot}
            onChange={(e) => setTimeSlot(e.target.value)}
            className={inputClass}
          >
            {TIME_SLOTS.map((slot) => (
              <option key={slot} value={slot}>
                {slot}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-4 border-t border-border pt-6">
        <h2 className="text-base font-semibold text-foreground">Your details</h2>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="res-name" className={labelClass}>
              Full name
            </label>
            <input
              id="res-name"
              type="text"
              required
              autoComplete="name"
              placeholder="Aditi Roy"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={!!fieldErrors.name}
              aria-describedby={fieldErrors.name ? "res-name-error" : undefined}
              className={inputClass}
            />
            <FieldError id="res-name-error" message={fieldErrors.name} />
          </div>

          <div>
            <label htmlFor="res-email" className={labelClass}>
              Email address
            </label>
            <input
              id="res-email"
              type="email"
              required
              autoComplete="email"
              placeholder="aditi@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!fieldErrors.email}
              aria-describedby={fieldErrors.email ? "res-email-error" : undefined}
              className={inputClass}
            />
            <FieldError id="res-email-error" message={fieldErrors.email} />
          </div>

          <div>
            <label htmlFor="res-phone" className={labelClass}>
              Phone number
            </label>
            <input
              id="res-phone"
              type="tel"
              required
              autoComplete="tel"
              placeholder="+91 98765 43210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              aria-invalid={!!fieldErrors.phone}
              aria-describedby={fieldErrors.phone ? "res-phone-error" : undefined}
              className={inputClass}
            />
            <FieldError id="res-phone-error" message={fieldErrors.phone} />
          </div>
        </div>

        <div>
          <label htmlFor="res-special" className={labelClass}>
            Special requests <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <textarea
            id="res-special"
            rows={3}
            placeholder="Anniversary, high chair, mild spice"
            value={specialRequests}
            onChange={(e) => setSpecialRequests(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-md transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.99] disabled:opacity-60"
      >
        {loading
          ? "Booking your table"
          : `Book a table for ${guests} ${guests === 1 ? "guest" : "guests"}`}
      </button>
    </form>
  );
}
