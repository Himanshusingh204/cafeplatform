"use client";

import * as React from "react";

interface Notification {
  type: string;
  count?: number;
}

export function useNotifications(enabled = true) {
  const [connected, setConnected] = React.useState(false);
  const [lastNotification, setLastNotification] = React.useState<Notification | null>(null);

  React.useEffect(() => {
    if (!enabled) return;

    const eventSource = new EventSource("/api/notifications");

    eventSource.onopen = () => setConnected(true);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "new_message") {
          setLastNotification(data);
        }
      } catch {
        // heartbeat or non-JSON — ignore
      }
    };

    eventSource.onerror = () => {
      setConnected(false);
    };

    return () => {
      eventSource.close();
      setConnected(false);
    };
  }, [enabled]);

  return { connected, lastNotification };
}
