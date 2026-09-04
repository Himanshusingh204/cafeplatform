"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

interface OrderLiveTrackerProps {
  orderId: string;
  currentStatus: string;
}

export function OrderLiveTracker({ currentStatus }: OrderLiveTrackerProps) {
  const router = useRouter();
  const [lastRefreshed, setLastRefreshed] = React.useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const isTerminal = currentStatus === "COMPLETED" || currentStatus === "CANCELLED";

  React.useEffect(() => {
    if (isTerminal) return;

    const interval = setInterval(() => {
      setIsRefreshing(true);
      router.refresh();
      setLastRefreshed(new Date());
      setTimeout(() => setIsRefreshing(false), 800);
    }, 12_000); // Poll every 12 seconds

    return () => clearInterval(interval);
  }, [router, isTerminal]);

  if (isTerminal) {
    return null;
  }

  return (
    <div className="flex items-center justify-between rounded-xl bg-primary/5 border border-primary/20 px-4 py-2.5 text-xs text-muted-foreground">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
        </span>
        <span className="font-medium text-foreground">Live Kitchen Tracking Active</span>
        <span className="hidden sm:inline">&bull; Updated {lastRefreshed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
      </div>

      <button
        type="button"
        onClick={() => {
          setIsRefreshing(true);
          router.refresh();
          setLastRefreshed(new Date());
          setTimeout(() => setIsRefreshing(false), 800);
        }}
        className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
        disabled={isRefreshing}
      >
        <RefreshCw className={`h-3 w-3 ${isRefreshing ? "animate-spin" : ""}`} />
        <span>Refresh Now</span>
      </button>
    </div>
  );
}
