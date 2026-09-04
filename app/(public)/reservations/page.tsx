import type { Metadata } from "next";
import { Clock, MapPin, Phone, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { ReservationForm } from "@/components/reservations/reservation-form";
import { ReservationLookup } from "@/components/reservations/reservation-lookup";

export const metadata: Metadata = {
  title: "Reserve a Table",
  description: "Book your dining table at Spice & Saffron in Hauz Khas Village, New Delhi. Authentic Indian culinary feasts cooked with patience.",
  alternates: { canonical: "/reservations" },
};

export default function ReservationsPage() {
  return (
    <>
      <PageHeader
        title="Reserve a table"
        description="Whether an intimate dinner or a lively gathering, we prepare every dish to order. Reserve your table ahead to ensure a seamless experience."
      />

      <div className="container-site py-12 md:py-16">
        <div className="grid gap-12 lg:grid-cols-[1.5fr_1fr] lg:gap-16 items-start">
          <ReservationForm />

          {/* Guidelines & Policies */}
          <div className="space-y-6">
            <ReservationLookup />

            <div className="rounded-2xl border border-border bg-muted/40 p-6 space-y-4">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Dining Policies
              </h3>
              <ul className="space-y-3 text-xs leading-relaxed text-muted-foreground">
                <li className="flex gap-2">
                  <span className="font-bold text-foreground">·</span>
                  <span>We hold reserved tables for up to 15 minutes past your booking time before releasing to walk-in guests.</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-foreground">·</span>
                  <span>For parties of 8 or more, we recommend calling our hosts directly so we can curate a custom tasting menu.</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-foreground">·</span>
                  <span>Weekend dinner seatings (Friday–Sunday) fill quickly; advance booking is highly recommended.</span>
                </li>
              </ul>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 shadow-card space-y-4">
              <h3 className="font-semibold text-foreground">Need Immediate Assistance?</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Planning a last-minute lunch or running behind schedule? Reach our host desk directly:
              </p>
              <div className="space-y-2 pt-1 text-xs">
                <a
                  href="tel:+919876543210"
                  className="flex items-center gap-2 font-medium text-foreground hover:text-primary transition-colors"
                >
                  <Phone className="h-3.5 w-3.5 text-primary" />
                  +91 98765 43210
                </a>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  Lunch: 12 PM – 3:30 PM · Dinner: 7 PM – 11 PM
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 text-primary" />
                  12 Café Lane, Hauz Khas Village, New Delhi
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
