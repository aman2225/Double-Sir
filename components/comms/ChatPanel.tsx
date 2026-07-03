"use client";

import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useChatStore } from "@/store/useChatStore";
import { useUIStore } from "@/store/useUIStore";
import { sounds } from "@/lib/sounds";
import { Seat } from "@/engine/types";
import { ChatMessageBubble } from "./ChatMessageBubble";
import { QuickMessageBar } from "./QuickMessageBar";

const MAX_LENGTH = 300;

export function ChatPanel({ roomCode, mySeat }: { roomCode: string; mySeat: Seat }) {
  const messages = useChatStore((s) => s.messages);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const soundEnabled = useUIStore((s) => s.soundEnabled);

  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastCountRef = useRef(0);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    if (messages.length > lastCountRef.current && soundEnabled) sounds.messageReceived();
    lastCountRef.current = messages.length;
  }, [messages.length, soundEnabled]);

  function handleSend(text: string) {
    if (!text.trim()) return;
    sendMessage(roomCode, text);
    setDraft("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(draft);
    }
  }

  return (
    <div className="flex h-full flex-col gap-2">
      <ScrollArea className="flex-1 rounded-lg border border-white/10 bg-black/10 p-3">
        <div className="flex flex-col gap-3">
          {messages.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">No messages yet — say hello!</p>
          ) : (
            messages.map((m) => <ChatMessageBubble key={m.id} message={m} isOwn={m.seat === mySeat} />)
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      <QuickMessageBar onSend={handleSend} />

      <div className="flex items-end gap-2">
        <div className="relative flex-1">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, MAX_LENGTH))}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            maxLength={MAX_LENGTH}
            className="max-h-24 min-h-9 w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-primary/50"
          />
          <span className="pointer-events-none absolute bottom-1 right-2 text-[10px] text-muted-foreground">
            {draft.length}/{MAX_LENGTH}
          </span>
        </div>
        <Button size="icon" aria-label="Send message" onClick={() => handleSend(draft)} disabled={!draft.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
