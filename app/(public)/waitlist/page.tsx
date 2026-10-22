"use client";

import { useEffect, useState, useTransition, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Users,
  Clock,
  Sparkles,
  CheckCircle2,
  Bell,
  ArrowRight,
  ChevronRight,
} from "lucide-react";
import { adminAddToWaitlistAction } from "@/app/admin/actions/waitlist";

interface WaitlistPositionData {
  id: string;
  customerName: string;
  partySize: number;
  status: "WAITING" | "NOTIFIED" | "SEATED" | "CANCELLED";
  position: number;
  estimatedWaitMinutes: number;
  notifiedAt?: string | null;
}

function WaitlistTrackerContent() {
  const searchParams = useSearchParams();
  const entryId = searchParams.get("id");

  const [entry, setEntry] = useState<WaitlistPositionData | null>(null);
  const [loading, setLoading] = useState(Boolean(entryId));
  const [isPending, startTransition] = useTransition();
  const [joinedId, setJoinedId] = useState<string | null>(entryId);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Poll waitlist position
  useEffect(() => {
    const targetId = joinedId || entryId;
    if (!targetId) return;

    let isMounted = true;

    const fetchPosition = async () => {
      try {
        const res = await fetch(`/api/v1/waitlist/${targetId}`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setEntry(data);
            setLoading(false);
          }
        }
      } catch {
        // Silent poll error
      }
    };

    fetchPosition();
    const timer = setInterval(fetchPosition, 10_000);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [joinedId, entryId]);

  const handleJoinSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    setErrorMsg(null);
    startTransition(async () => {
      const res = await adminAddToWaitlistAction(fd);
      if (res.ok && res.entryId) {
        setJoinedId(res.entryId);
      } else {
        setErrorMsg(res.error || "Failed to join waitlist");
      }
    });
  };

  return (
    <div className="min-h-[80vh] py-12 px-4 sm:px-6 flex flex-col items-center justify-center">
      <div className="w-full max-w-xl space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-[#8f3320] text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            Live Dine-In Queue
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold font-serif text-foreground">
            Spice & Saffron Waitlist
          </h1>
          <p className="text-sm text-muted-foreground">
            Real-time table queue tracker. We&apos;ll notify you when your table is ready.
          </p>
        </div>

        {loading ? (
          <div className="p-12 rounded-3xl bg-card border border-border text-center space-y-3">
            <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
            <p className="text-sm text-muted-foreground">Looking up your position in queue...</p>
          </div>
        ) : entry ? (
          /* Active Waitlist Ticket View */
          <div className="p-6 sm:p-8 rounded-3xl bg-card border-2 border-primary/30 shadow-xl space-y-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />

            {/* Status Banner */}
            {entry.status === "NOTIFIED" ? (
              <div className="p-4 rounded-2xl bg-amber-500/15 border-2 border-amber-500/40 text-amber-800 dark:text-amber-300 flex items-center gap-3 animate-pulse">
                <Bell className="w-6 h-6 shrink-0" />
                <div>
                  <div className="font-bold text-sm">YOUR TABLE IS READY!</div>
                  <div className="text-xs text-amber-800 dark:text-amber-300">
                    Please proceed to the restaurant hostess stand to be seated immediately.
                  </div>
                </div>
              </div>
            ) : entry.status === "SEATED" ? (
              <div className="p-4 rounded-2xl bg-emerald-500/15 border-2 border-emerald-500/40 text-emerald-800 dark:text-emerald-400 flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 shrink-0" />
                <div>
                  <div className="font-bold text-sm">Party Seated!</div>
                  <div className="text-xs text-emerald-800 dark:text-emerald-400">
                    Enjoy your royal dining experience at Spice & Saffron.
                  </div>
                </div>
              </div>
            ) : entry.status === "CANCELLED" ? (
              <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-800 dark:text-rose-400 text-xs">
                This waitlist entry has been cancelled.
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 rounded-2xl bg-primary/5 border border-primary/20 text-xs text-primary font-medium">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-primary animate-ping" />
                  Live in Queue
                </span>
                <span>Auto-refreshing every 10s</span>
              </div>
            )}

            {/* Queue Position Highlight */}
            {entry.status === "WAITING" && (
              <div className="text-center py-4 space-y-1">
                <div className="text-5xl sm:text-6xl font-extrabold font-serif text-primary">
                  #{entry.position}
                </div>
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Position in Line
                </div>
              </div>
            )}

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-background border border-border text-xs">
              <div className="space-y-1">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-primary" /> Guest Party
                </span>
                <span className="font-bold text-foreground block text-sm">
                  {entry.customerName} ({entry.partySize} guests)
                </span>
              </div>

              <div className="space-y-1">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-primary" /> Estimated Wait
                </span>
                <span className="font-bold text-foreground block text-sm">
                  {entry.status === "NOTIFIED" ? "Ready Now!" : `~${entry.estimatedWaitMinutes} mins`}
                </span>
              </div>
            </div>

            {/* Menu Pre-Ordering CTA */}
            <div className="p-4 rounded-2xl bg-muted/40 border border-border flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-foreground">Explore Our Menu While You Wait</div>
                <div className="text-[11px] text-muted-foreground">
                  Browse appetizers, tandoori grills, and specialty cocktails.
                </div>
              </div>
              <Link
                href="/menu"
                className="px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors flex items-center gap-1 shrink-0"
              >
                <span>Menu</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        ) : (
          /* Join Waitlist Form View */
          <div className="p-6 sm:p-8 rounded-3xl bg-card border border-border shadow-xl space-y-6">
            <div className="space-y-1">
              <h2 className="text-xl font-bold font-serif text-foreground">Join the Waitlist</h2>
              <p className="text-xs text-muted-foreground">
                Get in line right now and receive real-time SMS / status updates.
              </p>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-800 dark:text-rose-400 text-xs font-medium">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleJoinSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-foreground mb-1.5">Your Name</label>
                <input
                  type="text"
                  name="customerName"
                  required
                  placeholder="e.g. Aarti Verma"
                  className="w-full px-4 py-2.5 rounded-xl bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-foreground mb-1.5">Mobile Phone</label>
                  <input
                    type="tel"
                    name="customerPhone"
                    required
                    placeholder="+91 98765 43210"
                    className="w-full px-4 py-2.5 rounded-xl bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label htmlFor="partySize" className="block font-semibold text-foreground mb-1.5">Party Size</label>
                  <select
                    id="partySize"
                    name="partySize"
                    defaultValue="2"
                    className="w-full px-4 py-2.5 rounded-xl bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 16].map((n) => (
                      <option key={n} value={n}>
                        {n} {n === 1 ? "Guest" : "Guests"}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1.5">
                  Seating Preferences / Notes (Optional)
                </label>
                <input
                  type="text"
                  name="specialNotes"
                  placeholder="e.g. Window table preferred, anniversary celebration"
                  className="w-full px-4 py-2.5 rounded-xl bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="w-full py-3 px-4 rounded-xl text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-md flex items-center justify-center gap-2 mt-2"
              >
                <span>{isPending ? "Getting in Line..." : "Join Live Waitlist"}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

export default function WaitlistPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[80vh] flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      }
    >
      <WaitlistTrackerContent />
    </Suspense>
  );
}
