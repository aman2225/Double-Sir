"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useMusicStore } from "@/store/useMusicStore";

const ACTION_TEXT: Record<string, (name: string, title?: string) => string> = {
  started: (name, title) => `🎵 ${name} started "${title}"`,
  changed: (name, title) => `🎵 ${name} changed music to "${title}"`,
  paused: (name) => `⏸ ${name} paused the music`,
  resumed: (name) => `▶ ${name} resumed the music`,
  stopped: (name) => `⏹ ${name} stopped the music`,
};

/** Beautiful in-game toasts for host music actions — mirrors hooks/useCommsNotifications.ts's pattern. */
export function useMusicNotifications() {
  const lastNotification = useMusicStore((s) => s.lastNotification);
  const seenKey = useRef<number | null>(null);

  useEffect(() => {
    if (!lastNotification || lastNotification.key === seenKey.current) return;
    seenKey.current = lastNotification.key;
    const text = ACTION_TEXT[lastNotification.action]?.(lastNotification.displayName, lastNotification.trackTitle);
    if (text) toast.message(text);
  }, [lastNotification]);
}
