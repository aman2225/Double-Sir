"use client";

import { Button } from "@/components/ui/button";
import { QUICK_MESSAGES } from "@/lib/quickMessages";

export function QuickMessageBar({ onSend }: { onSend: (text: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5 px-1">
      {QUICK_MESSAGES.map((msg) => (
        <Button key={msg} size="xs" variant="secondary" className="rounded-full" onClick={() => onSend(msg)}>
          {msg}
        </Button>
      ))}
    </div>
  );
}
