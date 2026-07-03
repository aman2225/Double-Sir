"use client";

import { motion } from "framer-motion";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChatMessage } from "@/sockets/chatEvents";
import { TEAM_THEME } from "@/lib/teamTheme";
import { teamForSeat } from "@/engine/types";
import { cn } from "@/lib/utils";

function formatTime(epochMs: number): string {
  return new Date(epochMs).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function ChatMessageBubble({ message, isOwn }: { message: ChatMessage; isOwn: boolean }) {
  const theme = TEAM_THEME[teamForSeat(message.seat)];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2 }}
      className={cn("flex items-end gap-2", isOwn && "flex-row-reverse")}
    >
      <Avatar className="h-6 w-6 shrink-0">
        <AvatarFallback className={cn(theme.bg, "text-[10px] text-white")}>
          {message.displayName.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className={cn("flex max-w-[75%] flex-col gap-0.5", isOwn && "items-end")}>
        <div className="flex items-baseline gap-1.5">
          <span className={cn("text-[11px] font-medium", theme.text)}>{message.displayName}</span>
          <span className="text-[10px] text-muted-foreground">{formatTime(message.sentAt)}</span>
        </div>
        <p
          className={cn(
            "whitespace-pre-wrap break-words rounded-2xl px-3 py-1.5 text-sm",
            isOwn ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-white/10"
          )}
        >
          {message.text}
        </p>
      </div>
    </motion.div>
  );
}
